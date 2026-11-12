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
- **SG022** — Lightweight secret-to-sink data-flow heuristics for JS/TS/Python
- Stronger secret patterns: JWT-like tokens, Azure secret assignments, LLM provider key assignments
- SG011 extended with Discord/Telegram webhook exfiltration endpoints

### Features
- **Safe ZIP ingestion** — offline, bounded, path-traversal safe, in-memory text members only
- **Baseline suppression** — `skillguard baseline create` + `--baseline` with auditable accepted findings
- **Custom rule packs** — offline JSON packs (`--pack`), example in `packs/example-extra.json`
- **Local MCP server** — `skillguard mcp` exposes `skillguard_scan`, `skillguard_verify`, `skillguard_lock`

### Notes
- Core path remains zero-dependency and never executes scanned content
- Version remains **0.3.0** until an explicit release is cut

## [0.3.0] — 2026-11-12

### Added
- Enterprise-grade project governance and professional documentation
- Author identity standardized (Khayom Abdurahmonov / github.com/Khayom1)

## [0.2.0] — 2026-11-11

### Detection
- SG016, SG017 and expanded secret/prompt coverage

## [0.1.0]

- Initial public MVP foundation
