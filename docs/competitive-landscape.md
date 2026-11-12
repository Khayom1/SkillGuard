# Competitive Landscape and Product Position

**Review date:** 2026-11-12

This is a strategic snapshot based on publicly available documentation. Features and repositories change over time. The purpose is to identify useful product patterns, not to copy implementation or claim a complete head-to-head evaluation.

## Relevant projects

### Cisco AI Defense — skill-scanner

Public documentation describes a layered approach: pattern-based detection, YARA-X rules, AST/data-flow analysis, optional LLM-assisted judgment, and a policy/decision layer. The main lesson for SkillGuard is to move beyond isolated regular expressions and connect source evidence to behavior and policy decisions while preserving explainability.

### NVIDIA — SkillSpector

Public documentation describes scanning individual files, directories, ZIP archives, Git sources, and URLs; a broad library of vulnerability patterns; multi-stage analysis; optional semantic analysis; and dependency vulnerability context. The main lessons are safe ingestion, bundle-aware analysis, and transparent coverage and evaluation results.

## Current SkillGuard position

| Area              | SkillGuard today                                      | Competitive gap |
|-------------------|-------------------------------------------------------|-----------------|
| Privacy           | Offline by default; no content upload or API key      | Preserve this property as optional integrations are added |
| Dependencies      | Zero runtime dependencies                             | Optional analyzers may need isolated, pinned dependencies |
| Rules             | Explainable rule IDs with severity and source locations | Broader coverage, lower false positives, multilingual and multi-stage cases |
| Obfuscation       | Bounded Base64, UTF-16LE PowerShell, percent, escaped-string inspection | Nested encodings, compression, custom encoders, broader language semantics |
| File system       | Bounded traversal, root checks, regular-file reads, incomplete-scan reporting | Race-resistant directory handles and independent platform testing |
| Integrity         | SHA-256 manifests, permission modes, changed/added/missing detection | Authenticated or signed manifests and source provenance |
| Outputs           | Text, JSON, SARIF 2.1.0                               | IDE diagnostics, review baselines, richer evidence |
| Ingestion         | Local file and directory paths                        | Safe ZIP extraction and immutable Git revision support |
| Analysis depth    | Static heuristic rules                                | Optional AST, data-flow, shell/PowerShell command-chain analysis |
| Evaluation        | Small synthetic regression corpus                     | Large, independently labeled benign/malicious holdout corpus |

## Product patterns worth adopting

1. **Layered analysis** — retain fast deterministic checks, then add optional AST/data-flow stages. Keep every finding linked to exact source evidence.
2. **Policy-aware decisions** — distinguish capability declaration from confirmed dangerous behavior. Show severity, evidence, and the reason for each recommendation.
3. **Bundle-aware analysis** — inspect relationships between instructions, scripts, configuration, and supporting files.
4. **Safe source ingestion** — when ZIP/Git/URL support is added, pin revisions, bound archive expansion, reject path traversal and symlinks, and never execute fetched content.
5. **Benchmark credibility** — measure benign false positives and category-specific recall on independently reviewed datasets. Publish dataset revision and limitations.

## Where SkillGuard should differentiate

- Keep the baseline private-by-default and offline. Any network or LLM analysis must be explicit opt-in with a clear data-egress warning.
- Keep the CLI lightweight and usable on constrained devices, including Android Termux.
- Fail visibly when files or directories are skipped; never silently label a partial scan as complete.
- Make integrity verification a first-class workflow.
- Prefer explainability and reproducibility over large, opaque detection counts.

## Strategic decision

Do not chase ranking through feature count or star count. First earn trust with a stable local workflow, an independently reviewed benchmark, and a low false-positive rate. Then expand analysis depth and ecosystem integrations. Global ranking depends on adoption, independent validation, maintenance, and community trust; code changes alone cannot guarantee it.
