import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'src', 'cli.js');
const run = (args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });

test('CLI prints help', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /security auditing/i);
});

test('CLI emits parseable JSON for a safe skill', () => {
  const result = run(['examples/safe-skill', '--format', 'json', '--fail-on', 'none']);
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.tool, 'SkillGuard');
  assert.ok(parsed.summary.filesScanned >= 1);
});

test('CLI detects the intentionally unsafe example fixture', () => {
  const result = run(['examples/risky-skill', '--format', 'json', '--fail-on', 'high']);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.ok(report.findings.some((item) => item.ruleId === 'SG003'));
  assert.ok(report.findings.some((item) => item.ruleId === 'SG006'));
});

test('CLI rejects unknown options', () => {
  const result = run(['--not-a-real-option']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown option/i);
});

test('CLI creates, verifies, then detects integrity drift', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-cli-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const skill = path.join(temp, 'demo-skill');
  await fs.mkdir(skill);
  await fs.writeFile(path.join(skill, 'SKILL.md'), '---\nname: demo-skill\ndescription: Demo skill.\n---\n');
  const locked = spawnSync(process.execPath, [cli, 'lock', skill], { cwd: root, encoding: 'utf8' });
  assert.equal(locked.status, 0, locked.stderr);
  const verified = spawnSync(process.execPath, [cli, 'verify', skill], { cwd: root, encoding: 'utf8' });
  assert.equal(verified.status, 0, verified.stderr);
  await fs.writeFile(path.join(skill, 'SKILL.md'), 'modified after review');
  const drift = spawnSync(process.execPath, [cli, 'verify', skill], { cwd: root, encoding: 'utf8' });
  assert.equal(drift.status, 1);
  assert.match(drift.stdout, /DRIFT DETECTED/);
});

test('CLI accepts directory traversal limits and rejects invalid values', () => {
  const valid = run(['--help']);
  assert.equal(valid.status, 0);
  const invalid = run(['--max-directories', '0']);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /--max-directories/i);
});

test('fails closed when a scan skips files unless explicitly allowed', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-incomplete-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(temp, 'SKILL.md'),
    '---\nname: demo-skill\ndescription: A small test skill.\n---\n'
  );
  await fs.writeFile(path.join(temp, 'reference.md'), 'x'.repeat(256));

  const strict = run([temp, '--format', 'json', '--max-file-bytes', '100', '--fail-on', 'none']);
  assert.equal(strict.status, 2);
  const strictReport = JSON.parse(strict.stdout);
  assert.equal(strictReport.summary.complete, false);
  assert.ok(strictReport.summary.skipped >= 1);
  assert.match(strict.stderr, /scan incomplete/i);

  const permissive = run([temp, '--format', 'json', '--max-file-bytes', '100', '--fail-on', 'none', '--allow-skipped']);
  assert.equal(permissive.status, 0, permissive.stderr);
  const permissiveReport = JSON.parse(permissive.stdout);
  assert.equal(permissiveReport.summary.complete, false);
});
