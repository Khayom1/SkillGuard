import fs from 'node:fs/promises';
import path from 'node:path';
import { readRegularFile } from './safe-fs.js';

export const MAX_FILE_BYTES = 1024 * 1024;
export const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', '.next', '.cache']);
const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.json', '.jsonc', '.json5', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.properties', '.env', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.psd1', '.bat', '.cmd', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.py', '.rb', '.pl', '.php', '.go', '.rs', '.java', '.kt', '.scala', '.lua', '.r', '.ex', '.exs', '.swift', '.dart', '.c', '.h', '.cc', '.cpp', '.cs', '.sql', '.tf', '.tfvars', '.hcl', '.kts', '.gradle', '.mdc', '.pem', '.key', '.crt', '.cer', '.html', '.xml', '.svg', '.css', '.scss', '.less', '.ipynb']);
const TEXT_FILENAMES = new Set([
  '.env', '.npmrc', '.pypirc', '.netrc', '.bashrc', '.zshrc', '.profile', '.envrc', '.pgpass', '.my.cnf', '.secrets',
  '.gitignore', '.gitmodules', '.dockerignore', 'dockerfile', 'containerfile',
  'makefile', 'procfile', 'justfile', 'gemfile', 'rakefile', 'taskfile', 'vagrantfile', 'brewfile', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa', 'credentials', 'private_key', 'privatekey'
]);

function isSupportedTextFile(name) {
  const normalized = name.toLowerCase();
  return normalized === 'skill.md' ||
    TEXT_FILENAMES.has(normalized) ||
    normalized.startsWith('.env.') ||
    TEXT_EXTENSIONS.has(path.extname(normalized));
}
async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function isWithinDirectory(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function isSafeDirectory(directory, limits, skipped) {
  if (!limits.boundaryRoot) return true;
  try {
    const [canonical, stat] = await Promise.all([fs.realpath(directory), fs.lstat(directory)]);
    if (stat.isSymbolicLink() || !stat.isDirectory() || !isWithinDirectory(limits.boundaryRoot, canonical)) {
      skipped.push({ file: directory, reason: 'Directory escaped the scan root or changed into a symbolic link.' });
      return false;
    }
    return true;
  } catch (error) {
    skipped.push({ file: directory, reason: `Cannot safely inspect directory: ${error.message}` });
    return false;
  }
}

async function walk(directory, found, skipped, maxFiles, mode = 'text', limits = { maxDirectories: 10000, maxDepth: 40, visited: 0 }, depth = 0) {
  if (depth > limits.maxDepth) { skipped.push({ file: directory, reason: `Directory depth limit (${limits.maxDepth}) reached.` }); return; }
  limits.visited += 1;
  if (limits.visited > limits.maxDirectories) { skipped.push({ file: directory, reason: `Directory limit (${limits.maxDirectories}) reached.` }); return; }
  if (found.length >= maxFiles) {
    skipped.push({ file: directory, reason: `File limit (${maxFiles}) reached; directory was not scanned.` });
    return;
  }
  if (!(await isSafeDirectory(directory, limits, skipped))) return;
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { skipped.push({ file: directory, reason: `Cannot read directory: ${error.message}` }); return; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (found.length >= maxFiles) {
      skipped.push({ file: directory, reason: `File limit (${maxFiles}) reached.` });
      return;
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      skipped.push({ file: absolute, reason: 'Symbolic link was not followed.' });
    } else if (entry.isDirectory()) {
      const excluded = mode === 'all' ? entry.name === '.git' : SKIP_DIRS.has(entry.name);
      if (!excluded) await walk(absolute, found, skipped, maxFiles, mode, limits, depth + 1);
      else if (mode !== 'all' && entry.name !== '.git') {
        skipped.push({ file: absolute, reason: 'Directory excluded by scan policy; inspect it separately if it contains executable skill content.' });
      }
    } else if (entry.isFile() && (mode === 'all' || isSupportedTextFile(entry.name))) {
      found.push(absolute);
    } else if (entry.isFile() && mode !== 'all') {
      skipped.push({ file: absolute, reason: 'Unsupported file type; text analysis did not inspect this file.' });
    }
  }
}

async function findSkillDirectories(directory, found, skipped, limits = { maxDirectories: 10000, maxDepth: 40, visited: 0 }, depth = 0) {
  if (depth > limits.maxDepth) { skipped.push({ file: directory, reason: `Directory depth limit (${limits.maxDepth}) reached.` }); return; }
  limits.visited += 1;
  if (limits.visited > limits.maxDirectories) { skipped.push({ file: directory, reason: `Directory limit (${limits.maxDirectories}) reached.` }); return; }
  if (!(await isSafeDirectory(directory, limits, skipped))) return;
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { skipped.push({ file: directory, reason: `Cannot read directory: ${error.message}` }); return; }
  if (entries.some((entry) => entry.isFile() && entry.name.toLowerCase() === 'skill.md')) {
    found.push(directory);
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      skipped.push({ file: absolute, reason: 'Symbolic link was not followed.' });
    } else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
      await findSkillDirectories(absolute, found, skipped, limits, depth + 1);
    } else if (entry.isDirectory() && entry.name !== '.git') {
      skipped.push({ file: absolute, reason: 'Directory excluded by skill discovery policy.' });
    }
  }
}

