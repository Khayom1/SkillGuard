import path from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { RULES, SCORE_PENALTY } from './rules.js';

const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));
const SECRET_PATTERNS = [
  { regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, label: 'private key block' },
  { regex: /\bAKIA[0-9A-Z]{16}\b/g, label: 'AWS access key ID' },
  { regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, label: 'GitHub token' },
  { regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, label: 'GitHub fine-grained token' },
  { regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g, label: 'API-key-like token' },
  { regex: /\b(?:xox[baprs]-)[A-Za-z0-9-]{10,}\b/g, label: 'Slack token' }
];

function addFinding(findings, file, line, ruleId, message, snippet = '', extra = {}) {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) return;
  findings.push({
    ruleId,
    ruleName: rule.name,
    severity: rule.severity,
    message,
    file,
    line,
    snippet: String(snippet).trim().slice(0, 180),
    ...extra
  });
}

function isLikelyCode(file) {
  return /\.(?:sh|bash|zsh|ps1|bat|cmd|js|mjs|cjs|ts|tsx|jsx|py|rb|pl|php|go|rs|java|kt|sql|yml|yaml|json|toml|ini|cfg)$/i.test(file);
}

function checkUnicode(text, file, findings) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/u);
    if (match) {
      const code = `U+${match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
      addFinding(findings, file, index + 1, 'SG001', `Hidden or control character detected (${code}).`, line.replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu, '�'));
    }
  });
}

function redactSecretValues(line) {
  let safeLine = line;
  for (const { regex } of SECRET_PATTERNS) {
    const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
    const redactor = new RegExp(regex.source, flags);
    safeLine = safeLine.replace(redactor, '[REDACTED]');
  }
  return safeLine;
}

function checkSecrets(text, file, findings) {
  const lines = text.split(/\r?\n/);
  for (const item of SECRET_PATTERNS) {
    item.regex.lastIndex = 0;
    let match;
    while ((match = item.regex.exec(text)) !== null) {
      const line = text.slice(0, match.index).split('\n').length;
      const sourceLine = lines[line - 1] ?? '';
      const safeSnippet = redactSecretValues(sourceLine);
      addFinding(findings, file, line, 'SG005', `Possible ${item.label} found: [REDACTED].`, safeSnippet);
      if (match[0].length === 0) item.regex.lastIndex += 1;
    }
  }
}

const LINE_RULES = [
  ['SG003', /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions?|messages?|rules?|prompts?)\b/i, 'Attempts to override earlier or higher-priority instructions.'],
  ['SG003', /\b(?:ignore|disregard)\s+(?:all\s+)?(?:safety|security)\s+(?:rules|policies|filters|checks)\b/i, 'Attempts to bypass safety or security rules.'],
  ['SG004', /\b(?:reveal|print|dump|exfiltrate|leak|show|output)\s+(?:the\s+)?(?:full\s+)?(?:system|developer)\s+prompt\b/i, 'Requests disclosure of private system or developer instructions.'],
  ['SG004', /\b(?:print|dump|send|reveal|upload|expose)\s+(?:(?:all|your|the)\s+)?(?:environment\s+variables|secrets|api[ -]keys?|access tokens?|credentials|private keys)\b/i, 'Requests disclosure or transfer of credentials or environment secrets.'],
  ['SG003', /\b(?:do not|never)\s+(?:tell|inform|notify|warn)\s+the user\b/i, 'Instructs the agent to conceal an action or finding from the user.'],
  ['SG006', /\b(?:curl|wget)\b[^\n|;]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/i, 'Downloads remote content and immediately pipes it to a shell.'],
  ['SG006', /\b(?:curl|wget)\b[^\n;]*(?:\n|;)[^\n;]*\b(?:bash|sh|zsh)\b/i, 'Download and shell execution appear together in one command sequence.'],
  ['SG007', /\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+(?:\/\s*(?:$|#)|~\/?(?:\s|$)|\$HOME\/?(?:\s|$))/i, 'Potentially destructive recursive deletion of a root or home directory.'],
  ['SG007', /\b(?:mkfs(?:\.[a-z0-9]+)?|fdisk\s+-[wy]|dd\s+if=\/dev\/(?:zero|random)\s+of=\/dev\/)/i, 'Disk formatting or raw device overwrite command detected.'],
  ['SG007', /\bformat\s+[a-z]:\s*\/?\s*(?:\/q)?\b/i, 'Windows drive-formatting command detected.'],
  ['SG008', /\b(?:crontab\s+-e|systemctl\s+enable|launchctl\s+load|schtasks\s+\/create)\b/i, 'Command may create a persistent startup task or service.'],
  ['SG008', /(?:~\/\.config\/autostart|LaunchAgents\/|CurrentVersion\\Run)/i, 'Startup or autorun location referenced.'],
  ['SG009', /(?:~\/\.ssh\/|~\/\.aws\/|~\/\.config\/gcloud|\/\.env\b|(?:^|[\s"'])\.env(?:\s|$)|id_rsa|id_ed25519|\/etc\/shadow)/i, 'Sensitive credential store or private-key location referenced.'],
  ['SG010', /\bbase64\s+(?:-d|--decode)\b[^\n|]*\|\s*(?:sh|bash|python\b|node\b)/i, 'Base64-decoded content is piped to an interpreter.'],
  ['SG010', /\b(?:eval\s*\(\s*atob\s*\(|exec\s*\(\s*(?:base64|b64decode)|FromBase64String\s*\([^\n]+\)[\s\S]{0,100}\bIEX\b)/i, 'Encoded content is passed to a dynamic execution function.'],
  ['SG011', /\b(?:printenv|env|set)\b[^\n|;]*(?:\||;)[^\n]*(?:curl|wget|nc\s|ncat|Invoke-WebRequest)\b/i, 'Environment variables may be piped or sent to a network command.'],
  ['SG011', /\b(?:cat|type|Get-Content)\b[^\n]*(?:\.env|id_rsa|\.ssh)[^\n]*(?:\||;)[^\n]*(?:curl|wget|nc\s|Invoke-WebRequest)\b/i, 'Sensitive file content may be sent to a network command.'],
  ['SG012', /\bchmod\s+-R\s+777\b/i, 'Recursive world-writable permissions are being set.'],
  ['SG012', /\b(?:sudo\s+-i|sudo\s+su\b|--privileged\b|runAsNonRoot:\s*false)\b/i, 'Broad elevated privileges are requested or enabled.']
];

function checkLines(text, file, findings) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [ruleId, pattern, message] of LINE_RULES) {
      if (pattern.test(line)) addFinding(findings, file, index + 1, ruleId, message, line);
    }
  });
}

function checkPrompt(text, file, findings) {
  const patterns = [
    /\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above)\s+instructions\b/ig,
    /\b(?:override|replace)\s+(?:the\s+)?(?:system|developer)\s+prompt\b/ig,
    /\bdo\s+not\s+follow\s+(?:the\s+)?(?:system|developer)\s+(?:message|instructions?)\b/ig
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split('\n').length;
      addFinding(findings, file, line, 'SG003', 'Prompt-injection style instruction override detected.', text.split(/\r?\n/)[line - 1] ?? '');
    }
  }
}

export function analyzeFile({ filePath, content }) {
  const file = filePath ? filePath.split(path.sep).join('/') : '<input>';
  const text = String(content ?? '');
  const findings = [];

  checkUnicode(text, file, findings);
  checkSecrets(text, file, findings);
  checkLines(text, file, findings);
  checkPrompt(text, file, findings);

  if (path.basename(file).toLowerCase() === 'skill.md') {
    const parsed = parseFrontmatter(text);
    if (!parsed.valid) {
      for (const error of parsed.errors) addFinding(findings, file, 1, 'SG002', error, text.split(/\r?\n/)[0] ?? '');
    } else {
      const parentName = path.basename(path.dirname(file));
      if (parentName && parentName !== '.' && parentName !== path.parse(parentName).root && parsed.fields.name !== parentName) {
        addFinding(findings, file, 2, 'SG002', `Skill name "${parsed.fields.name}" does not match parent folder "${parentName}".`, `name: ${parsed.fields.name}`);
      }
    }
  }

  return findings;
}

export function createReport({ findings, filesScanned, skipped = [], root = '.' }) {
  const unique = new Map();
  for (const finding of findings) {
    const key = [finding.ruleId, finding.file, finding.line].join(':');
    if (!unique.has(key)) unique.set(key, finding);
  }
  const sorted = [...unique.values()].sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return rank[a.severity] - rank[b.severity] || a.file.localeCompare(b.file) || a.line - b.line;
  });
  const penalty = sorted.reduce((total, item) => total + (SCORE_PENALTY[item.severity] ?? 0), 0);
  const score = Math.max(0, 100 - penalty);
  return {
    tool: 'SkillGuard',
    version: '0.1.0',
    root,
    summary: {
      score,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 45 ? 'D' : 'F',
      filesScanned,
      findings: sorted.length,
      critical: sorted.filter((x) => x.severity === 'critical').length,
      high: sorted.filter((x) => x.severity === 'high').length,
      medium: sorted.filter((x) => x.severity === 'medium').length,
      low: sorted.filter((x) => x.severity === 'low').length
    },
    findings: sorted,
    skipped
  };
}

export function getRule(ruleId) { return RULE_BY_ID.get(ruleId); }
