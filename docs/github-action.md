# GitHub Action

SkillGuard provides a composite GitHub Action that runs the offline scanner and optionally uploads a SARIF report to GitHub Code Scanning.

## Basic usage

Add a workflow such as `.github/workflows/skillguard.yml`:

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

## Code Scanning integration

To publish findings as Code Scanning alerts, grant the additional permission and enable SARIF upload:

```yaml
permissions:
  contents: read
  security-events: write

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Khayom1/SkillGuard@main
        with:
          path: ./skills
          fail-on: high
          upload-sarif: 'true'
```

## Inputs

| Input          | Default            | Description |
|----------------|--------------------|-------------|
| `path`         | `.`                | Skill directory or file to scan |
| `fail-on`      | `high`             | Severity threshold that fails the job (`critical`, `high`, `medium`, `low`, `none`) |
| `upload-sarif` | `false`            | Upload the generated SARIF report to GitHub Code Scanning |
| `sarif-file`   | `skillguard.sarif` | Path for the SARIF output file |

## Production recommendations

- Prefer a version tag (for example `@v0.2.0`) once a release exists, or pin the action to the full 40-character commit SHA of a reviewed release.
- Review the generated SARIF and the repository’s Code Scanning configuration before enabling upload in production workflows.
- Keep the action’s permissions minimal. Only request `security-events: write` when SARIF upload is required.
- Treat a failed SkillGuard job as a signal that requires human review of the findings, not as automatic proof of malice.
