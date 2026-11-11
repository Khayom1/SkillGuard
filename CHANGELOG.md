# Changelog

## 0.2.0 — 2026-11-11

### Detection
- Add **SG016** (reverse shell / remote interactive access) and **SG017** (unsafe dynamic execution: `eval`/`exec`, `shell=True`, PowerShell IEX).
- Expand prompt-injection coverage with jailbreak-style role overrides.
- Expand secret patterns (xAI keys, Bearer tokens).
- Strengthen PowerShell download-and-execute detection.
- Enrich the intentional `examples/risky-skill` fixture so more rule families are exercised.

### Packaging
- Bump package version to **0.2.0**.
- Improve npm description and keywords for discoverability (`skill-security`, `supply-chain`, `claude`, `cursor`, `mcp`, `offline`, `zero-dependencies`).
- Include `CHANGELOG.md` in the published package.

### Documentation
- Update rule reference for SG016 and SG017.

## Unreleased / prior work folded into 0.1.x development

- Add bounded offline inspection for Base64, UTF-16LE PowerShell, percent-encoded, and escaped high-risk payloads (SG013).
- Flag pre-authorized shell tools in Agent Skills frontmatter (SG014) and recognized automatic lifecycle command hooks (SG015).
- Expand secret-pattern coverage for AWS temporary keys, Anthropic, PyPI, Docker Hub, Google, GitLab, npm, Hugging Face, Stripe, Telegram.
- Safe file reads via verified file descriptors, bounded traversal, incomplete-scan reporting.
- Integrity lock (SHA-256 + permission modes).
- Text, JSON, and SARIF 2.1.0 reports.
- GitHub Action and Trusted Publishing workflow.
- Synthetic offline benchmark and threat model.

## 0.1.0

- Initial public MVP foundation.
