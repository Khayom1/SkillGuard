import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectFiles } from '../src/files.js';
import { readRegularFile } from '../src/safe-fs.js';

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

test('limits directory traversal during skill discovery', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-dir-limit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const name of ['a', 'b', 'c']) {
    await fs.mkdir(path.join(root, name));
    await fs.writeFile(path.join(root, name, 'note.txt'), name);
  }
  const result = await collectFiles([root], { maxDirectories: 2 });
  assert.ok(result.skipped.some((item) => /Directory limit \(2\) reached/.test(item.reason)));
});

test('rejects invalid traversal limits', async () => {
  await assert.rejects(() => collectFiles(['.'], { maxDirectories: 0 }), /limits must be positive/i);
});

test('handles empty files and Unicode filenames without crashing', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-unicode-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const empty = path.join(root, 'empty.md');
  const unicode = path.join(root, 'тест-技能-🛡️.md');
  await fs.writeFile(empty, '');
  await fs.writeFile(unicode, '# safe content');
  const result = await collectFiles([root]);
  assert.equal(result.files.length, 2);
  assert.equal(result.skipped.length, 0);
});

test('skips binary files containing null bytes', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-binary-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'payload.txt');
  await fs.writeFile(file, Buffer.from([0x41, 0x00, 0x42]));
  const result = await collectFiles([file]);
  assert.equal(result.files.length, 0);
  assert.ok(result.skipped.some((item) => /Binary or null-byte/.test(item.reason)));
});

test('skips oversized files and rejects invalid maxFileBytes values', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-size-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'large.md');
  await fs.writeFile(file, '1234567890');
  const result = await collectFiles([file], { maxFileBytes: 5 });
  assert.equal(result.files.length, 0);
  assert.ok(result.skipped.some((item) => /exceeds 5 bytes/.test(item.reason)));
  await assert.rejects(() => collectFiles([file], { maxFileBytes: 0 }), /limits must be positive/i);
  await assert.rejects(() => collectFiles([file], { maxFileBytes: Number.MAX_SAFE_INTEGER + 1 }), /limits must be positive/i);
});

test('enforces maximum traversal depth', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-depth-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const deep = path.join(root, 'one', 'two', 'three');
  await fs.mkdir(deep, { recursive: true });
  await fs.writeFile(path.join(deep, 'note.md'), 'deep');
  const result = await collectFiles([root], { maxDepth: 1 });
  assert.equal(result.files.length, 0);
  assert.ok(result.skipped.some((item) => /Directory depth limit/.test(item.reason)));
});

test('handles a large directory while respecting the file cap', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-many-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (let index = 0; index < 300; index += 1) {
    await fs.writeFile(path.join(root, `file-${String(index).padStart(4, '0')}.md`), `# file ${index}`);
  }
  const result = await collectFiles([root], { maxFiles: 75 });
  assert.equal(result.files.length, 75);
  assert.ok(result.skipped.some((item) => /File limit \(75\) reached/.test(item.reason)));
});



test('safe file reads reject symlinks and non-regular files', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-safe-read-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'target.md');
  const link = path.join(root, 'link.md');
  await fs.writeFile(target, 'safe content');
  await fs.symlink(target, link);
  await assert.rejects(() => readRegularFile(link), /symbolic link/i);
  await assert.rejects(() => readRegularFile(root), /non-regular file/i);
});

test('safe file reads enforce byte limits before allocating file contents', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-safe-size-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'large.md');
  await fs.writeFile(file, '1234567890');
  const result = await readRegularFile(file, { maxBytes: 5 });
  assert.equal(result.oversized, true);
  assert.equal(result.bytes, null);
  assert.equal(result.stat.size, 10);
});

test('reports unsupported binary assets instead of silently claiming full text coverage', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-unsupported-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'SKILL.md'), '---\nname: asset-skill\ndescription: A skill with an asset.\n---\n');
  await fs.writeFile(path.join(root, 'diagram.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const result = await collectFiles([root]);
  assert.equal(result.files.length, 1);
  assert.ok(result.skipped.some((item) => item.file.endsWith('diagram.png') && /unsupported file type/i.test(item.reason)));
});

test('safe file reads refuse canonical paths outside the selected root', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-boundary-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  const file = path.join(outside, 'secret.md');
  await fs.writeFile(file, 'outside content');
  await assert.rejects(() => readRegularFile(file, { allowedRoot: root }), /outside the scan root/i);
});

test('reports dependency and build directories excluded by the text scan policy', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-excluded-dir-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'SKILL.md'), '---\nname: sample-skill\ndescription: Example skill.\n---\n');
  await fs.mkdir(path.join(root, 'node_modules', 'example'), { recursive: true });
  await fs.writeFile(path.join(root, 'node_modules', 'example', 'index.js'), 'eval(input);');
  const result = await collectFiles([root]);
  assert.ok(result.skipped.some((item) => item.file.endsWith('node_modules') && /excluded by scan policy/i.test(item.reason)));
});
