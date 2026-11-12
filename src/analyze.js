import { analyzeFile as baseAnalyzeFile, createReport, getRule } from './scanner.js';
import { analyzeDataFlow } from './dataflow.js';
import { applyRulePacks } from './packs.js';
import { RULES } from './rules.js';

const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

/**
 * Full file analysis: core scanner + SG022 data-flow + optional custom packs.
 */
export function analyzeFile(input, options = {}) {
  const findings = baseAnalyzeFile(input);
  const filePath = input.filePath ? String(input.filePath).split('\\').join('/') : '<input>';
  const text = String(input.content ?? '');

  for (const item of analyzeDataFlow({ filePath, content: text })) {
    const rule = RULE_BY_ID.get('SG022');
    if (rule) {
      findings.push({
        ruleId: 'SG022',
        ruleName: rule.name,
        severity: rule.severity,
        message: item.message,
        file: filePath,
        line: item.line,
        snippet: String(item.snippet ?? '').trim().slice(0, 180)
      });
    }
  }

  if (options.packs?.length) {
    findings.push(...applyRulePacks(text, filePath, options.packs));
  }

  return findings;
}

export { createReport, getRule };
