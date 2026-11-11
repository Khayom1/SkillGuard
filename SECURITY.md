# Security Policy

## Reporting a vulnerability

Please do not open a public issue for an undisclosed vulnerability. Use GitHub's **Report a vulnerability** feature in the Security tab of this repository. Include the affected version, a minimal reproduction, the expected impact, and any safe proof-of-concept details.

## Scope and limitations

SkillGuard is a local, rule-based static analyzer. The detailed [threat model](docs/THREAT_MODEL.md) explains its trust boundaries and recommended use. It does not execute scanned files, fetch URLs, install dependencies, or prove that a skill is safe. Findings require human review. False positives and false negatives are possible; do not use a clean report as the only security control.
