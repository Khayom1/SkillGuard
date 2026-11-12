import { RULES } from './rules.js';

const COLOR = {
  reset: '\u001b[0m', bold: '\u001b[1m', red: '\u001b[31m', yellow: '\u001b[33m', cyan: '\u001b[36m', green: '\u001b[32m', gray: '\u001b[90m'
};

function paint(text, color, enabled) { return enabled ? `${COLOR[color]}${text}${COLOR.reset}` : text; }

export function formatText(report, options = {}) {
  const color = options.color === true;
  const { summary } = report;
  const lines = [];
  lines.push(`${paint('SkillGuard', 'bold', color)} ${paint('Security audit', 'gray', color)}`);
  lines.push(`${paint(`${summary.score}/100`, summary.score >= 80 ? 'green' : summary.score >= 60 ? 'yellow' : 'red', color)}  Grade ${summary.grade}  ·  ${summary.filesScanned} files  ·  ${summary.findings} findings`);
  lines.push(`Critical ${summary.critical}  High ${summary.high}  Medium ${summary.medium}  Low ${summary.low}  ·  ${summary.skipped} skipped  ·  ${summary.complete ? 'complete' : 'incomplete'}`);
  lines.push('');
  if (!report.findings.length) lines.push(paint('No findings matched SkillGuard rules.', 'green', color));
  for (const item of report.findings) {
    const severityColor = item.severity === 'critical' || item.severity === 'high' ? 'red' : item.severity === 'medium' ? 'yellow' : 'cyan';
    lines.push(`${paint(item.severity.toUpperCase(), severityColor, color)} ${paint(item.ruleId, 'bold', color)} ${item.file}:${item.line}`);
    lines.push(`  ${item.message}`);
    if (item.snippet) lines.push(`  ${paint(item.snippet, 'gray', color)}`);
  }
  if (report.skipped.length) {
    lines.push('');
    lines.push(`${report.skipped.length} skipped item(s):`);
    for (const item of report.skipped.slice(0, 20)) lines.push(`  ${item.file}: ${item.reason}`);
    if (report.skipped.length > 20) lines.push(`  …and ${report.skipped.length - 20} more`);
  }
  if (report.provenance?.git?.commit) {
    lines.push(paint(`Local git ${report.provenance.git.commit.slice(0, 12)} · scanner ${report.provenance.scannerVersion}`, 'gray', color));
  }
  lines.push('');
  lines.push(paint('Note: SkillGuard is rule-based static analysis, not proof that a skill is safe or malicious.', 'gray', color));
  return lines.join('\n');
}

export function toMarkdown(report) {
  const { summary } = report;
  const lines = [];
  lines.push('# SkillGuard security audit');
  lines.push('');
  lines.push(`- Score: **${summary.score}/100** (grade ${summary.grade})`);
  lines.push(`- Files: ${summary.filesScanned}`);
  lines.push(`- Findings: ${summary.findings} (critical ${summary.critical}, high ${summary.high}, medium ${summary.medium}, low ${summary.low})`);
  lines.push(`- Skipped: ${summary.skipped} · ${summary.complete ? 'complete' : 'incomplete'}`);
  if (summary.suppressed) lines.push(`- Suppressed by baseline: ${summary.suppressed}`);
  if (report.provenance) {
    lines.push(`- Scanner: ${report.provenance.scannerVersion}`);
    lines.push(`- Scanned at: ${report.provenance.scannedAt}`);
    if (report.provenance.git?.commit) lines.push(`- Local git: \`${report.provenance.git.commit}\`${report.provenance.git.ref ? ` (${report.provenance.git.ref})` : ''}`);
  }
  lines.push('');
  if (!report.findings.length) lines.push('No findings matched SkillGuard rules.');
  for (const item of report.findings) {
    lines.push(`## ${item.severity.toUpperCase()} ${item.ruleId}`);
    lines.push('');
    lines.push(`- Location: \`${item.file}:${item.line}\``);
    lines.push(`- Confidence: ${item.confidence ?? 'heuristic'} (${item.evidence ?? 'static-pattern'})`);
    lines.push(`- ${item.message}`);
    if (item.snippet) lines.push('');
    if (item.snippet) lines.push('```');
    if (item.snippet) lines.push(item.snippet);
    if (item.snippet) lines.push('```');
    lines.push('');
  }
  if (report.skipped?.length) {
    lines.push('## Skipped');
    lines.push('');
    for (const item of report.skipped.slice(0, 20)) lines.push(`- \`${item.file}\`: ${item.reason}`);
  }
  lines.push('');
  lines.push('> SkillGuard is heuristic static analysis. A clean report does not prove a skill is safe.');
  return lines.join('\n');
}

export function toSarif(report) {
  const rules = RULES.map((rule) => ({
    id: rule.id,
    name: rule.name,
    shortDescription: { text: rule.short },
    fullDescription: { text: rule.description },
    defaultConfiguration: { level: rule.severity === 'critical' || rule.severity === 'high' ? 'error' : rule.severity === 'medium' ? 'warning' : 'note' },
    properties: { tags: ['security', 'ai-agent-skills'], precision: 'medium' }
  }));
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'SkillGuard', semanticVersion: report.version, informationUri: 'https://github.com/Khayom1/SkillGuard', rules } },
      results: report.findings.map((finding) => ({
        ruleId: finding.ruleId,
        level: finding.severity === 'critical' || finding.severity === 'high' ? 'error' : finding.severity === 'medium' ? 'warning' : 'note',
        message: { text: finding.message },
        locations: [{ physicalLocation: {
          artifactLocation: { uri: finding.file.replaceAll('\\', '/') },
          region: { startLine: Math.max(1, finding.line) }
        } }],
        partialFingerprints: { primaryLocationLineHash: `${finding.ruleId}:${finding.file}:${finding.line}` },
        properties: { confidence: finding.confidence ?? 'heuristic', evidence: finding.evidence ?? 'static-pattern' }
      })),
      properties: { score: report.summary.score, filesScanned: report.summary.filesScanned, scanComplete: report.summary.complete, skipped: report.summary.skipped }
    }]
  };
}
