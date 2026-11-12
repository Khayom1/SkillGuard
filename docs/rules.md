# Detection Rules

SkillGuard uses transparent, pattern-based rules. Every alert includes a stable rule ID, severity, file path, line number, and a short explanation.

| ID    | Severity  | What it flags |
|-------|-----------|---------------|
| SG001 | High      | Zero-width, bidirectional, and unexpected control characters |
| SG002 | Medium    | Missing or invalid required Agent Skills frontmatter fields |
| SG003 | High      | Recognizable attempts to override prior, system, or developer instructions, including jailbreak-style role overrides |
| SG004 | High      | Requests to reveal private prompts, tokens, credentials, or environment secrets |
| SG005 | Critical  | Provider credentials, API tokens, and private-key patterns (GitHub, AWS, Google, Anthropic, GitLab, npm, PyPI, Docker Hub, Hugging Face, Stripe, Telegram, Slack, xAI, Bearer, JWT-like, Azure/LLM key assignments, etc.) |
| SG006 | Critical  | Remote download content piped directly into a shell, interpreter, or PowerShell IEX |
| SG007 | Critical  | Recognizable destructive disk or recursive-delete commands |
| SG008 | High      | Startup, service, scheduled-task, or autorun persistence changes |
| SG009 | High      | References to common credential stores and private-key locations |
| SG010 | High      | Encoded content passed to dynamic code execution |
| SG011 | Critical  | Patterns combining environment/secret access with network transfer; Discord/Telegram webhook endpoints |
| SG012 | Medium    | Broad privilege or unsafe filesystem permission settings |
| SG013 | High      | Base64, UTF-16LE PowerShell, percent-encoded, or escaped content that decodes to a recognizable high-risk instruction or command |
| SG014 | Medium    | Agent Skills frontmatter that pre-authorizes shell, terminal, or command execution tools |
| SG015 | Medium    | A recognized agent lifecycle hook paired with a command/script setting that may run automatically |
| SG016 | Critical  | Reverse-shell, netcat listener, or remote interactive shell patterns |
| SG017 | High      | Dynamic execution primitives such as `eval`/`exec` of user data, Python `subprocess(..., shell=True)`, or PowerShell `Invoke-Expression` |
| SG018 | Critical  | Multi-stage chains: download on one line followed by execution within a short nearby window |
| SG019 | High      | MCP / agent tool configuration granting shell, filesystem write, or network capabilities |
| SG020 | High      | Homoglyph / confusable Unicode mixed into Latin instruction text |
| SG021 | High      | Unverified remote package installs (`pip install https://…`, npm from raw/git/tarball, streamed package managers) |

## Scoring

The score starts at 100 and subtracts:

- 35 points per **Critical** finding
- 20 points per **High** finding
- 9 points per **Medium** finding
- 3 points per **Low** finding

The score is clamped to the range 0–100. It is a prioritization aid only and must not be treated as a probability or safety certification.

## Analysis layers

1. **Line heuristics** — single-line risky commands and instruction patterns
2. **Encoded inspection (SG013)** — bounded offline decode of Base64 / PowerShell / percent / escapes
3. **Multi-stage chains (SG018)** — download then execute across a sliding line window
4. **Config-aware checks (SG014, SG015, SG019)** — frontmatter, lifecycle hooks, MCP/tool declarations
5. **Unicode (SG001, SG020)** — control characters and confusable lookalikes

## Encoded payload inspection (SG013)

SG013 performs bounded, offline decoding of selected common representations. It checks decoded text against a small set of high-risk behaviors. It does not execute decoded content and does not claim to handle arbitrary encodings, nested layers, compression, or custom obfuscators.

## Known limitations

- Rules are heuristics. Context matters; false positives and false negatives are expected.
- No network requests are made, so external URLs are not reputation-checked.
- SkillGuard does not interpret every YAML feature or execute scripts.
- Novel, deeply nested, or agent-context-dependent attacks may evade static checks.
- A clean scan is not a security certification.

Rule IDs are stable after public release. Changes that alter detection behavior should be accompanied by both malicious and benign regression cases.
