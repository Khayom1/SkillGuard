import path from 'node:path';
import { readRegularFile } from './safe-fs.js';

/**
 * Load a SkillGuard rule pack (JSON).
 * Schema:
 * {
 *   schemaVersion: 1,
 *   name: string,
 *   rules: [{ id, severity, message, pattern, flags? }]
 * }
 * Patterns are JavaScript RegExp sources, evaluated offline only.
 */
export async function loadRulePack(filePath) {
  const absolute = path.resolve(filePath);
  const result = await readRegularFile(absolute, { maxBytes: 2 * 1024 * 1024 });
  if (result.oversized) throw new Error('Rule pack exceeds size limit.');
  const doc = JSON.parse(result.bytes.toString('utf8'));
  if (!doc || doc.schemaVersion !== 1 || !Array.isArray(doc.rules)) {
    throw new Error('Rule pack must have schemaVersion=1 and rules[].');
  }
  const compiled = [];
  for (const rule of doc.rules) {
    if (!rule?.id || !rule?.pattern || !rule?.severity || !rule?.message) {
      throw new Error('Each pack rule requires id, pattern, severity, message.');
    }
    if (!/^[A-Za-z0-9._-]{2,64}$/.test(rule.id)) {
      throw new Error(`Invalid pack rule id: ${rule.id}`);
    }
    if (!['critical', 'high', 'medium', 'low'].includes(rule.severity)) {
      throw new Error(`Invalid severity for pack rule ${rule.id}`);
    }
    let regex;
    try {
      regex = new RegExp(rule.pattern, rule.flags ?? 'i');
    } catch (error) {
      throw new Error(`Invalid regex in pack rule ${rule.id}: ${error.message}`);
    }
    compiled.push({
      id: rule.id,
      severity: rule.severity,
      message: rule.message,
      name: rule.name ?? rule.id,
      regex
    });
  }
  return { name: doc.name ?? path.basename(absolute), rules: compiled, path: absolute };
}

export function applyRulePacks(text, file, packs) {
  const findings = [];
  if (!packs?.length) return findings;
  const lines = String(text).split(/\r?\n/);
  for (const pack of packs) {
    for (const rule of pack.rules) {
      lines.forEach((line, index) => {
        if (rule.regex.test(line)) {
          findings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `${rule.message} (pack: ${pack.name})`,
            file,
            line: index + 1,
            snippet: line.trim().slice(0, 180),
            pack: pack.name
          });
        }
      });
    }
  }
  return findings;
}
