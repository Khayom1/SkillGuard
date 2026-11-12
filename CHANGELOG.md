# Changelog

All notable changes to SkillGuard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- No detection-rule behavior changes in this release. Existing rule IDs (SG001–SG017) remain stable.
- This is a maturity and process release focused on trust, clarity, and operational readiness.

## [0.2.0] — 2026-11-11

### Detection
- Add **SG016** (reverse shell / remote interactive access) and **SG017** (unsafe dynamic execution: `eval`/`exec`, `shell=True`, PowerShell IEX).
- Expand prompt-injection coverage with jailbreak-style role overrides.
- Expand secret patterns (xAI keys, Bearer tokens).
- Strengthen PowerShell download-and-execute detection.
- Enrich the intentional `examples/risky-skill` fixture so more rule families are exercised.

### Packaging
- Bump package version to **0.2.0**.
- Improve npm description and keywords for discoverability.
- Include `CHANGELOG.md` in the published package.

### Documentation
- Update rule reference for SG016 and SG017.

## Prior work (folded into 0.1.x development)

- Bounded offline inspection for Base64, UTF-16LE PowerShell, percent-encoded, and escaped high-risk payloads (SG013).
- Frontmatter shell-tool pre-authorization (SG014) and lifecycle command hooks (SG015).
- Expanded secret-pattern coverage.
- Safe file reads via verified file descriptors, bounded traversal, incomplete-scan reporting.
- Integrity lock (SHA-256 + permission modes).
- Text, JSON, and SARIF 2.1.0 reports.
- GitHub Action and Trusted Publishing workflow.
- Synthetic offline benchmark and threat model.

## [0.1.0]

- Initial public MVP foundation.

[0.3.0]: https://github.com/Khayom1/SkillGuard/releases/tag/v0.3.0
[0.2.0]: https://github.com/Khayom1/SkillGuard/releases/tag/v0.2.0
[0.1.0]: https://github.com/Khayom1/SkillGuard/releases/tag/v0.1.0
