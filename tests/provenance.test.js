import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildProvenance, readLocalGitRevision } from '../src/provenance.js';

test('reads a local git HEAD without invoking git', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillguard-git-'));
  const git = path.join(root, '.git');
  const commit = 'a'.repeat(40);
  await fs.mkdir(path.join(git, 'refs', 'heads'), { recursive: true });
  await fs.writeFile(path.join(git, 'HEAD'), 'ref: refs/heads/main\n');
  await fs.writeFile(path.join(git, 'refs', 'heads', 'main'), `${commit}\n`);
  const revision = await readLocalGitRevision(root);
  assert.equal(revision.commit, commit);
  assert.equal(revision.ref, 'refs/heads/main');
  assert.equal(revision.source, 'local-git');

  const outside = path.join(git, 'refs', 'heads', '..', '..', '..', 'secret');
  await fs.writeFile(path.join(git, 'HEAD'), `ref: ${path.relative(git, outside)}\n`);
  const rejected = await readLocalGitRevision(root);
  assert.equal(rejected, null);
});

test('records scanner version and inspected-text hashes', async () => {
  const provenance = await buildProvenance({
    roots: [],
    files: [{ filePath: 'skill/SKILL.md', content: 'hello' }]
  });
  assert.equal(typeof provenance.scannerVersion, 'string');
  assert.equal(provenance.contentHashes.length, 1);
  assert.equal(provenance.contentHashes[0].sha256.length, 64);
  assert.match(provenance.notes.join(' '), /not a safety certification/i);
});
