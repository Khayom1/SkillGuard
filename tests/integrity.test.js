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
