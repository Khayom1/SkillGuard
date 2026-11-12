# Detection Rules

SkillGuard uses transparent, pattern-based rules. Every alert includes a stable rule ID, severity, file path, line number, and a short explanation.

| ID    | Severity  | What it flags |
|-------|-----------|---------------|
| SG001 | High      | Zero-width, bidirectional, and unexpected control characters |
| SG002 | Medium    | Missing or invalid required Agent Skills frontmatter fields |
| SG003 | High      | Recognizable attempts to override prior, system, or developer instructions, including jailbreak-style role overrides |
| SG004 | High      | Requests to reveal private prompts, tokens, credentials, or environment secrets |
| SG005 | Critical  | Common provider credentials, API tokens, and private-key patterns (GitHub, AWS including temporary keys, Google, Anthropic, GitLab, npm, PyPI, Docker Hub, Hugging Face, Stripe, Telegram, Slack, xAI, Bearer, etc.) |
| SG006 | Critical  | Remote download content piped directly into a shell, interpreter, or PowerShell IEX |
| SG007 | Critical  | Recognizable destructive disk or recursive-delete commands |
| SG008 | High      | Startup, service, scheduled-task, or autorun persistence changes |
| SG009 | High      | References to common credential stores and private-key locations |
| SG010 | High      | Encoded content passed to dynamic code execution |
| SG011 | Critical  | Patterns combining environment/secret access with network transfer |
| SG012 | Medium    | Broad privilege or unsafe filesystem permission settings |
| SG013 | High      | Base64, UTF-16LE PowerShell, percent-encoded, or escaped content that decodes to a recognizable high-risk instruction or command |
| SG014 | Medium    | Agent Skills frontmatter that pre-authorizes shell, terminal, or command execution tools |
| SG015 | Medium    | A recognized agent lifecycle hook paired with a command/script setting that may run automatically |
| SG016 | Critical  | Reverse-shell, netcat listener, or remote interactive shell patterns |
| SG017 | High      | Dynamic execution primitives such as `eval`/`exec` of user data, Python `subprocess(..., shell=True)`, or PowerShell `Invoke-Expression` |

## Scoring

The score starts at 100 and subtracts:

- 35 points per **Critical** finding
- 20 points per **High** finding
- 9 points per **Medium** finding
- 3 points per **Low** finding

The score is clamped to the range 0–100. It is a prioritization aid only and must not be treated as a probability or safety certification.

## Encoded payload inspection (SG013)

SG013 performs bounded, offline decoding of selected common representations. It checks decoded text against a small set of high-risk behaviors (instruction overrides, download-and-execute chains, secret exfiltration, destructive commands). It does not execute decoded content and does not claim to handle arbitrary encodings, nested layers, compression, or custom obfuscators.

A positive SG013 finding means recognizable risky text was present inside an encoded value. Review the surrounding source and intended purpose before acting.

## Known limitations

- Rules are heuristics. Context matters; false positives and false negatives are expected.
- No network requests are made, so external URLs are not reputation-checked.
- SkillGuard does not interpret every YAML feature or execute scripts.
- Obfuscated, novel, multi-stage, or agent-context-dependent attacks may evade static checks.
- A clean scan is not a security certification. Review permissions, sandbox the agent, and require approval for consequential actions.

Rule IDs are stable after public release. Changes that alter detection behavior should be accompanied by both malicious and benign regression cases.
