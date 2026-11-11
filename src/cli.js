#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from './version.js';
import { analyzeFile, createReport } from './scanner.js';
import { collectFiles } from './files.js';
import { formatText, toSarif } from './reporters.js';
import { SEVERITY_ORDER } from './rules.js';
import { createIntegrityLock, verifyIntegrityLock } from './integrity.js';

const HELP = `SkillGuard ${VERSION} — security auditing and integrity checks for AI agent skills

USAGE
  skillguard [scan] [path ...] [options]
  skillguard lock [skill-directory] [--output skillguard.lock.json]
  skillguard verify [skill-directory] [--lock skillguard.lock.json]

SCAN OPTIONS
  --format <text|json|sarif>  Output format (default: text)
  --output <file>             Write the report to a file instead of stdout
  --fail-on <level>           Exit 1 at/above: critical|high|medium|low|none (default: high)
  --max-files <number>        Maximum files to inspect (default: 5000)
  --max-file-bytes <number>   Skip larger text files (default: 1048576)
  --max-directories <number>  Maximum directories to visit (default: 10000)
  --max-depth <number>        Maximum directory depth (default: 40)

LOCK / VERIFY OPTIONS
  --output <file>             Lock output path (lock); report path (verify)
  --lock <file>               Lock file to verify (default: .skillguard.lock.json)

GENERAL
  --no-color                  Disable terminal colors
  -h, --help                  Show this help
  -v, --version               Show version

EXAMPLES
  skillguard ./my-skill
  skillguard ./skills --format sarif --output skillguard.sarif
  skillguard lock ./my-skill
  skillguard verify ./my-skill

SkillGuard never executes skill scripts or downloads remote content.
`;

function parseArgs(argv) {
  const args = [...argv];
  let command = 'scan';
  if (['scan', 'lock', 'verify'].includes(args[0])) command = args.shift();
  const result = { command, paths: [], format: 'text', output: null, lock: null, failOn: 'high', maxFiles: 5000, maxFileBytes: 1024 * 1024, maxDirectories: 10000, maxDepth: 40, color: process.stdout.isTTY === true, help: false, version: false };
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
  try { lock = JSON.parse(await fs.readFile(lockPath, 'utf8')); }
  catch (error) { process.stderr.write(`SkillGuard: cannot read lock file ${lockPath}: ${error.message}\n`); return 2; }
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
    if (options.command === 'lock') return await runLock(options);
    if (options.command === 'verify') return await runVerify(options);

    const { files, skipped } = await collectFiles(options.paths, options);
    const findings = files.flatMap((file) => analyzeFile({ filePath: path.relative(process.cwd(), file.filePath), content: file.content }));
    const report = createReport({ findings, filesScanned: files.length, skipped, root: options.paths.length ? options.paths.join(', ') : '.' });
    const rendered = options.format === 'json' ? JSON.stringify(report, null, 2) : options.format === 'sarif' ? JSON.stringify(toSarif(report), null, 2) : formatText(report, { color: options.color });
    await writeOutput(options.output, rendered);
    if (!files.length) {
      process.stderr.write('SkillGuard: no supported files could be scanned. Check the path and skipped-file details.\n');
      return 2;
    }
    const threshold = SEVERITY_ORDER[options.failOn];
    const shouldFail = options.failOn !== 'none' && findings.some((finding) => SEVERITY_ORDER[finding.severity] >= threshold);
    return shouldFail ? 1 : 0;
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
