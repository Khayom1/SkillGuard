import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { collectBundlePaths } from './files.js';
import { VERSION } from './version.js';

const LOCK_VERSION = 1;
const DEFAULT_MAX_TOTAL_BYTES = 256 * 1024 * 1024;

export async function createIntegrityLock(rootPath, options = {}) {
  const { root, files, skipped } = await collectBundlePaths(rootPath, options);
  const excluded = new Set((options.exclude ?? []).map((item) => path.resolve(item)));
  const entries = [];
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  if (!Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 1) throw new Error('maxTotalBytes must be a positive safe integer.');
  let totalBytes = 0;
  for (const filePath of files) {
    if (excluded.has(path.resolve(filePath))) continue;
    const stat = await fs.lstat(filePath);
    if (stat.isSymbolicLink()) throw new Error('A symbolic link appeared during lock creation; retry after removing it.');
    const maxFileBytes = options.maxFileBytes ?? 100 * 1024 * 1024;
    if (stat.size > maxFileBytes) {
      skipped.push({ file: filePath, reason: `File exceeds ${maxFileBytes} bytes.` });
      continue;
    }
    if (totalBytes + stat.size > maxTotalBytes) throw new Error(`Integrity lock total size limit (${maxTotalBytes} bytes) would be exceeded.`);
    const bytes = await fs.readFile(filePath);
    totalBytes += bytes.byteLength;
    entries.push({
      path: path.relative(root, filePath).split(path.sep).join('/'),
      size: bytes.byteLength,
      mode: (stat.mode & 0o777).toString(8),
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    });
  }
  if (skipped.length) throw new Error(`Cannot create a reliable lock: ${skipped.length} file-system item(s) were skipped (for example, symbolic links, oversized files, or unreadable paths).`);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return {
    schemaVersion: LOCK_VERSION,
    tool: { name: 'SkillGuard', version: VERSION },
    files: entries,
    skipped
  };
}

export async function verifyIntegrityLock(rootPath, lock, options = {}) {
  if (!lock || lock.schemaVersion !== LOCK_VERSION || !Array.isArray(lock.files)) {
    throw new Error('Invalid SkillGuard lock file: expected schemaVersion 1 and a files array.');
  }
  const maxFiles = options.maxFiles ?? 10000;
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw new Error('maxFiles must be a positive integer.');
  if (lock.files.length > maxFiles) throw new Error(`Invalid SkillGuard lock file: file count exceeds limit (${maxFiles}).`);
  const seenPaths = new Set();
  for (const entry of lock.files) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid SkillGuard lock file: each file entry must be an object.');
    const file = entry.path;
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('\\') || file.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error('Invalid SkillGuard lock file: file paths must be normalized relative paths.');
    }
    if (seenPaths.has(file)) throw new Error(`Invalid SkillGuard lock file: duplicate path "${file}".`);
    seenPaths.add(file);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sha256) || typeof entry.mode !== 'string' || !/^[0-7]{3,4}$/.test(entry.mode)) {
      throw new Error(`Invalid SkillGuard lock file: invalid metadata for "${file}".`);
    }
  }
  const excluded = new Set((options.exclude ?? []).map((item) => path.resolve(item)));
  const current = await createIntegrityLock(rootPath, { ...options, exclude: [...excluded] });
  const expectedByPath = new Map(lock.files.map((entry) => [entry.path, entry]));
  const currentByPath = new Map(current.files.map((entry) => [entry.path, entry]));
  const changed = [];
  const added = [];
  const missing = [];

  for (const [file, entry] of currentByPath) {
    const expected = expectedByPath.get(file);
    if (!expected) added.push(file);
    else if (expected.sha256 !== entry.sha256 || expected.size !== entry.size || expected.mode !== entry.mode) changed.push({ path: file, expected: { sha256: expected.sha256, size: expected.size, mode: expected.mode }, actual: { sha256: entry.sha256, size: entry.size, mode: entry.mode } });
  }
  for (const file of expectedByPath.keys()) if (!currentByPath.has(file)) missing.push(file);

  return {
    valid: changed.length === 0 && added.length === 0 && missing.length === 0,
    summary: { expected: expectedByPath.size, current: currentByPath.size, changed: changed.length, added: added.length, missing: missing.length },
    changed,
    added: added.sort(),
    missing: missing.sort(),
    skipped: current.skipped
  };
}
