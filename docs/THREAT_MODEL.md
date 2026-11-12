# Threat Model

## Purpose

SkillGuard performs local, static security triage of AI agent skill bundles before a person installs, shares, or enables them. A skill may combine natural-language instructions, scripts, configuration, references, and other assets. A clean result is **not** a safety certification.

## Assets to protect

- Local credentials and private data that an agent or a bundled script could access
- Integrity of skill instructions, scripts, and supporting files after review
- Integrity and completeness of scan results
- User trust in findings, including the ability to distinguish warnings from verified facts

## Adversary model and unsafe content

Assume a skill may be intentionally malicious, compromised in a supply-chain update, or accidentally unsafe. Relevant behaviors include:

- Prompt and instruction hierarchy manipulation
- Requests to reveal prompts, tokens, environment variables, or private files
- Hard-coded credentials and private keys
- Download-and-execute chains, encoded commands, and dynamic execution
- Destructive commands, privilege escalation, persistence, and secret exfiltration
- Hidden or directional Unicode that changes what a reviewer sees versus what an agent processes

## Security controls

| Control | Implementation |
|---------|----------------|
| No execution | Scanned scripts are never executed, imported, installed, or sourced |
| Offline default | Core scan path makes no network requests and has no runtime dependencies |
| Resource bounds | File count, file size, directory count, and traversal depth are limited |
| Symlink handling | Symbolic links are not followed during directory discovery |
| Safe reads | Regular files are opened through file descriptors; device/inode and metadata checks are applied where supported |
| Incomplete scan reporting | Oversized, unreadable, linked, or otherwise skipped items are reported; default exit status is non-zero |
| Integrity locking | SHA-256 hashes + permission modes; verification reports changed, added, and missing files |

## Trust boundaries and limitations

SkillGuard is a static analyzer. It is not a sandbox, antivirus engine, runtime monitor, or formal verifier.

- Rules are heuristics. Unknown, novel, multilingual, multi-stage, or context-dependent attacks can evade detection.
- Decoding is bounded and read-only. Only selected common encodings and recognizable high-risk behaviors are inspected.
- Filesystem checks reduce common path-swap and symlink risks but do not make a scan safe against a fully hostile local process that can mutate parent directories concurrently. Scan untrusted bundles in an isolated environment with least privilege.
- SkillGuard does not verify remote URL reputation, package provenance, dependency vulnerabilities, agent runtime permissions, or post-load agent behavior.
- Unsupported file types are not text-analyzed; they are surfaced as skipped items.
- Certain directories (`.git`, `node_modules`, `.venv`, `dist`, `.cache`, etc.) are excluded by design. Scan them explicitly when they form part of the artifact under review.
- A skipped item makes the report incomplete. Do not use `--allow-skipped` for release gates unless every omitted item has been independently reviewed.

## Recommended operating procedure

1. Obtain a skill from a trusted source and record its exact source revision.
2. Scan the complete bundle. Resolve skipped items rather than suppressing incompleteness.
3. Review every critical and high finding; inspect nearby code and declared permissions.
4. Run or install skills only in a sandbox or agent environment with least privilege and no unnecessary secrets.
5. Create an integrity lock after review and verify it immediately before use.
6. Re-scan after any update. Do not treat a previous clean report as approval for changed content.

## Severity and score

Severity describes triage priority. The numeric score is derived from rule weights and is a prioritization aid only. It is not a probability, confidence score, or assurance that a skill is safe.
