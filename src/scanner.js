import path from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { RULES, SCORE_PENALTY } from './rules.js';
import { VERSION } from './version.js';

const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));
const SECRET_PATTERNS = [
  { regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, label: 'private key block' },
  { regex: /\bAKIA[0-9A-Z]{16}\b/g, label: 'AWS access key ID' },
  { regex: /\bASIA[0-9A-Z]{16}\b/g, label: 'AWS temporary access key ID' },
  { regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, label: 'GitHub token' },
  { regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, label: 'GitHub fine-grained token' },
  { regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g, label: 'API-key-like token' },
  { regex: /\bsk-ant-api\d{2}-[A-Za-z0-9_-]{20,}\b/g, label: 'Anthropic API key' },
  { regex: /\b(?:xox[baprs]-)[A-Za-z0-9-]{10,}\b/g, label: 'Slack token' },
  { regex: /\bAIza[0-9A-Za-z_-]{35}\b/g, label: 'Google API key' },
  { regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/g, label: 'GitLab personal access token' },
  { regex: /\bnpm_[A-Za-z0-9]{36}\b/g, label: 'npm access token' },
  { regex: /\bhf_[A-Za-z0-9]{30,}\b/g, label: 'Hugging Face token' },
  { regex: /\bpypi-[A-Za-z0-9_-]{50,}\b/g, label: 'PyPI token' },
  { regex: /\bdckr_pat_[A-Za-z0-9_-]{20,}\b/g, label: 'Docker Hub personal access token' },
  { regex: /\bsk_live_[A-Za-z0-9]{24,}\b/g, label: 'Stripe live secret key' },
  { regex: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g, label: 'Telegram bot token' },
  { regex: /\b(?:aws_secret_access_key|secret_access_key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/gi, label: 'AWS secret access key assignment' }
];

function sanitizeSnippet(value) {
  return String(value).replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu, (character) => {
    const code = character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    return `[U+${code}]`;
  });
}

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
    snippet: sanitizeSnippet(redactSecretValues(String(snippet))).trim().slice(0, 180),
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

const DECODED_BEHAVIOR_PATTERNS = [
  /\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|system|developer)\s+instructions?\b/i,
  /\b(?:curl|wget)\s+https?:\/\/[^\n|;]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/i,
  /\b(?:invoke-webrequest|iwr)\b[\s\S]{0,160}\b(?:iex|invoke-expression)\b/i,
  /\b(?:process\.env|os\.environ|GetEnvironmentVariable)\b[\s\S]{0,160}(?:https?:\/\/|fetch\s*\(|requests?\.(?:post|put)|\bcurl\s)/i,
  /\b(?:rm\s+-[a-z]*r[a-z]*f|chmod\s+-R\s+777|mkfs(?:\.[a-z0-9]+)?|format\s+[a-z]:)/i,
  /\b(?:base64|FromBase64String)\b[\s\S]{0,100}\b(?:eval|exec|iex|invoke-expression)\b/i
];

function looksLikeHighRiskDecodedText(value) {
  return DECODED_BEHAVIOR_PATTERNS.some((pattern) => pattern.test(value));
}

function decodeBase64Candidate(value, encoding = 'utf8') {
  if (value.length > 88000) return null;
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]+$/.test(normalized) || normalized.length % 4 === 1) return null;
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const bytes = Buffer.from(padded, 'base64');
  if (bytes.length > 65536 || bytes.toString('base64').replace(/=+$/, '') !== normalized) return null;
  const rawDecoded = bytes.toString(encoding);
  const decoded = encoding === 'utf16le' ? rawDecoded.replace(/\u0000/g, '') : rawDecoded;
  if (!decoded) return null;
  const characters = [...decoded];
  const visible = characters.filter((character) => character === '\n' || character === '\r' || character === '\t' || character.codePointAt(0) >= 0x20).length;
  if (visible / characters.length < 0.85) return null;
  return decoded;
}

