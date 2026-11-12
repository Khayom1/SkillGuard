import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { readRegularFile } from './safe-fs.js';

function findingKey(finding) {
  return [finding.ruleId, finding.file, String(finding.line), finding.message].join('|');
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function createBaselineDocument({ findings = [], reason = '', author = '', version = '1' } = {}) {
  const accepted = findings.map((finding) => {
    const key = findingKey(finding);
    return {
      id: hashKey(key),
      ruleId: finding.ruleId,
      file: finding.file,
      line: finding.line,
      message: finding.message,
      severity: finding.severity,
      acceptedAt: new Date().toISOString(),
      reason: reason || 'Accepted after manual review',
      author: author || ''
    };
  });
  return {
    schemaVersion: 1,
    tool: 'SkillGuard',
    version,
    createdAt: new Date().toISOString(),
    accepted
  };
}

export async function loadBaseline(filePath) {
  const absolute = path.resolve(filePath);
  const result = await readRegularFile(absolute, { maxBytes: 8 * 1024 * 1024 });
  if (result.oversized) throw new Error('Baseline file exceeds size limit.');
  const doc = JSON.parse(result.bytes.toString('utf8'));
  if (!doc || doc.schemaVersion !== 1 || !Array.isArray(doc.accepted)) {
    throw new Error('Baseline file is missing schemaVersion=1 or accepted[].');
  }
  return doc;
}

export async function writeBaseline(filePath, document) {
  const absolute = path.resolve(filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return absolute;
}

/**
 * Apply baseline: findings matching accepted entries are moved to suppressed[].
 * Matching is by ruleId + file + line + message (stable key).
 */
export function applyBaseline(findings, baselineDoc) {
  if (!baselineDoc?.accepted?.length) {
    return { active: findings, suppressed: [] };
  }
  const acceptedKeys = new Set(baselineDoc.accepted.map((item) => findingKey(item)));
  const active = [];
  const suppressed = [];
  for (const finding of findings) {
    const key = findingKey(finding);
    if (acceptedKeys.has(key)) suppressed.push({ ...finding, suppressedByBaseline: true });
    else active.push(finding);
  }
  return { active, suppressed };
}

export function baselineStats(baselineDoc) {
  return {
    accepted: baselineDoc?.accepted?.length ?? 0,
    createdAt: baselineDoc?.createdAt ?? null
  };
}
