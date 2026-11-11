import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createIntegrityLock, verifyIntegrityLock } from '../src/integrity.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'scripts'));
  await fs.writeFile(path.join(root, 'SKILL.md'), '---\nname: demo\ndescription: Demo skill.\n---\n');
  await fs.writeFile(path.join(root, 'scripts', 'run.sh'), '#!/bin/sh\necho ok\n');
  await fs.writeFile(path.join(root, 'asset.bin'), Buffer.from([0, 1, 2, 255]));
  return root;
}

test('integrity lock verifies unchanged text and binary assets', async (t) => {
  const root = await fixture(t);
  const lockPath = path.join(root, '.skillguard.lock.json');
  const lock = await createIntegrityLock(root, { exclude: [lockPath] });
  await fs.writeFile(lockPath, JSON.stringify(lock));
  const result = await verifyIntegrityLock(root, lock, { exclude: [lockPath] });
  assert.equal(result.valid, true);
  assert.equal(result.summary.expected, 3);
});

test('integrity verification reports modified, added, and missing files', async (t) => {
  const root = await fixture(t);
  const lock = await createIntegrityLock(root);
  await fs.writeFile(path.join(root, 'scripts', 'run.sh'), '#!/bin/sh\necho changed\n');
  await fs.writeFile(path.join(root, 'new.txt'), 'new');
  await fs.rm(path.join(root, 'asset.bin'));
  const result = await verifyIntegrityLock(root, lock);
  assert.equal(result.valid, false);
  assert.equal(result.summary.changed, 1);
  assert.equal(result.summary.added, 1);
  assert.equal(result.summary.missing, 1);
});

test('lock creation refuses symlinks rather than silently omitting them', async (t) => {
  const root = await fixture(t);
  const target = path.join(root, 'secret.txt');
  await fs.writeFile(target, 'not followed');
  await fs.symlink(target, path.join(root, 'linked-secret.txt'));
  await assert.rejects(() => createIntegrityLock(root), /cannot create a reliable lock/i);
});

test('integrity verification detects file permission changes', async (t) => {
  const root = await fixture(t);
  const script = path.join(root, 'scripts', 'run.sh');
  await fs.chmod(script, 0o755);
  const lock = await createIntegrityLock(root);
  await fs.chmod(script, 0o644);
  const result = await verifyIntegrityLock(root, lock);
  assert.equal(result.valid, false);
  assert.equal(result.summary.changed, 1);
});

test('rejects unsafe and duplicate paths in integrity locks', async (t) => {
  const root = await fixture(t);
  const lock = await createIntegrityLock(root);
  const unsafe = structuredClone(lock);
  unsafe.files[0].path = '../outside.txt';
  await assert.rejects(() => verifyIntegrityLock(root, unsafe), /normalized relative paths/i);
  const duplicate = structuredClone(lock);
  duplicate.files.push({ ...duplicate.files[0] });
  await assert.rejects(() => verifyIntegrityLock(root, duplicate), /duplicate path/i);
});

test('enforces a total byte budget while creating integrity locks', async (t) => {
  const root = await fixture(t);
  await assert.rejects(() => createIntegrityLock(root, { maxTotalBytes: 8 }), /total size limit/i);
});

test('rejects invalid maxFileBytes limits before reading files', async (t) => {
  const root = await fixture(t);
  await assert.rejects(() => createIntegrityLock(root, { maxFileBytes: 0 }), /maxFileBytes must be a positive safe integer/i);
  await assert.rejects(() => createIntegrityLock(root, { maxFileBytes: Number.MAX_SAFE_INTEGER + 1 }), /maxFileBytes must be a positive safe integer/i);
});

test('rejects malformed lock metadata and excessive lock entries', async (t) => {
  const root = await fixture(t);
  const lock = await createIntegrityLock(root);
  const badSize = structuredClone(lock);
  badSize.files[0].size = -1;
  await assert.rejects(() => verifyIntegrityLock(root, badSize), /invalid metadata/i);
  const badHash = structuredClone(lock);
  badHash.files[0].sha256 = 'not-a-hash';
  await assert.rejects(() => verifyIntegrityLock(root, badHash), /invalid metadata/i);
  await assert.rejects(() => verifyIntegrityLock(root, lock, { maxFiles: 2 }), /file count exceeds limit/i);
});

test('handles empty files and unusual filenames in integrity locks', async (t) => {
  const root = await fixture(t);
  const unusual = path.join(root, 'файл-技能-🛡️.dat');
  await fs.writeFile(unusual, '');
  const lock = await createIntegrityLock(root);
  const result = await verifyIntegrityLock(root, lock);
  assert.equal(result.valid, true);
  assert.ok(lock.files.some((entry) => entry.path.includes('файл-技能-🛡️.dat') && entry.size === 0));
});

test('integrity locks include dependency files but exclude Git metadata', async (t) => {
  const root = await fixture(t);
  const dependency = path.join(root, 'node_modules', 'demo', 'index.js');
  const gitFile = path.join(root, '.git', 'config');
  await fs.mkdir(path.dirname(dependency), { recursive: true });
  await fs.mkdir(path.dirname(gitFile), { recursive: true });
  await fs.writeFile(dependency, 'module.exports = 1;');
  await fs.writeFile(gitFile, '[core]');
  const lock = await createIntegrityLock(root);
  assert.ok(lock.files.some((item) => item.path === 'node_modules/demo/index.js'));
  assert.equal(lock.files.some((item) => item.path.startsWith('.git/')), false);
});
