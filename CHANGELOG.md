# Changelog

## Unreleased

- Redact every detected secret value from all finding snippets, including findings raised by other rules.
- Add regression coverage for repeated secrets and cross-rule snippet redaction.
- Enforce the configured file limit across multiple explicit file inputs.
- Add an npm Trusted Publishing workflow and release checklist.
- Declare the package author and add pre-publish test and syntax checks.


## 0.1.0 — 2026-11-11

- Initial public MVP.
- Offline scanning of Agent Skills files and bundled text-based scripts.
- Frontmatter checks, hidden Unicode checks, secret-pattern detection, and risky instruction/command heuristics.
- Text, JSON, and SARIF 2.1.0 reports.
- Configurable severity exit threshold and a composite GitHub Action.
