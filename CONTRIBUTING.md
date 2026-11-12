# Contributing to SkillGuard

Thank you for your interest in improving SkillGuard. This project prioritizes correctness, explainability, privacy, and reproducible evidence over feature count.

Please read this document carefully before opening a pull request.

## Code of Conduct

Participation is governed by the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By contributing, you agree to uphold these standards.

## Development Environment

- **Node.js** 18 or newer is required.
- SkillGuard has **zero runtime dependencies**. Keep it that way unless an optional analysis stage is explicitly designed and isolated.
- Before opening a pull request, run the full verification suite:

```bash
npm test
npm run check
npm run benchmark
npm pack --dry-run
```

## Pull Request Process

1. Fork the repository and create a focused branch.
2. Keep changes small and purposeful. One logical change per PR is preferred.
3. Update or add tests for any behavioral change.
4. Update documentation (README, rules, threat model, changelog) when user-visible behavior changes.
5. Ensure the CI matrix (Node 18 / 20 / 22) passes.
6. In the PR description, clearly state:
   - What problem is being solved
   - Why the approach was chosen
   - Expected impact on false positives / false negatives
   - Test cases added or updated

## Rule Contributions

Detection rules are the core of SkillGuard. New or modified rules must meet a high bar:

- **Stable ID** — never reuse or renumber public rule IDs after release.
- **Clear severity** and short, actionable explanation.
- **Malicious fixture** that demonstrates the intended detection.
- **Benign regression case** that should not trigger the rule.
- Document likely false positives and the security impact of the behavior.
- Prefer narrow, high-signal patterns over broad keyword matching.
- Never include real credentials, live keys, or executable malicious payloads in fixtures. Guard examples with inert conditions (`if false` / `if False`) when necessary.
- Do not execute sample skill scripts during tests.

Run the synthetic benchmark and report any unexpected results.

## Documentation Standards

- Prefer precise technical language over marketing claims.
- Never present a clean scan as proof that a skill is safe.
- Keep the offline-first and never-execute principles visible in user-facing docs.
- Update the threat model when trust boundaries or limitations change.

## Security-Sensitive Changes

Changes that affect file system handling, integrity locking, path traversal protection, incomplete-scan reporting, or the never-execute boundary require extra scrutiny. Reference the [Threat Model](docs/THREAT_MODEL.md) and [Security Policy](SECURITY.md).

If you believe you have found a security vulnerability, follow the process in [SECURITY.md](SECURITY.md) rather than opening a public issue.

## Commit Messages

Use clear, conventional messages. Examples:

- `feat: add SG018 for ...`
- `fix: correct incomplete-scan exit status when ...`
- `docs: expand threat model limitations for ...`
- `test: add benign regression for SG00x`

## Review Criteria

Maintainers evaluate contributions against:

- Correctness and test coverage
- Preservation of the offline / zero-dependency / never-execute guarantees
- Explainability of findings
- Impact on false-positive rate
- Documentation quality
- Consistency with existing architecture and design constraints

## Questions

Open a discussion or issue for design questions before investing significant implementation effort on large changes.
