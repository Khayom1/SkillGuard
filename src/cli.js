#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from './version.js';
import { analyzeFile, createReport } from './analyze.js';
import { collectFiles } from './files.js';
import { formatText, toSarif } from './reporters.js';
import { SEVERITY_ORDER } from './rules.js';
import { createIntegrityLock, verifyIntegrityLock } from './integrity.js';
import { readRegularFile } from './safe-fs.js';
import { readZipTextMembers } from './zip.js';
import { applyBaseline, createBaselineDocument, loadBaseline, writeBaseline } from './baseline.js';
import { loadRulePack } from './packs.js';

const HELP = `SkillGuard ${VERSION} — security auditing and integrity checks for AI agent skills

USAGE
  skillguard [scan] [path ...] [options]
  skillguard lock [skill-directory] [--output .skillguard.lock.json]
  skillguard verify [skill-directory] [--lock .skillguard.lock.json]
  skillguard baseline create [path ...] [--output .skillguard-baseline.json]
  skillguard mcp

SCAN OPTIONS
  --format <text|json|sarif>  Output format (default: text)
  --output <file>             Write the report to a file instead of stdout
  --fail-on <level>           Exit 1 at/above: critical|high|medium|low|none (default: high)
  --max-files <number>        Maximum files to inspect (default: 5000)
  --max-file-bytes <number>   Skip larger text files (default: 1048576)
  --max-directories <number>  Maximum directories to visit (default: 10000)
  --max-depth <number>        Maximum directory depth (default: 40)
  --allow-skipped             Exit successfully even when some files were skipped
  --baseline <file>           Suppress findings listed in a baseline file
  --pack <file>               Load an offline custom rule pack (repeatable)

LOCK / VERIFY OPTIONS
  --output <file>             Lock output path (lock); report path (verify)
  --lock <file>               Lock file to verify (default: .skillguard.lock.json)

BASELINE OPTIONS
  --output <file>             Baseline output path (default: .skillguard-baseline.json)
  --reason <text>             Reason recorded for accepted findings

GENERAL
  --no-color                  Disable terminal colors
  -h, --help                  Show this help
  -v, --version               Show version

EXAMPLES
  skillguard ./my-skill
  skillguard ./bundle.zip
  skillguard ./skills --baseline .skillguard-baseline.json
  skillguard ./skills --pack ./packs/extra.json
  skillguard baseline create ./my-skill --reason "Reviewed 2026-11-12"
  skillguard mcp

SkillGuard never executes skill scripts or downloads remote content.
`;

