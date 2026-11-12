# Advanced features

All advanced features remain **offline** and **never execute** scanned content.

## Safe ZIP ingestion

```bash
skillguard ./skill-bundle.zip
```

- Path traversal (`../`) and absolute paths are rejected
- Symlink entries are rejected
- Entry count and compressed/uncompressed sizes are bounded
- Members are inflated in memory only; nothing is written to disk
- Binary members are skipped

## Data-flow heuristics (SG022)

For `.js` / `.ts` / `.jsx` / `.tsx` / `.py` files, SkillGuard tracks simple assignments from `process.env`, `os.environ`, and secret-like expressions to network or execution sinks (`fetch`, `requests`, `subprocess`, `eval`, …).

This is **not** a full AST or inter-procedural analyzer. Treat findings as review signals.

## Baseline suppression

Create a baseline after human review:

```bash
skillguard baseline create ./my-skill --reason "Reviewed 2026-11-12" --output .skillguard-baseline.json
```

Apply it on later scans:

```bash
skillguard ./my-skill --baseline .skillguard-baseline.json
```

Matching is exact on `ruleId + file + line + message`. Suppressed findings appear in the report under `suppressed` when using JSON.

## Custom rule packs

YARA-inspired offline JSON packs:

```bash
skillguard ./my-skill --pack ./packs/example-extra.json
```

Schema:

```json
{
  "schemaVersion": 1,
  "name": "my-pack",
  "rules": [
    {
      "id": "PACK.EXAMPLE",
      "severity": "high",
      "message": "Description",
      "pattern": "\\bexample\\b",
      "flags": "i"
    }
  ]
}
```

## Report provenance and Markdown

JSON and Markdown reports include `provenance`:

- scanner version and scan time
- SHA-256 of each inspected text
- local Git commit and ref when a `.git` directory is present

SkillGuard reads those files directly. It does not run `git` and it does not contact a remote.

```bash
skillguard ./my-skill --format markdown --output review.md
skillguard ./my-skill --format json --output report.json
```

## Local MCP server

```bash
skillguard mcp
```

Exposes tools over stdio JSON-RPC (MCP-compatible framing):

- `skillguard_scan`
- `skillguard_verify`
- `skillguard_lock`

Configure your agent host to run `skillguard mcp` as a local MCP server. No network egress is performed by the server itself.