function checkObfuscatedPayloads(text, file, findings) {
  const candidates = [];
  const add = (value, index) => {
    if (candidates.length >= 256 || !value) return;
    candidates.push({ value, index });
  };

  const encodedCommand = /-(?:enc|encodedcommand)\s+([A-Za-z0-9+/]{20,}={0,2})/gi;
  let match;
  while ((match = encodedCommand.exec(text)) !== null) {
    const value = decodeBase64Candidate(match[1], 'utf16le') ?? decodeBase64Candidate(match[1]);
    if (value) add(value, match.index + match[0].indexOf(match[1]));
  }

  const base64 = /(^|[^A-Za-z0-9+/_=-])([A-Za-z0-9+/_-]{24,}={0,2})(?![A-Za-z0-9+/_=-])/g;
  while ((match = base64.exec(text)) !== null && candidates.length < 256) {
    const value = decodeBase64Candidate(match[2]) ?? decodeBase64Candidate(match[2], 'utf16le');
    if (value) add(value, match.index + match[1].length);
  }

  const percentEncoded = /(?:[A-Za-z0-9._~-]|%[0-9a-f]{2}){16,}/gi;
  while ((match = percentEncoded.exec(text)) !== null && candidates.length < 256) {
    if ((match[0].match(/%[0-9a-f]{2}/gi) ?? []).length < 4) continue;
    try { add(decodeURIComponent(match[0]), match.index); } catch { /* malformed encoding is ignored */ }
  }

  const escaped = /(?:\\x[0-9a-f]{2}){4,}|(?:\\u[0-9a-f]{4}){4,}/gi;
  while ((match = escaped.exec(text)) !== null && candidates.length < 256) {
    const decoded = match[0].replace(/\\x([0-9a-f]{2})|\\u([0-9a-f]{4})/gi, (_whole, hex, unicode) => String.fromCodePoint(Number.parseInt(hex ?? unicode, 16)));
    add(decoded, match.index);
  }

  const lines = text.split(/\r?\n/);
  const seenLines = new Set();
  for (const candidate of candidates) {
    if (!looksLikeHighRiskDecodedText(candidate.value)) continue;
    const line = text.slice(0, candidate.index).split('\n').length;
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    addFinding(findings, file, line, 'SG013', 'Encoded content decodes to a recognizable high-risk instruction or command. The decoded content was inspected as text only and was never executed.', lines[line - 1] ?? '');
  }
}

function checkAutomaticHooks(text, file, findings) {
  if (!/\.(?:json|ya?ml)$/i.test(file)) return;
  if (!/\bhooks?\b/i.test(text)) return;
  if (!/\b(?:SessionStart|SessionEnd|UserPromptSubmit|PreToolUse|PostToolUse|Stop|SubagentStop|Notification|PermissionRequest)\b/i.test(text)) return;
  const match = /["']?(?:command|cmd|script)["']\s*:\s*["']([^"'\r\n]{1,500})["']/i.exec(text);
  if (!match) return;
  const line = text.slice(0, match.index).split('\n').length;
  addFinding(findings, file, line, 'SG015', 'Agent lifecycle event is paired with an automatically invoked command. Review its timing, executable, arguments, and side effects.', text.split(/\r?\n/)[line - 1] ?? '');
}

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
  checkObfuscatedPayloads(text, file, findings);
  checkAutomaticHooks(text, file, findings);

  if (path.basename(file).toLowerCase() === 'skill.md') {
    const parsed = parseFrontmatter(text);
    if (!parsed.valid) {
      for (const error of parsed.errors) addFinding(findings, file, 1, 'SG002', error, text.split(/\r?\n/)[0] ?? '');
    } else {
      const allowedTools = parsed.fields['allowed-tools'] ?? '';
      if (/(?:^|[\\s,])(?:bash|shell|terminal|exec|command)(?:$|[\\s,(])/i.test(allowedTools)) {
        const lines = text.split(/\\r?\\n/);
        const line = Math.max(1, lines.findIndex((item) => /^\\s*allowed-tools\\s*:/i.test(item)) + 1);
        addFinding(findings, file, line, 'SG014', 'The skill pre-authorizes a shell or command execution tool. Confirm that this permission is necessary and narrowly scoped.', lines[line - 1] ?? '');
      }
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
    version: VERSION,
    root,
    summary: {
      score,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 45 ? 'D' : 'F',
      filesScanned,
      complete: skipped.length === 0,
      skipped: skipped.length,
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
