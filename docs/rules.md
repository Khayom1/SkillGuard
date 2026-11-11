# Detection rules

SkillGuard uses transparent pattern-based rules. Every alert includes a rule ID, file, line, severity, and a short explanation. The list below describes what the first release looks for.

| ID | Severity | What it flags |
| --- | --- | --- |
| SG001 | High | Zero-width, bidirectional, and unexpected control characters. |
| SG002 | Medium | Missing or invalid required Agent Skills frontmatter fields. |
| SG003 | High | Recognizable attempts to override prior, system, or developer instructions. |
| SG004 | High | Requests to reveal private prompts, tokens, credentials, or environment secrets. |
| SG005 | Critical | Common GitHub, AWS (including temporary access key IDs), Google, Anthropic, GitLab, npm, PyPI, Docker Hub, Hugging Face, Stripe, Telegram, Slack, and private-key credential patterns. |
| SG006 | Critical | Remote download content piped directly into a shell or interpreter. |
| SG007 | Critical | Recognizable destructive disk or recursive-delete commands. |
| SG008 | High | Startup, service, scheduled-task, or autorun persistence changes. |
| SG009 | High | References to common credential stores and private-key locations. |
| SG010 | High | Encoded content passed to dynamic code execution. |
| SG011 | Critical | Patterns combining environment/secret access with network transfer. |
| SG012 | Medium | Broad privilege or unsafe filesystem permission settings. |
| SG013 | High | Base64, UTF-16LE PowerShell, percent-encoded, or escaped content decodes to a recognizable high-risk instruction or command. |
| SG014 | Medium | Agent Skills frontmatter pre-authorizes shell, terminal, or command execution tools. Review whether the permission is required and narrowly scoped. |
| SG015 | Medium | A recognized agent lifecycle hook is paired with a command/script setting that may run automatically. Review its trigger and side effects. |

## Scoring

The score starts at 100 and subtracts 35 points per critical finding, 20 per high, 9 per medium, and 3 per low finding. The score is clamped to 0–100. It is a prioritization aid, not a probability that a skill is safe.

## Known limitations

- Rules are heuristics; context matters and false positives/negatives are expected.
- No network requests are made, so external URLs are not reputation-checked.
- SkillGuard does not interpret every YAML feature or execute scripts.
- Obfuscated, novel, multi-stage, or agent-context-dependent attacks may evade static checks.
- A clean scan is not a security certification. Review permissions, sandbox the agent, and require approval for consequential actions.


## Encoded payload inspection

SG013 performs bounded, offline decoding of selected common representations. It checks decoded text against a small set of high-risk behaviors such as instruction overrides, download-and-execute chains, secret exfiltration, and destructive commands. It does not run decoded content, and it does not claim to decode arbitrary encodings, nested layers, compressed payloads, or custom obfuscators.

A positive SG013 finding means that recognizable risky text was found inside an encoded value. Review the surrounding source and its intended purpose before deciding how to respond.
