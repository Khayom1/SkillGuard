import test from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from '../src/version.js';

test('runtime version is sourced from package metadata', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(VERSION, '0.1.0');
});
