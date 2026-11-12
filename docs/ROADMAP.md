# Roadmap

SkillGuard aims to become a trusted pre-install security gate for AI agent skills. The project prioritizes correctness, explainability, privacy, and reproducible evidence over raw rule count.

This roadmap is directional. Items are not complete until implemented, tested, documented, and released.

## Product position

**Offline-first skill security. Inspect before trust. Verify before use.**

The core differentiator is that a user can inspect an untrusted skill locally without uploading its contents, installing the skill, or executing its code. Optional integrations must preserve this safe default.

## Phase 0 — Release candidate hardening

- [x] Offline static scan for common prompt, secret, command, Unicode, persistence, and permission risks
- [x] Text, JSON, and SARIF 2.1.0 reports
- [x] SHA-256 integrity lock and drift verification
- [x] Bounded file and directory traversal
- [x] File-descriptor-based regular-file reads and explicit incomplete-scan status
- [x] Synthetic regression benchmark runner and threat model
- [ ] Run the full test, syntax, packaging, and benchmark commands on supported Node.js versions across platforms
- [ ] Independently review false-positive behavior, path handling, and lock-file edge cases
- [ ] Confirm npm package ownership and Trusted Publishing setup before public publish

## Phase 1 — Credible detection quality

- [ ] Build a versioned, independently reviewed dataset of benign and malicious skills with source, license, and label provenance
- [ ] Keep a holdout corpus that is never used to tune detection rules
- [ ] Publish per-category recall, benign false-positive rate, severity calibration, coverage, and performance
- [ ] Add multilingual prompt-injection tests and realistic lookalikes
- [ ] Introduce baseline/fingerprint suppression with an auditable record of accepted findings
- [ ] Add rule confidence/evidence fields without presenting heuristic scores as probabilities

## Phase 2 — Deeper static analysis

- [ ] Add optional AST analysis for JavaScript/TypeScript and Python
- [ ] Track simple data flows from environment variables and credential files to network or process execution sinks
- [ ] Analyze shell and PowerShell command chains across multiple lines and helper scripts
- [ ] Parse MCP server configuration and tool permissions
- [ ] Parse supported agent configuration formats with versioned schemas
- [ ] Add optional YARA rule packs with rule provenance and compatibility checks
- [ ] Keep syntax/semantic analyzers optional so the default lightweight scanner remains usable offline

## Phase 3 — Safe ingestion and supply-chain context

- [ ] Add safe local ZIP ingestion with archive path traversal checks, member-count caps, compressed/uncompressed size caps, and symlink rejection
- [ ] Add Git repository ingestion pinned to an immutable commit SHA
- [ ] Make URL ingestion opt-in, show what is downloaded, enforce size limits, and never execute fetched content
- [ ] Record source URL/repository, immutable revision, content hashes, and scanner version in reports
- [ ] Add optional dependency/CVE metadata checks with a visible network-egress policy and offline fallback
- [ ] Sign integrity manifests or support a documented signature workflow so a lock file itself can be authenticated

## Phase 4 — Install-time and developer integrations

- [ ] Add a local pre-install command and pre-commit integration
- [ ] Add editor diagnostics and readable review summaries
- [ ] Add a local MCP server that exposes scan and verify operations without exposing a remote service
- [ ] Add adapters for major agent ecosystems only after their formats and permission models are documented and tested
- [ ] Provide examples for Claude Code, Codex, Gemini CLI, Cursor, and MCP configuration where supported
- [ ] Keep GitHub Action distribution separate from the offline CLI and expand it only after runner access and release tests are confirmed

## Phase 5 — Maintained ecosystem

- [ ] Publish a detector rule authoring guide and a review process for external contributions
- [ ] Add signed releases, provenance, SBOM, and reproducible release artifacts
- [ ] Establish responsible vulnerability disclosure and a documented response process
- [ ] Recruit independent security reviewers and ecosystem maintainers
- [ ] Publish benchmark results and limitations for each release

## Non-goals

- Claiming that a clean scan proves a skill is safe
- Executing untrusted skills as part of analysis
- Uploading private skill contents by default
- Treating star count or rule count as a security-quality metric
- Copying proprietary or incompatible rule sets from other projects

## What would make SkillGuard competitive

A credible top-tier tool needs more than features. It needs a low false-positive rate on real benign skills, strong coverage of realistic attacks, clear evidence for every finding, reliable completeness reporting, stable compatibility with agent formats, privacy-preserving operation, and independent validation. Adoption follows trust; it cannot be guaranteed by code changes alone.
