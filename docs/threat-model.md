# Threat model

## Assets at risk

An AI agent may have access to project files, developer credentials, shell commands, network services, and other tools. A skill bundle can influence the agent through natural-language instructions and executable helper files.

## In scope

SkillGuard looks for static indicators of:
- Instruction override and secrecy directives in agent-facing text.
- Credentials embedded in files.
- Hidden Unicode controls.
- Download-and-execute and encoded-execution patterns.
- Destructive commands, persistence, sensitive-path access, and broad permissions.
- Invalid required `SKILL.md` metadata.
- File changes after a trusted review, through the SHA-256 integrity lock.

## Out of scope

SkillGuard does not prove author identity, verify remote package provenance, evaluate runtime behavior, inspect encrypted or packed binaries, or determine whether a remote domain is reputable. It does not parse every language or the complete YAML specification.

## Safe operating model

- Scanning is read-only. SkillGuard never imports, sources, or executes scanned files.
- No network requests or telemetry are performed by the scanner.
- Symlinks are not followed. Integrity-lock creation fails when symlinks or unreadable/oversized entries prevent complete coverage.
- Secret matches are redacted in findings.
- Reports are evidence for human review, not permission to execute a skill.

## Recommended deployment controls

Run scans before installation and in pull-request CI. Pin the reviewed bundle with `skillguard lock`, then run `skillguard verify` before use. Execute agents in isolated environments with least-privilege credentials, restricted network egress, and approval gates for consequential actions.
