# Threat model

## Purpose

SkillGuard performs local, static security triage of AI agent skill bundles before a person installs, shares, or enables them. A skill may combine natural-language instructions, scripts, configuration, references, and binary assets. A clean result is not a safety certification.

## Assets to protect

- Local credentials and private data that an agent or a bundled script could access.
- The integrity of skill instructions, scripts, and supporting files after review.
- The integrity and completeness of scan results.
- The user's trust in findings, including the ability to distinguish warnings from verified facts.

## Adversary and unsafe content

Assume a skill may be intentionally malicious, compromised in a supply-chain update, or accidentally unsafe. Relevant behaviors include:

- Prompt and instruction hierarchy manipulation.
- Requests to reveal prompts, tokens, environment variables, or private files.
- Hard-coded credentials and private keys.
- Download-and-execute chains, encoded commands, and dynamic execution.
- Destructive commands, privilege escalation, persistence, and secret exfiltration.
- Hidden or directional Unicode that changes what a reviewer sees.

## Security controls

- Scanned scripts are never executed, imported, installed, or sourced.
- The default scan path makes no network requests and has no runtime dependencies.
- File count, file size, directory count, and traversal depth are bounded.
- Symbolic links are not followed during directory discovery.
- Regular files are opened through file descriptors. Where supported, \`O_NOFOLLOW\` is used; device/inode and file metadata are checked before and after reading.
- Oversized, unreadable, linked, or otherwise skipped items are reported. The CLI exits with status \`2\` for an incomplete scan unless the user explicitly passes \`--allow-skipped\`.
- Integrity locks hash file bytes with SHA-256 and record permission modes. Verification reports changed, added, and missing files.

## Trust boundaries and limitations

SkillGuard is a static analyzer, not a sandbox, antivirus engine, runtime monitor, or formal verifier.

- Rules are heuristics. Unknown, novel, multilingual, multi-stage, or context-dependent attacks can evade detection.
- Decoding is bounded and read-only. Only selected common encodings and recognizable high-risk behaviors are inspected; arbitrary nested encodings, compression, custom encoders, and all script-language semantics are not covered.
- The filesystem checks reduce common path-swap and symlink risks but do not make a scan safe against a fully hostile local process that can mutate parent directories concurrently. Scan untrusted bundles in an isolated environment with least privilege.
- SkillGuard does not verify remote URL reputation, package provenance, dependency vulnerabilities, agent runtime permissions, or the behavior of an agent after the skill is loaded.
- A file extension allowlist means unsupported file types may not be analyzed by the text scanner. Integrity locking covers regular files, including binary assets, but it does not determine whether those assets are safe.
- A skipped item makes the report incomplete. Do not use \`--allow-skipped\` for release gates unless you have independently reviewed every omitted item.

## Recommended operating procedure

1. Obtain a skill from a trusted source and record its exact source revision.
2. Scan the complete bundle. Resolve skipped items rather than suppressing the incomplete status.
3. Review every critical/high finding and inspect nearby code and declared permissions.
4. Run or install skills only in a sandbox or agent environment with least privilege and no unnecessary secrets.
5. Create an integrity lock after review and verify it immediately before use.
6. Re-scan after updates. Do not treat a previous clean report as approval for changed content.

## Severity and score

Severity describes the rule's triage priority. The numeric score is a prioritization aid derived from rule weights; it is not a probability, confidence score, or assurance that a skill is safe.
