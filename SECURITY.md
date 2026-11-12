# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

Security fixes are applied to the latest released minor version. Users are strongly encouraged to run the current stable release.

## Reporting a Vulnerability

**Do not open a public GitHub issue for an undisclosed security vulnerability.**

Please use one of the following channels:

1. **Preferred**: GitHub Security Advisories — go to the repository **Security** tab and select **Report a vulnerability**.
2. If the advisory feature is unavailable, contact the maintainer privately through the profile contact methods.

When reporting, please include:

- Affected version(s)
- A clear description of the issue and its security impact
- Minimal, safe steps to reproduce (no live credentials or destructive payloads)
- Any suggested remediation if known

You should receive an acknowledgment within a reasonable timeframe. We will keep you informed of the progress toward a fix and coordinated disclosure.

## Scope

SkillGuard is a local, offline-first, rule-based static analyzer for AI agent skill bundles. Its security model is described in detail in the [Threat Model](docs/THREAT_MODEL.md).

### In scope

- Defects that allow the scanner itself to execute untrusted skill content
- Path traversal, symlink, or filesystem boundary bypasses during scanning or locking
- Integrity lock or verification weaknesses that could produce false "unchanged" results
- Issues that cause the tool to silently skip high-risk content while reporting a complete scan
- Credential or secret leakage introduced by the scanner itself

### Out of scope

- False negatives or false positives in detection rules (these are tracked as functional issues)
- Security properties of third-party agent runtimes that load skills after scanning
- The safety of a skill that receives a clean report (a clean report is never a certification)
- Network or LLM-assisted analysis features (none exist in the default offline path)

## Security Design Principles

SkillGuard is built around the following non-negotiable constraints:

1. **Never execute untrusted content** — scanned scripts and skills are never run, imported, or evaluated.
2. **Offline by default** — the core scanner makes no network requests and requires no API keys.
3. **Bounded and explicit** — file count, size, depth, and directory limits are enforced; incomplete scans are reported and fail closed by default.
4. **Explainable findings** — every alert carries a stable rule ID, severity, location, and human-readable reason.
5. **Integrity as a first-class control** — SHA-256 locks and verification are provided so reviewed bundles can be pinned.

## Coordinated Disclosure

We follow responsible disclosure practices. Once a fix is available, we will publish a security advisory and release notes. Credit will be given to reporters who wish to be acknowledged, unless they prefer to remain anonymous.

## Additional Resources

- [Threat Model](docs/THREAT_MODEL.md)
- [Architecture](docs/architecture.md)
- [Detection Rules](docs/rules.md)
