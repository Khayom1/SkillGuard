import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_FILE_BYTES = 1024 * 1024;
export const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', '.next', '.cache']);
const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.json', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.env', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rb', '.pl', '.php', '.go', '.rs', '.java', '.kt', '.sql', '.html', '.xml', '.ipynb']);

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function walk(directory, found, skipped, maxFiles, mode = 'text') {
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
      if (!SKIP_DIRS.has(entry.name)) await walk(absolute, found, skipped, maxFiles, mode);
    } else if (entry.isFile() && (mode === 'all' || entry.name.toLowerCase() === 'skill.md' || TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))) {
      found.push(absolute);
    }
  }
}

async function findSkillDirectories(directory, found, skipped) {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { skipped.push({ file: directory, reason: `Cannot read directory: ${error.message}` }); return; }
  if (entries.some((entry) => entry.isFile() && entry.name.toLowerCase() === 'skill.md')) {
    found.push(directory);
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.isSymbolicLink() && !SKIP_DIRS.has(entry.name)) {
      await findSkillDirectories(path.join(directory, entry.name), found, skipped);
    }
  }
}

export async function collectFiles(inputPaths, options = {}) {
  const maxFiles = Number.isInteger(options.maxFiles) ? options.maxFiles : 5000;
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
      await walk(absolute, found, skipped, maxFiles, 'text');
    } else {
      const skillDirectories = [];
      await findSkillDirectories(absolute, skillDirectories, skipped);
      if (skillDirectories.length) {
        for (const skillDirectory of skillDirectories) await walk(skillDirectory, found, skipped, maxFiles, 'text');
      } else {
        // Useful fallback for explicitly supplied folders that are not Agent Skills bundles.
        await walk(absolute, found, skipped, maxFiles, 'text');
      }
    }
  }

  const unique = [...new Set(found)];
  const files = [];
  for (const filePath of unique) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > (options.maxFileBytes ?? MAX_FILE_BYTES)) {
        skipped.push({ file: filePath, reason: `File exceeds ${options.maxFileBytes ?? MAX_FILE_BYTES} bytes.` });
        continue;
      }
      const content = await fs.readFile(filePath, 'utf8');
      if (content.includes('\u0000')) {
        skipped.push({ file: filePath, reason: 'Binary or null-byte content was skipped.' });
        continue;
      }
      files.push({ filePath, content });
    } catch (error) {
      skipped.push({ file: filePath, reason: `Cannot read file: ${error.message}` });
    }
  }

  return { files, skipped, roots };
}

export async function collectBundlePaths(root, options = {}) {
  const absolute = path.resolve(root);
  const stat = await fs.lstat(absolute);
  if (stat.isSymbolicLink()) throw new Error('Refusing to create an integrity lock through a symbolic link.');
  const directory = stat.isDirectory() ? absolute : path.dirname(absolute);
  const files = [];
  const skipped = [];
  if (stat.isFile()) files.push(absolute);
  else await walk(directory, files, skipped, options.maxFiles ?? 10000, 'all');
  return { root: directory, files, skipped };
}
