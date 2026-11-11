import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { collectBundlePaths } from './files.js';
import { VERSION } from './version.js';

const LOCK_VERSION = 1;

export async function createIntegrityLock(rootPath, options = {}) {
  const { root, files, skipped } = await collectBundlePaths(rootPath, options);
  const excluded = new Set((options.exclude ?? []).map((item) => path.resolve(item)));
  const entries = [];
  for (const filePath of files) {
    if (excluded.has(path.resolve(filePath))) continue;
    const stat = await fs.lstat(filePath);
    if (stat.isSymbolicLink()) throw new Error('A symbolic link appeared during lock creation; retry after removing it.');
    const maxFileBytes = options.maxFileBytes ?? 100 * 1024 * 1024;
    if (stat.size > maxFileBytes) {
      skipped.push({ file: filePath, reason: `File exceeds ${maxFileBytes} bytes.` });
      continue;
    }
    const bytes = await fs.readFile(filePath);
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
