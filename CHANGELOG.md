# Changelog

## Unreleased

- Add bounded offline inspection for Base64, UTF-16LE PowerShell, percent-encoded, and escaped high-risk payloads (SG013).
- Flag pre-authorized shell tools in Agent Skills frontmatter (SG014) and recognized automatic lifecycle command hooks (SG015), with positive and negative regression tests.
- Expand secret-pattern coverage for AWS temporary keys, Anthropic API keys, PyPI tokens, and Docker Hub personal tokens.
- Read discovered files through verified file descriptors, reject symlinks and non-regular files, enforce byte limits before allocation, and re-check file identity after reading.
- Enforce canonical scan-root boundaries during directory traversal and file reads; surface unsupported files and excluded directories as incomplete coverage.
- Include dependency/build contents in integrity manifests within configured limits while excluding Git metadata.
- Make incomplete scans fail closed with exit code 2 unless the caller explicitly uses --allow-skipped; expose completeness in JSON and SARIF reports.
- Add a synthetic offline benchmark with precision, recall, F1, and specificity metrics; make it part of the local verification and pre-publish gates.
- Add the threat model, architecture guide, benchmark methodology, and regression coverage for the new behavior.

- Redact every detected secret value from all finding snippets, including findings raised by other rules.
- Detect additional credential formats for Google, GitLab, npm, Hugging Face, Stripe, Telegram, and AWS secret-key assignments.
- Load the CLI and report version from a single package metadata source.
- Add regression coverage for repeated secrets and cross-rule snippet redaction.
- Enforce the configured file limit across multiple explicit file inputs.
- Add an npm Trusted Publishing workflow and release checklist.
- Add an inert risky-skill fixture and an end-to-end CLI detection test.
- Declare the package author and add pre-publish test and syntax checks.


## 0.1.0 — planned

- Initial public MVP.
- Offline scanning of Agent Skills files and bundled text-based scripts.
- Frontmatter checks, hidden Unicode checks, secret-pattern detection, and risky instruction/command heuristics.
- Text, JSON, and SARIF 2.1.0 reports.
- Configurable severity exit threshold and a composite GitHub Action.
