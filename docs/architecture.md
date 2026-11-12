# Architecture

SkillGuard is designed as a small, deterministic, offline-first static analysis pipeline. The default path never executes untrusted content, never makes network requests, and has zero runtime dependencies.

## Pipeline overview

```text
CLI
 ├─ Argument validation and exit policy
 ├─ File discovery with explicit resource limits
 │   └─ Verified regular-file reads (safe-fs)
 ├─ Scanner
 │   ├─ Unicode and secret checks
 │   ├─ Instruction and command heuristics
 │   ├─ Bounded encoded-text inspection
 │   └─ Agent Skills frontmatter checks
 ├─ Report model
 │   ├─ Terminal text
 │   ├─ JSON
 │   └─ SARIF 2.1.0
 └─ Integrity commands
     ├─ SHA-256 lock creation
     └─ Changed / added / missing comparison
```

## Module responsibilities

| Module | Responsibility |
|--------|----------------|
| `src/cli.js` | CLI parsing, command orchestration, severity thresholds, incomplete-scan exit behavior |
| `src/files.js` | Bounded directory discovery and collection of supported text files |
| `src/safe-fs.js` | File-descriptor-based reads with symlink and mutation checks |
| `src/frontmatter.js` | Lightweight required-field checks for Agent Skills metadata (not a full YAML parser) |
| `src/scanner.js` | Stateless content analysis and report aggregation |
| `src/rules.js` | Stable rule IDs, severity levels, descriptions, and score weights |
| `src/reporters.js` | Human-readable, JSON, and SARIF serialization |
| `src/integrity.js` | SHA-256 integrity locks and verification |
| `src/version.js` | Version metadata sourced from package.json |
| `src/index.js` | Public module exports |

## Design constraints

These constraints are intentional and non-negotiable for the default scanner:

1. **Do not execute untrusted skill content.**
2. **Keep the default scanner network-free and dependency-free.**
3. **Keep rule IDs stable after public release.**
4. **Every rule change requires both malicious and benign regression cases.**
5. **Prefer a narrow, explainable finding over a broad keyword alert.**
6. **Fail visibly when the scan cannot inspect all discovered items.**

## Extension points

Future optional analysis stages (AST, data-flow, YARA, or LLM-assisted review) must:

- Remain behind an explicit opt-in flag
- Preserve precise source locations
- Remain deterministic where possible
- Clearly distinguish heuristic findings from higher-assurance analysis
- Disclose any content that leaves the local device
- Never replace or weaken the offline baseline

The core scanner is intentionally kept small so it remains usable on constrained environments (including mobile terminals) and so its behavior stays easy to audit.
