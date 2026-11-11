import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('synthetic benchmark corpus has no known regressions', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'benchmark.mjs')], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, `${result.stdout}\\n${result.stderr}`);
  assert.match(result.stdout, /Synthetic regression corpus: PASS/);
});
