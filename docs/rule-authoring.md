# Rule authoring

SkillGuard accepts two kinds of rules. Both stay offline. Neither kind executes scanned content.

## External pack (preferred for experiments)

Add a JSON pack and pass `--pack`. See [advanced.md](advanced.md) and [packs/example-extra.json](../packs/example-extra.json).

A pack rule needs:

- `id` — 2–64 characters, `[A-Za-z0-9._-]`
- `severity` — `critical`, `high`, `medium`, or `low`
- `message` — what a reviewer should do
- `pattern` — a JavaScript regular expression source
- `flags` — optional, default `i`

Do not copy rule text from another project's proprietary or incompatible ruleset.

## Built-in rule

1. Add the rule to `RULES` in `src/rules.js` with a new `SG` id. Do not reuse or renumber a published id.
2. Detect it from `src/scanner.js` (or `src/dataflow.js` for taint-style checks).
3. Set `confidence` to `heuristic`. Set `evidence` to a short label such as `static-pattern`. Never present the label as a probability.
4. Add one malicious case and one near-miss benign case to `benchmarks/cases.json`.
5. Add a unit test under `tests/`.
6. Document the rule in `docs/rules.md` and `README.md`.
7. Describe the behavior change under `## [Unreleased]` in `CHANGELOG.md`.

## Review bar

Reject a rule that:

- flags ordinary bilingual text, documentation of an attack, or a negated warning (`do not ignore…`, `не игнорируй…`)
- requires network access or executes the skill
- cannot point at a file and a line
- has no benign counterexample

Maintainers review pack and built-in contributions the same way: evidence, a failing case before the change, and a passing case after it.
