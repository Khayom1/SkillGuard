# Changelog

All notable changes to SkillGuard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Detection
- **SG018** — Multi-stage download-then-execute chains across a sliding line window
- **SG019** — Dangerous MCP / agent tool declarations (shell, filesystem write, network)
- **SG020** — Homoglyph / confusable Unicode mixed into Latin instruction text
- **SG021** — Unverified remote package installs (pip/npm from URL, streamed installers)
- Stronger secret patterns: JWT-like tokens, Azure secret assignments, LLM provider key assignments
- SG011 extended with Discord/Telegram webhook exfiltration endpoints
- Regression cases added for all new rule families

## [0.3.0] — 2026-11-12

### Added
- Enterprise-grade project governance: `CODE_OF_CONDUCT.md`, expanded `SECURITY.md`, `SUPPORT.md`, structured PR and issue templates.
- Professional contribution standards in `CONTRIBUTING.md` with explicit offline / never-execute constraints.
- Production hardening notes for the GitHub Action (SHA pinning, minimal permissions, Code Scanning guidance).
- Clear release and Trusted Publishing checklist in `docs/release.md`.

### Changed
- README rewritten for production clarity: core guarantees table, precise limitations, consistent terminology.
- Threat model, architecture, rules reference, roadmap, and competitive landscape refined for precision and professional tone.
- Package metadata improved (`keywords`, `files` list includes governance documents).
- CI workflow strengthened with concurrency control and clearer step names.
- Author and project identity standardized across documentation (maintainer, repository, VEYROST ecosystem links).

### Security
- Security policy now defines supported versions, in-scope / out-of-scope boundaries, and coordinated disclosure expectations.
- Design principles (never execute, offline default, explainable findings, fail-closed incompleteness) restated as non-negotiable constraints.

### Notes
- This maturity release focused on trust, clarity, and operational readiness. Subsequent unreleased work expands detection coverage.

## [0.2.0] — 2026-11-11

### Detection
- Add **SG016** and **SG017**.
- Expand prompt-injection coverage and secret patterns.
- Strengthen PowerShell download-and-execute detection.

### Packaging
- Bump package version to **0.2.0**.

## [0.1.0]

- Initial public MVP foundation.

[0.3.0]: https://github.com/Khayom1/SkillGuard/releases/tag/v0.3.0
[0.2.0]: https://github.com/Khayom1/SkillGuard/releases/tag/v0.2.0
[0.1.0]: https://github.com/Khayom1/SkillGuard/releases/tag/v0.1.0
