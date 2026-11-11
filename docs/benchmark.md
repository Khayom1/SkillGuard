# Benchmark

## Run it

\`\`\`bash
npm run benchmark
\`\`\`

The benchmark is offline and uses the versioned synthetic cases in \`benchmarks/cases.json\`. It reports case-level true positives, false positives, true negatives, false negatives, precision, recall, F1, and specificity.

The benchmark command exits non-zero when a malicious regression case is missed or a benign case is flagged at high/critical severity. It is also included in \`npm test\`.

## What this benchmark is — and is not

The included corpus is a small, hand-authored regression suite. It exercises representative direct and encoded patterns, along with benign lookalikes. It is useful for preventing regressions in known cases.

It is **not** a representative sample of real agent skills, a red-team certification, or evidence of real-world precision/recall. The dataset is synthetic, intentionally small, and may overlap with the rules it tests. Do not quote its metrics as product-wide detection accuracy.

## How to improve the evaluation

For a credible public evaluation:

1. Build a consented, version-pinned set of real benign skills with licenses and provenance recorded.
2. Add safely stored, labeled malicious samples from independent research datasets, preserving their licenses and attribution.
3. Keep a holdout set that is not used while tuning rules.
4. Have at least two reviewers adjudicate ambiguous labels and document the threat behavior, not just a file's reputation.
5. Report per-category recall, benign false-positive rate, severity calibration, scanner version, dataset revision, and exclusions.
6. Publish raw aggregate results and a reproducible command. Never upload private skills or secrets to a hosted evaluation service without informed consent.

## Metric definitions

- Precision = TP / (TP + FP)
- Recall = TP / (TP + FN)
- F1 = harmonic mean of precision and recall
- Specificity = TN / (TN + FP)

These are case-level metrics. A case counts as detected when at least one critical or high finding is emitted. They do not measure finding localization or severity calibration.
