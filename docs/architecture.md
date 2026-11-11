# Architecture

SkillGuard keeps its default analysis pipeline small, deterministic, and offline.

```text
CLI
 ├─ argument validation and exit policy
 ├─ file discovery with explicit resource limits
 │   └─ verified regular-file reads
 ├─ scanner
 │   ├─ Unicode and secret checks
 │   ├─ instruction and command heuristics
 │   ├─ bounded encoded-text inspection
 │   └─ Agent Skills frontmatter checks
 ├─ report model
 │   ├─ terminal text
 │   ├─ JSON
 │   └─ SARIF 2.1.0
 └─ integrity commands
     ├─ SHA-256 lock creation
     └─ changed / added / missing comparison
```

## Main modules

| Module | Responsibility |
| --- | --- |
| `src/cli.js` | CLI parsing, command orchestration, thresholds, and incomplete-scan exit behavior |
| `src/files.js` | Bounded directory discovery and supported text-file collection |
| `src/safe-fs.js` | File-descriptor-based reads with symlink and mutation checks |
| `src/frontmatter.js` | Lightweight required-field checks for Agent Skills metadata; not a full YAML parser |
| `src/scanner.js` | Stateless content analysis and report aggregation |
| `src/rules.js` | Stable rule IDs, severity, descriptions, and score weights |
| `src/reporters.js` | Human-readable, JSON, and SARIF serialization |
| `src/integrity.js` | SHA-256 integrity locks and verification |

## Design constraints

- Do not execute untrusted skill content.
- Keep the default scanner network-free and dependency-free.
- Keep rule IDs stable after public release.
- Every rule change needs malicious and benign regression cases.
- Prefer a narrow, explainable finding over a broad keyword alert.
- Fail visibly when the scan cannot inspect all discovered items.

## Extension points

A future AST or dataflow layer should be isolated behind an optional analysis stage, preserve source locations, remain deterministic when possible, and clearly distinguish heuristic from semantic findings. An optional remote or LLM-assisted stage must be opt-in, disclose what content leaves the device, and never replace the offline baseline.
