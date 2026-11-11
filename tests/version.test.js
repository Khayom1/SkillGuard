import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VERSION } from '../src/version.js';

test('runtime version matches package metadata', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(VERSION, packageJson.version);
});