export async function collectFiles(inputPaths, options = {}) {
  const maxFiles = Number.isInteger(options.maxFiles) ? options.maxFiles : 5000;
  const maxDirectories = Number.isInteger(options.maxDirectories) ? options.maxDirectories : 10000;
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 40;
  const maxFileBytes = options.maxFileBytes ?? MAX_FILE_BYTES;
  if (maxFiles < 1 || maxDirectories < 1 || maxDepth < 0 || !Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1) {
    throw new Error('File and directory limits must be positive integers; maxDepth may be zero.');
  }
  const found = [];
  const skipped = [];
  const roots = [];
  const rootBoundaries = [];

  for (const input of inputPaths.length ? inputPaths : ['.']) {
    const absolute = path.resolve(input);
    if (!(await exists(absolute))) {
      skipped.push({ file: input, reason: 'Path does not exist.' });
      continue;
    }
    const stat = await fs.lstat(absolute);
    if (stat.isSymbolicLink()) {
      skipped.push({ file: input, reason: 'Symbolic links are not followed.' });
      continue;
    }
    const boundaryRoot = stat.isDirectory()
      ? await fs.realpath(absolute)
      : await fs.realpath(path.dirname(absolute));
    roots.push(absolute);
    rootBoundaries.push({ inputPath: absolute, boundaryRoot });
    if (stat.isFile()) {
      if (found.length >= maxFiles) {
        skipped.push({ file: input, reason: `File limit (${maxFiles}) reached.` });
        continue;
      }
      if (isSupportedTextFile(path.basename(absolute))) {
        found.push(absolute);
      } else {
        skipped.push({ file: absolute, reason: 'Unsupported file type; text analysis did not inspect this file.' });
      }
      continue;
    }
    if (!stat.isDirectory()) continue;

    const rootSkill = path.join(absolute, 'SKILL.md');
    if (await exists(rootSkill)) {
      await walk(absolute, found, skipped, maxFiles, 'text', { maxDirectories, maxDepth, visited: 0, boundaryRoot });
    } else {
      const skillDirectories = [];
      await findSkillDirectories(absolute, skillDirectories, skipped, { maxDirectories, maxDepth, visited: 0, boundaryRoot });
      if (skillDirectories.length) {
        const walkLimits = { maxDirectories, maxDepth, visited: 0, boundaryRoot };
        for (const skillDirectory of skillDirectories) await walk(skillDirectory, found, skipped, maxFiles, 'text', walkLimits);
      } else {
        // Useful fallback for explicitly supplied folders that are not Agent Skills bundles.
        await walk(absolute, found, skipped, maxFiles, 'text', { maxDirectories, maxDepth, visited: 0, boundaryRoot });
      }
    }
  }

  const unique = [...new Set(found)];
  const files = [];
  for (const filePath of unique) {
    try {
      const boundary = rootBoundaries
        .filter((item) => {
          const relative = path.relative(item.inputPath, filePath);
          return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
        })
        .sort((a, b) => b.inputPath.length - a.inputPath.length)[0];
      const result = await readRegularFile(filePath, { maxBytes: maxFileBytes, allowedRoot: boundary?.boundaryRoot });
      if (result.oversized) {
        skipped.push({ file: filePath, reason: `File exceeds ${maxFileBytes} bytes.` });
        continue;
      }
      const content = result.bytes.toString('utf8');
      if (content.includes('\u0000')) {
        skipped.push({ file: filePath, reason: 'Binary or null-byte content was skipped.' });
        continue;
      }
      files.push({ filePath, content });
    } catch (error) {
      skipped.push({ file: filePath, reason: `Cannot safely read file: ${error.message}` });
    }
  }

  const uniqueSkipped = [...new Map(skipped.map((item) => [`${item.file}:${item.reason}`, item])).values()];
  return { files, skipped: uniqueSkipped, roots };
}

export async function collectBundlePaths(root, options = {}) {
  const absolute = path.resolve(root);
  const stat = await fs.lstat(absolute);
  if (stat.isSymbolicLink()) throw new Error('Refusing to create an integrity lock through a symbolic link.');
  const directory = stat.isDirectory() ? absolute : path.dirname(absolute);
  const boundaryRoot = stat.isDirectory()
    ? await fs.realpath(absolute)
    : await fs.realpath(path.dirname(absolute));
  const files = [];
  const skipped = [];
  if (stat.isFile()) files.push(absolute);
  else await walk(directory, files, skipped, options.maxFiles ?? 10000, 'all', { maxDirectories: options.maxDirectories ?? 10000, maxDepth: options.maxDepth ?? 40, visited: 0, boundaryRoot });
  return { root: directory, boundaryRoot, files, skipped };
}
