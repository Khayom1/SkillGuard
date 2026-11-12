import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { VERSION } from './version.js';

async function readSmallFile(filePath, maxBytes = 4096) {
  let handle;
  try {
    handle = await fs.open(filePath, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes || stat.size < 1) return null;
    const buffer = Buffer.alloc(stat.size);
    await handle.read(buffer, 0, stat.size, 0);
    return buffer.toString('utf8');
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

function insideDir(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
}

/**
 * Read HEAD from a local .git directory. Never runs git and never contacts a remote.
 */
export async function readLocalGitRevision(startPath) {
  let current = path.resolve(startPath);
  for (let depth = 0; depth < 8; depth += 1) {
    const gitPath = path.join(current, '.git');
    let gitDir = null;
    try {
      const stat = await fs.lstat(gitPath);
      if (stat.isDirectory()) gitDir = gitPath;
      else if (stat.isFile()) {
        const pointer = await readSmallFile(gitPath);
        const match = pointer && /^gitdir:\s*(.+)\s*$/m.exec(pointer);
        if (match) gitDir = path.resolve(current, match[1].trim());
      }
    } catch {
      gitDir = null;
    }
    if (gitDir) {
      const head = await readSmallFile(path.join(gitDir, 'HEAD'));
      if (!head) return null;
      const trimmed = head.trim();
      if (/^[0-9a-f]{40}$/i.test(trimmed)) return { commit: trimmed.toLowerCase(), ref: null, source: 'local-git' };
      const refMatch = /^ref:\s*([^\s]+)$/.exec(trimmed);
      if (!refMatch) return null;
      const ref = refMatch[1];
      if (ref.includes('..') || path.isAbsolute(ref)) return null;
      const refFile = path.resolve(gitDir, ref);
      if (!insideDir(gitDir, refFile)) return null;
      const commitText = (await readSmallFile(refFile) ?? '').trim();
      const commit = /^[0-9a-f]{40}$/i.test(commitText) ? commitText.toLowerCase() : null;
      return { commit, ref, source: 'local-git' };
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

export async function buildProvenance({ roots = [], files = [] } = {}) {
  const start = roots[0] ? path.resolve(roots[0]) : process.cwd();
  let gitRoot = start;
  try {
    const stat = await fs.stat(start);
    if (!stat.isDirectory()) gitRoot = path.dirname(start);
  } catch {
    gitRoot = process.cwd();
  }
  const git = await readLocalGitRevision(gitRoot);
  const contentHashes = [];
  for (const file of files) {
    if (contentHashes.length >= 2000) break;
    const text = String(file.content ?? '');
    contentHashes.push({
      file: String(file.filePath ?? '').split(path.sep).join('/'),
      sha256: crypto.createHash('sha256').update(text).digest('hex'),
      bytes: Buffer.byteLength(text)
    });
  }
  return {
    scannedAt: new Date().toISOString(),
    scannerVersion: VERSION,
    git,
    contentHashes,
    notes: [
      'Hashes cover inspected text exactly as scanned. They are not a signed attestation of original on-disk bytes.',
      'The Git revision is read from a local .git directory only. No remote is contacted.',
      'A clean scan is not a safety certification.'
    ]
  };
}
