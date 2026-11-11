import fs from 'node:fs/promises';
import path from 'node:path';
import { readRegularFile } from './safe-fs.js';

export const MAX_FILE_BYTES = 1024 * 1024;
export const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', '.next', '.cache']);
const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.json', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.env', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rb', '.pl', '.php', '.go', '.rs', '.java', '.kt', '.sql', '.html', '.xml', '.ipynb']);

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function walk(directory, found, skipped, maxFiles, mode = 'text', limits = { maxDirectories: 10000, maxDepth: 40, visited: 0 }, depth = 0) {
  if (depth > limits.maxDepth) { skipped.push({ file: directory, reason: `Directory depth limit (${limits.maxDepth}) reached.` }); return; }
  limits.visited += 1;
  if (limits.visited > limits.maxDirectories) { skipped.push({ file: directory, reason: `Directory limit (${limits.maxDirectories}) reached.` }); return; }
  if (found.length >= maxFiles) {
    skipped.push({ file: directory, reason: `File limit (${maxFiles}) reached; directory was not scanned.` });
    return;
  }
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
      if (!SKIP_DIRS.has(entry.name)) await walk(absolute, found, skipped, maxFiles, mode, limits, depth + 1);
    } else if (entry.isFile() && (mode === 'all' || entry.name.toLowerCase() === 'skill.md' || TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))) {
      found.push(absolute);
    }
  }
}

async function findSkillDirectories(directory, found, skipped, limits = { maxDirectories: 10000, maxDepth: 40, visited: 0 }, depth = 0) {
  if (depth > limits.maxDepth) { skipped.push({ file: directory, reason: `Directory depth limit (${limits.maxDepth}) reached.` }); return; }
  limits.visited += 1;
  if (limits.visited > limits.maxDirectories) { skipped.push({ file: directory, reason: `Directory limit (${limits.maxDirectories}) reached.` }); return; }
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
    roots.push(absolute);
    if (stat.isFile()) {
      if (found.length >= maxFiles) {
        skipped.push({ file: input, reason: `File limit (${maxFiles}) reached.` });
        continue;
      }
      found.push(absolute);
      continue;
    }
    if (!stat.isDirectory()) continue;

    const rootSkill = path.join(absolute, 'SKILL.md');
    if (await exists(rootSkill)) {
      await walk(absolute, found, skipped, maxFiles, 'text', { maxDirectories, maxDepth, visited: 0 });
    } else {
      const skillDirectories = [];
      await findSkillDirectories(absolute, skillDirectories, skipped, { maxDirectories, maxDepth, visited: 0 });
      if (skillDirectories.length) {
        const walkLimits = { maxDirectories, maxDepth, visited: 0 };
        for (const skillDirectory of skillDirectories) await walk(skillDirectory, found, skipped, maxFiles, 'text', walkLimits);
      } else {
        // Useful fallback for explicitly supplied folders that are not Agent Skills bundles.
        await walk(absolute, found, skipped, maxFiles, 'text', { maxDirectories, maxDepth, visited: 0 });
      }
    }
  }

  const unique = [...new Set(found)];
  const files = [];
  for (const filePath of unique) {
    try {
      const result = await readRegularFile(filePath, { maxBytes: maxFileBytes });
      if (result.oversized) {
        skipped.push({ file: filePath, reason: `File exceeds ${maxFileBytes} bytes.` });
        continue;
      }
      const content = result.bytes.toString('utf8');
      if (content.includes('\\u0000')) {
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
  const files = [];
  const skipped = [];
  if (stat.isFile()) files.push(absolute);
  else await walk(directory, files, skipped, options.maxFiles ?? 10000, 'all', { maxDirectories: options.maxDirectories ?? 10000, maxDepth: options.maxDepth ?? 40, visited: 0 });
  return { root: directory, files, skipped };
}
