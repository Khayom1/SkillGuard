# Release and npm publishing

SkillGuard is prepared for npm publishing under the package name `skillguard-ai`. The package is not yet published to the public registry.

## Prerequisites before the first public release

1. Confirm that the npm package name `skillguard-ai` is available and controlled by the project maintainer. Package names are permanent once published.
2. Create or sign in to the npm account that will own the package.
3. In npm package settings, configure **Trusted Publishing** for GitHub Actions:
   - Owner: `Khayom1`
   - Repository: `SkillGuard`
   - Workflow: `publish.yml`
   - Environment: leave empty unless an environment is explicitly configured in the workflow.
4. Confirm that GitHub Actions can allocate a hosted runner and that the CI workflow passes on the release commit.

## Publishing a release

1. Set the version in `package.json` and `CITATION.cff` to the **same** value. The CLI, scan reports, and integrity locks read the version from package metadata.
2. Update `CHANGELOG.md` with user-visible changes.
3. Create a GitHub Release whose tag matches the package version (example: tag `v0.2.0` for version `0.2.0`).
4. Run the full local verification suite on the release commit:

   ```bash
   npm run verify
   ```

   This executes tests, syntax checks, the synthetic benchmark, and a package dry-run.
5. Publishing the GitHub Release triggers `.github/workflows/publish.yml`.
6. The workflow verifies that the tag version matches both `package.json` and `CITATION.cff`, then runs `prepublishOnly` (tests + checks + benchmark) and publishes with npm provenance.

## Important rules

- Do not publish while the test suite or CI is failing or unverified.
- Do not publish a package under a name you do not control.
- Do not store an npm access token in the repository. Trusted Publishing uses GitHub’s OIDC identity.
- Once a version is published, do not overwrite it. Increment the package version for every subsequent release.
- Prefer pinning the GitHub Action to a full commit SHA of a reviewed release for production supply-chain hardening.

## Version consistency checklist

Before tagging:

- [ ] `package.json` version
- [ ] `CITATION.cff` version
- [ ] `CHANGELOG.md` entry for the version
- [ ] Git tag `vX.Y.Z` matches the package version
