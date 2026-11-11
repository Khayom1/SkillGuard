# GitHub Action

Add this workflow to `.github/workflows/skillguard.yml`:

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

To publish annotations in GitHub Code Scanning, grant `security-events: write` and enable SARIF upload:

```yaml
permissions:
  contents: read
  security-events: write

steps:
  - uses: actions/checkout@v4
  - uses: Khayom1/SkillGuard@main
    with:
      path: ./skills
      fail-on: high
      upload-sarif: 'true'
```

For a release workflow, replace `@main` with a version tag such as `@v0.1.0` after that tag exists. For production supply-chain hardening, pin the action to the full 40-character commit SHA of the reviewed release rather than relying on a movable branch or tag. Review the generated SARIF and repository permissions before enabling upload.