function parseArgs(argv) {
  const args = [...argv];
  let command = 'scan';
  if (['scan', 'lock', 'verify', 'baseline', 'mcp'].includes(args[0])) command = args.shift();
  let baselineSub = null;
  if (command === 'baseline') {
    baselineSub = args.shift() ?? 'create';
    if (baselineSub !== 'create') throw new Error('Only "baseline create" is supported.');
  }
  const result = {
    command,
    baselineSub,
    paths: [],
    format: 'text',
    output: null,
    lock: null,
    failOn: 'high',
    maxFiles: 5000,
    maxFileBytes: 1024 * 1024,
    maxDirectories: 10000,
    maxDepth: 40,
    allowSkipped: false,
    color: process.stdout.isTTY === true,
    help: false,
    version: false,
    baseline: null,
    packs: [],
    reason: ''
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Option ${arg} requires a value.`);
      index += 1;
      return args[index];
    };
    if (arg === '--format') result.format = next();
    else if (arg === '--output') result.output = next();
    else if (arg === '--lock') result.lock = next();
    else if (arg === '--fail-on') result.failOn = next();
    else if (arg === '--max-files') result.maxFiles = Number(next());
    else if (arg === '--max-file-bytes') result.maxFileBytes = Number(next());
    else if (arg === '--max-directories') result.maxDirectories = Number(next());
    else if (arg === '--max-depth') result.maxDepth = Number(next());
    else if (arg === '--allow-skipped') result.allowSkipped = true;
    else if (arg === '--baseline') result.baseline = next();
    else if (arg === '--pack') result.packs.push(next());
    else if (arg === '--reason') result.reason = next();
    else if (arg === '--no-color') result.color = false;
    else if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--version' || arg === '-v') result.version = true;
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else result.paths.push(arg);
  }
  if (!['text', 'json', 'sarif'].includes(result.format)) throw new Error(`Unsupported format: ${result.format}`);
  if (!Object.hasOwn(SEVERITY_ORDER, result.failOn)) throw new Error(`Unsupported --fail-on level: ${result.failOn}`);
  if (!Number.isInteger(result.maxFiles) || result.maxFiles < 1) throw new Error('--max-files must be a positive integer.');
  if (!Number.isInteger(result.maxFileBytes) || result.maxFileBytes < 1) throw new Error('--max-file-bytes must be a positive integer.');
  if (!Number.isInteger(result.maxDirectories) || result.maxDirectories < 1) throw new Error('--max-directories must be a positive integer.');
  if (!Number.isInteger(result.maxDepth) || result.maxDepth < 0) throw new Error('--max-depth must be a non-negative integer.');
  if (result.command === 'verify' && result.format === 'sarif') throw new Error('SARIF format is available for scan reports only.');
  return result;
}

async function writeOutput(outputPath, rendered) {
  if (outputPath) await fs.writeFile(path.resolve(outputPath), `${rendered}\n`, 'utf8');
  else process.stdout.write(`${rendered}\n`);
}

async function collectScanInputs(paths, options) {
  const files = [];
  const skipped = [];
  const roots = [];
  for (const input of paths.length ? paths : ['.']) {
    const absolute = path.resolve(input);
    roots.push(absolute);
    if (absolute.toLowerCase().endsWith('.zip')) {
      const zip = await readZipTextMembers(absolute, {
        maxUncompressedFile: options.maxFileBytes
      });
      for (const member of zip.members) {
        files.push({ filePath: `${path.basename(absolute)}/${member.filePath}`, content: member.content });
      }
      skipped.push(...zip.skipped.map((item) => ({ file: `${path.basename(absolute)}/${item.file}`, reason: item.reason })));
      continue;
    }
    const collected = await collectFiles([absolute], options);
    files.push(...collected.files);
    skipped.push(...collected.skipped);
  }
  return { files, skipped, roots };
}

async function loadPacks(packPaths) {
  const packs = [];
  for (const packPath of packPaths) packs.push(await loadRulePack(packPath));
  return packs;
}

async function runScan(options, { writeBaselineFromFindings = false } = {}) {
  const packs = await loadPacks(options.packs);
  const { files, skipped } = await collectScanInputs(options.paths, options);
  let findings = files.flatMap((file) => analyzeFile({
    filePath: path.relative(process.cwd(), file.filePath),
    content: file.content
  }, { packs }));

  let suppressed = [];
  if (options.baseline) {
    const baselineDoc = await loadBaseline(options.baseline);
    const applied = applyBaseline(findings, baselineDoc);
    findings = applied.active;
    suppressed = applied.suppressed;
  }

  if (writeBaselineFromFindings) {
    const doc = createBaselineDocument({ findings, reason: options.reason, version: VERSION });
    const out = path.resolve(options.output ?? '.skillguard-baseline.json');
    await writeBaseline(out, doc);
    process.stdout.write(`SkillGuard: baseline created with ${doc.accepted.length} accepted finding(s): ${out}\n`);
    return 0;
  }

  const report = createReport({
    findings,
    filesScanned: files.length,
    skipped,
    root: options.paths.length ? options.paths.join(', ') : '.'
  });
  if (suppressed.length) {
    report.summary.suppressed = suppressed.length;
    report.suppressed = suppressed;
  }
  const rendered = options.format === 'json'
    ? JSON.stringify(report, null, 2)
    : options.format === 'sarif'
      ? JSON.stringify(toSarif(report), null, 2)
      : formatText(report, { color: options.color });
  await writeOutput(options.output, rendered);
  if (!files.length) {
    process.stderr.write('SkillGuard: no supported files could be scanned. Check the path and skipped-file details.\n');
    return 2;
  }
  if (skipped.length && !options.allowSkipped) {
    process.stderr.write(`SkillGuard: scan incomplete; ${skipped.length} item(s) were skipped. Resolve them or explicitly pass --allow-skipped.\n`);
    return 2;
  }
  const threshold = SEVERITY_ORDER[options.failOn];
  const shouldFail = options.failOn !== 'none' && findings.some((finding) => SEVERITY_ORDER[finding.severity] >= threshold);
  return shouldFail ? 1 : 0;
}

async function runLock(options) {
  const root = path.resolve(options.paths[0] ?? '.');
  if (!(await fs.stat(root)).isDirectory()) throw new Error('The lock command expects a skill directory.');
  const output = path.resolve(options.output ?? path.join(root, '.skillguard.lock.json'));
  const lock = await createIntegrityLock(root, { maxFiles: options.maxFiles, exclude: [output] });
  if (!lock.files.length) throw new Error('No files found to include in the integrity lock.');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await writeOutput(output, JSON.stringify(lock, null, 2));
  process.stdout.write(`SkillGuard: integrity lock created for ${lock.files.length} file(s): ${output}\n`);
  return lock.files.length ? 0 : 2;
}

async function runVerify(options) {
  const root = path.resolve(options.paths[0] ?? '.');
  if (!(await fs.stat(root)).isDirectory()) throw new Error('The verify command expects a skill directory.');
  const lockPath = path.resolve(options.lock ?? path.join(root, '.skillguard.lock.json'));
  let lock;
  try {
    const lockRead = await readRegularFile(lockPath, { maxBytes: 16 * 1024 * 1024 });
    if (lockRead.oversized) throw new Error('Lock file exceeds the 16 MiB safety limit.');
    lock = JSON.parse(lockRead.bytes.toString('utf8'));
  } catch (error) {
    process.stderr.write(`SkillGuard: cannot safely read lock file ${lockPath}: ${error.message}\n`);
    return 2;
  }
  let result;
  try { result = await verifyIntegrityLock(root, lock, { maxFiles: options.maxFiles, exclude: [lockPath] }); }
  catch (error) { process.stderr.write(`SkillGuard: ${error.message}\n`); return 2; }
  const rendered = options.format === 'json' ? JSON.stringify(result, null, 2) : [
    `SkillGuard integrity verification: ${result.valid ? 'MATCH' : 'DRIFT DETECTED'}`,
    `Expected ${result.summary.expected} file(s) · Current ${result.summary.current} file(s)`,
    `Changed ${result.summary.changed} · Added ${result.summary.added} · Missing ${result.summary.missing}`,
    ...result.changed.map((item) => `  CHANGED ${item.path}`),
    ...result.added.map((item) => `  ADDED   ${item}`),
    ...result.missing.map((item) => `  MISSING ${item}`)
  ].join('\n');
  await writeOutput(options.output, rendered);
  return result.valid ? 0 : 1;
}

export async function run(argv = process.argv.slice(2)) {
  let options;
  try { options = parseArgs(argv); }
  catch (error) { process.stderr.write(`SkillGuard: ${error.message}\nRun with --help for usage.\n`); return 2; }
  if (options.help) { process.stdout.write(HELP); return 0; }
  if (options.version) { process.stdout.write(`${VERSION}\n`); return 0; }
  try {
    if (options.command === 'mcp') {
      await import('./mcp-server.js');
      return 0;
    }
    if (options.command === 'lock') return await runLock(options);
    if (options.command === 'verify') return await runVerify(options);
    if (options.command === 'baseline') return await runScan(options, { writeBaselineFromFindings: true });
    return await runScan(options);
  } catch (error) {
    process.stderr.write(`SkillGuard: unexpected error: ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`SkillGuard: unexpected error: ${error.message}\n`);
    process.exitCode = 2;
  });
}
