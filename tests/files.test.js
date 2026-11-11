import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectFiles } from '../src/files.js';

test('enforces maxFiles across multiple explicit file inputs', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-files-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const first = path.join(root, 'first.md');
  const second = path.join(root, 'second.md');
  await fs.writeFile(first, '# first');
  await fs.writeFile(second, '# second');

  const result = await collectFiles([first, second], { maxFiles: 1 });
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].filePath, first);
  assert.ok(result.skipped.some((item) => item.file === second && /File limit/.test(item.reason)));
});



test('reports skill directories omitted after the file limit is reached', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-bundle-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const first = path.join(root, 'alpha');
  const second = path.join(root, 'beta');
  await fs.mkdir(first);
  await fs.mkdir(second);
  await fs.writeFile(path.join(first, 'SKILL.md'), ['---', 'name: alpha', 'description: first skill', '---', ''].join('\n'));
  await fs.writeFile(path.join(second, 'SKILL.md'), ['---', 'name: beta', 'description: second skill', '---', ''].join('\n'));

  const result = await collectFiles([root], { maxFiles: 1 });
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].filePath, path.join(first, 'SKILL.md'));
  assert.ok(result.skipped.some((item) => item.file === second && item.reason.includes('File limit (1) reached')));
});

test('reports symbolic links discovered while locating nested skills', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-symlink-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const skills = path.join(root, 'skills');
  const outside = path.join(root, 'outside');
  await fs.mkdir(skills);
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'SKILL.md'), '---\nname: outside\ndescription: Outside skill.\n---\n');
  await fs.symlink(outside, path.join(skills, 'linked-skill'), 'dir');

  const result = await collectFiles([skills]);
  assert.equal(result.files.length, 0);
  assert.ok(result.skipped.some((item) => item.file === path.join(skills, 'linked-skill') && /symbolic link/i.test(item.reason)));
});
