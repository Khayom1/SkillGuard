# Contributing

Thanks for helping make AI agent skills easier to inspect.

## Development

- Node.js 18 or newer is required.
- SkillGuard has no runtime dependencies.
- Run `npm test`, `npm run check`, `npm run benchmark`, and `npm pack --dry-run` before opening a pull request.

## Rule contributions

Every rule should include a stable ID, a short explanation, severity, a malicious fixture, and a benign regression case. Run the synthetic benchmark and describe expected false positives. Prefer narrow patterns with clear security impact over broad keyword matching. Never include real credentials in fixtures. Do not execute sample skill scripts during tests.

## Pull requests

Explain the threat scenario, why the rule is actionable, likely false positives, and the test cases added. Keep changes focused and document user-visible behavior.
