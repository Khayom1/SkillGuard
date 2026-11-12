/**
 * Lightweight, dependency-free data-flow heuristics for JS/TS and Python.
 * Not a full AST. Tracks simple identifier assignments from secret/env sources
 * to network or execution sinks within the same file.
 */

const JS_SOURCE = /\b(?:process\.env(?:\.[A-Za-z0-9_]+|\[[^\]]+\])|Deno\.env\.get\s*\(|os\.environ(?:\[[^\]]+\]|\.get\s*\())|os\.getenv\s*\()/;
const JS_ASSIGN = /(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;\n]+)/g;
const PY_ASSIGN = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/gm;

const SINK_PATTERNS = [
  /\bfetch\s*\(/,
  /\baxios\.(?:get|post|put|delete|request)\s*\(/,
  /\b(?:http|https)\.request\s*\(/,
  /\brequests?\.(?:get|post|put|delete|request)\s*\(/,
  /\burllib\.request\.urlopen\s*\(/,
  /\b(?:child_process\.)?(?:exec|execSync|spawn|spawnSync)\s*\(/,
  /\bsubprocess\.(?:run|call|Popen|check_output)\s*\(/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bcurl\b/,
  /\bwget\b/
];

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function isJsOrTs(filePath) {
  return /\.(?:js|mjs|cjs|ts|tsx|jsx)$/i.test(filePath);
}

function isPython(filePath) {
  return /\.py$/i.test(filePath);
}

function collectTaintedNames(text, language) {
  const tainted = new Set();
  // Direct sources count as tainted expressions too
  if (language === 'js') {
    let match;
    const assign = new RegExp(JS_ASSIGN.source, 'g');
    while ((match = assign.exec(text)) !== null) {
      const [, name, expr] = match;
      if (JS_SOURCE.test(expr) || /(?:secret|token|password|api[_-]?key|credential)/i.test(expr)) {
        tainted.add(name);
      }
    }
  } else if (language === 'py') {
    let match;
    const assign = new RegExp(PY_ASSIGN.source, 'gm');
    while ((match = assign.exec(text)) !== null) {
      const [, name, expr] = match;
      if (JS_SOURCE.test(expr) || /(?:secret|token|password|api[_-]?key|credential)/i.test(expr)) {
        tainted.add(name);
      }
    }
  }
  return tainted;
}

/**
 * @returns {Array<{ line: number, message: string, snippet: string }>}
 */
export function analyzeDataFlow({ filePath, content }) {
  if (!filePath || !content) return [];
  const language = isJsOrTs(filePath) ? 'js' : isPython(filePath) ? 'py' : null;
  if (!language) return [];

  const text = String(content);
  const lines = text.split(/\r?\n/);
  const tainted = collectTaintedNames(text, language);
  const findings = [];

  lines.forEach((line, index) => {
    const isSink = SINK_PATTERNS.some((re) => re.test(line));
    if (!isSink) return;

    // Source and sink on same line
    if (JS_SOURCE.test(line) || /(?:secret|token|password|api[_-]?key)/i.test(line)) {
      findings.push({
        line: index + 1,
        message: 'Possible data-flow: secret/environment source reaches a network or execution sink on the same line.',
        snippet: line
      });
      return;
    }

    for (const name of tainted) {
      const use = new RegExp(`(?:^|[^A-Za-z0-9_])${name}(?:[^A-Za-z0-9_]|$)`);
      if (use.test(line)) {
        findings.push({
          line: index + 1,
          message: `Possible data-flow: identifier "${name}" (assigned from env/secret-like source) reaches a network or execution sink.`,
          snippet: line
        });
        break;
      }
    }
  });

  return findings;
}

export function supportsDataFlow(filePath) {
  return isJsOrTs(filePath) || isPython(filePath);
}
