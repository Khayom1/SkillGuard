# Competitive landscape and product position

**Review date:** 2026-11-11

This is a strategic snapshot based on public project documentation. Features and repositories may change. The purpose is to identify useful product patterns, not to copy implementation code or claim a complete head-to-head evaluation.

## Relevant projects

### Cisco AI Defense — skill-scanner

Repository: https://github.com/cisco-ai-defense/skill-scanner

Public documentation describes a layered approach: pattern-based detection, YARA-X rules, AST/data-flow analysis, optional LLM-assisted judgment, and a policy/decision layer. The main lesson for SkillGuard is to move beyond isolated regular expressions and connect source evidence to behavior and policy decisions.

### NVIDIA — SkillSpector

Repository: https://github.com/NVIDIA/skillspector

Public documentation describes scanning individual files, directories, ZIP archives, Git sources, and URLs; a broad library of vulnerability patterns; multi-stage analysis; optional semantic analysis; and dependency vulnerability context. The main lessons are to build safe ingestion, analyze related files as a bundle, and publish transparent coverage and evaluation results.

## Current SkillGuard position

| Area | SkillGuard today | Competitive gap |
| --- | --- | --- |
| Privacy | Offline by default; no content upload or API key | Preserve this property as optional integrations are added |
| Dependencies | Zero runtime dependencies | Optional analyzers may need isolated, pinned dependencies |
| Rules | Explainable rule IDs with severity and source locations | More coverage, fewer false positives, multilingual and multi-stage cases |
| Obfuscation | Bounded Base64, UTF-16LE PowerShell, percent, and escaped-string inspection | Nested encodings, compression, custom encoders, and broader language semantics |
| File system | Bounded traversal, root checks, regular-file reads, incomplete-scan reporting | Race-resistant directory handles and independent platform testing |
| Integrity | SHA-256 manifests, permission modes, changed/added/missing detection | Authenticated or signed manifests and source provenance |
| Outputs | Text, JSON, SARIF 2.1.0 | IDE diagnostics, review baselines, richer evidence |
| Ingestion | Local file and directory paths | Safe ZIP extraction and immutable Git revision support |
| Analysis depth | Static heuristic rules | AST, data-flow, shell/PowerShell command-chain analysis |
| Evaluation | Small synthetic regression corpus | Large, independently labeled benign/malicious holdout corpus |

## What SkillGuard should borrow as product patterns

1. **Layered analysis:** retain fast deterministic checks, then add optional AST/data-flow stages. Keep each finding linked to exact source evidence.
2. **Policy-aware decisions:** distinguish a capability declaration from a confirmed dangerous behavior. Show severity, evidence, and the reason for each recommendation.
3. **Bundle-aware analysis:** inspect relationships between instructions, scripts, configuration, and supporting files. Do not treat each file as an isolated document.
4. **Safe source ingestion:** when ZIP/Git/URL support is added, pin revisions, bound archive expansion, reject path traversal and symlinks, and never execute fetched content.
5. **Benchmark credibility:** measure benign false positives and category-specific recall on independently reviewed datasets. Publish the dataset revision and limitations.

## Where SkillGuard should differentiate

- Keep the baseline private-by-default and offline. Network or LLM analysis must be an explicit opt-in with a clear data-egress warning.
- Keep the CLI lightweight and usable on constrained devices, including Android Termux.
- Fail visibly when files or directories are skipped; never silently label a partial scan as complete.
- Make integrity verification a first-class workflow, not an afterthought.
- Prefer explainability and reproducibility over large, opaque detection counts.

## Strategic decision

Do not chase a top-10 label through feature count or star count. First earn trust with a stable local workflow, an independently reviewed benchmark, and a low false-positive rate. Then expand the analysis depth and ecosystem integrations. Global ranking depends on adoption, independent validation, maintenance, and community trust; code changes alone cannot guarantee it.
