# Release and npm publishing

SkillGuard is prepared for npm publishing, but the package is not published yet.

## Before the first release

1. Confirm that the npm package name `skillguard-ai` is available and controlled by the project maintainer. npm package names are permanent public identifiers once published.
2. Create or sign in to the npm account that will own the package.
3. In npm package settings, configure **Trusted Publishing** for GitHub Actions:
   - Owner: `Khayom1`
   - Repository: `SkillGuard`
   - Workflow: `publish.yml`
   - Environment: leave empty unless one is explicitly configured in the workflow.
4. Confirm GitHub Actions can allocate a hosted runner. The current repository runs have failed before runner assignment; no package publish should be attempted until CI can execute.

## Publish a release

1. Set the version in `package.json` and `CITATION.cff` to the same value. The CLI, scan reports, and integrity locks read the version from package metadata automatically.
2. Update `CHANGELOG.md`.
3. Create a GitHub Release with tag `v0.1.0` (the tag must match `package.json`).
4. Publishing the release triggers `.github/workflows/publish.yml`.
5. The workflow runs the package's `prepublishOnly` script, which executes `npm test` and `npm run check`, then publishes with npm provenance.

## Important

- Do not publish while the test suite or CI is unverified.
- Do not publish a package under a name you do not control.
- Do not put an npm access token in the repository. Trusted Publishing uses GitHub's OIDC identity.
- Once a version is published, do not overwrite it; increment the package version for every subsequent release.
