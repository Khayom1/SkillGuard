import { readFile } from 'node:fs/promises';
import { analyzeFile } from '../src/scanner.js';

const datasetUrl = new URL('../benchmarks/cases.json', import.meta.url);
const dataset = JSON.parse(await readFile(datasetUrl, 'utf8'));

if (dataset.schemaVersion !== 1 || !Array.isArray(dataset.cases) || dataset.cases.length === 0) {
  throw new Error('Benchmark dataset is missing or has an unsupported schema.');
}

const results = dataset.cases.map((item) => {
  if (!item || typeof item.id !== 'string' || typeof item.content !== 'string' || typeof item.malicious !== 'boolean') {
    throw new Error('Every benchmark case must contain id, content, and a boolean malicious label.');
  }
  const findings = analyzeFile({ filePath: item.filePath ?? item.id, content: item.content });
  const detected = findings.some((finding) => finding.severity === 'critical' || finding.severity === 'high');
  return { id: item.id, malicious: item.malicious, detected, rules: [...new Set(findings.map((finding) => finding.ruleId))] };
});

const truePositive = results.filter((item) => item.malicious && item.detected).length;
const falseNegative = results.filter((item) => item.malicious && !item.detected).length;
const falsePositive = results.filter((item) => !item.malicious && item.detected).length;
const trueNegative = results.filter((item) => !item.malicious && !item.detected).length;
const rate = (numerator, denominator) => denominator ? numerator / denominator : 0;
const precision = rate(truePositive, truePositive + falsePositive);
const recall = rate(truePositive, truePositive + falseNegative);
const specificity = rate(trueNegative, trueNegative + falsePositive);
const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
const percent = (value) => `${(value * 100).toFixed(1)}%`;

console.log('SkillGuard synthetic benchmark');
console.log(`Cases: ${results.length} · malicious: ${results.filter((item) => item.malicious).length} · benign: ${results.filter((item) => !item.malicious).length}`);
console.log(`TP ${truePositive} · FP ${falsePositive} · TN ${trueNegative} · FN ${falseNegative}`);
console.log(`Precision ${percent(precision)} · Recall ${percent(recall)} · F1 ${percent(f1)} · Specificity ${percent(specificity)}`);

const misses = results.filter((item) => item.malicious && !item.detected);
const falseAlarms = results.filter((item) => !item.malicious && item.detected);
if (misses.length || falseAlarms.length) {
  console.error('Benchmark regressions:');
  for (const item of misses) console.error(`  MISS ${item.id}`);
  for (const item of falseAlarms) console.error(`  FALSE POSITIVE ${item.id}`);
  process.exitCode = 1;
} else {
  console.log('Synthetic regression corpus: PASS');
}
