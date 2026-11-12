#!/usr/bin/env node
/**
 * Minimal offline MCP server (JSON-RPC over stdio) for SkillGuard.
 * Tools: skillguard_scan, skillguard_verify, skillguard_lock
 * No network, no execution of scanned content.
 */
import path from 'node:path';
import readline from 'node:readline';
import { VERSION } from './version.js';
import { analyzeFile, createReport } from './scanner.js';
import { collectFiles } from './files.js';
import { createIntegrityLock, verifyIntegrityLock } from './integrity.js';
import { readRegularFile } from './safe-fs.js';

function send(message) {
  const body = JSON.stringify(message);
  const frame = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
  process.stdout.write(frame);
}

function toolList() {
  return {
    tools: [
      {
        name: 'skillguard_scan',
        description: 'Offline static security scan of an AI agent skill path. Never executes content.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Skill directory or file path' },
            failOn: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'], default: 'high' }
          },
          required: ['path']
        }
      },
      {
        name: 'skillguard_verify',
        description: 'Verify a SkillGuard integrity lock against a skill directory.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            lock: { type: 'string', description: 'Optional lock file path' }
          },
          required: ['path']
        }
      },
      {
        name: 'skillguard_lock',
        description: 'Create a SHA-256 integrity lock for a skill directory.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            output: { type: 'string' }
          },
          required: ['path']
        }
      }
    ]
  };
}

async function callTool(name, args = {}) {
  if (name === 'skillguard_scan') {
    const target = path.resolve(args.path ?? '.');
    const { files, skipped } = await collectFiles([target], {});
    const findings = files.flatMap((file) => analyzeFile({
      filePath: path.relative(process.cwd(), file.filePath),
      content: file.content
    }));
    const report = createReport({ findings, filesScanned: files.length, skipped, root: target });
    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  }
  if (name === 'skillguard_lock') {
    const root = path.resolve(args.path ?? '.');
    const output = path.resolve(args.output ?? path.join(root, '.skillguard.lock.json'));
    const lock = await createIntegrityLock(root, { exclude: [output] });
    await import('node:fs/promises').then((fs) => fs.writeFile(output, `${JSON.stringify(lock, null, 2)}\n`, 'utf8'));
    return { content: [{ type: 'text', text: JSON.stringify({ output, files: lock.files.length }, null, 2) }] };
  }
  if (name === 'skillguard_verify') {
    const root = path.resolve(args.path ?? '.');
    const lockPath = path.resolve(args.lock ?? path.join(root, '.skillguard.lock.json'));
    const lockRead = await readRegularFile(lockPath, { maxBytes: 16 * 1024 * 1024 });
    const lock = JSON.parse(lockRead.bytes.toString('utf8'));
    const result = await verifyIntegrityLock(root, lock, { exclude: [lockPath] });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handleMessage(message) {
  if (!message || typeof message !== 'object') return;
  const { id, method, params } = message;
  try {
    if (method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'skillguard', version: VERSION }
        }
      });
      return;
    }
    if (method === 'notifications/initialized' || method === 'initialized') return;
    if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: toolList() });
      return;
    }
    if (method === 'tools/call') {
      const result = await callTool(params?.name, params?.arguments ?? {});
      send({ jsonrpc: '2.0', id, result });
      return;
    }
    if (method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} });
      return;
    }
    if (id !== undefined) {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (error) {
    if (id !== undefined) {
      send({ jsonrpc: '2.0', id, error: { code: -32000, message: error.message } });
    }
  }
}

async function main() {
  // Support both Content-Length framed MCP and newline-delimited JSON for simple clients
  let buffer = Buffer.alloc(0);
  process.stdin.on('data', async (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const header = buffer.subarray(0, headerEnd).toString('utf8');
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        if (!match) {
          buffer = buffer.subarray(headerEnd + 4);
          continue;
        }
        const length = Number(match[1]);
        const start = headerEnd + 4;
        if (buffer.length < start + length) return;
        const body = buffer.subarray(start, start + length).toString('utf8');
        buffer = buffer.subarray(start + length);
        try { await handleMessage(JSON.parse(body)); } catch { /* ignore malformed */ }
        continue;
      }
      // newline-delimited fallback
      const nl = buffer.indexOf('\n');
      if (nl === -1) return;
      const line = buffer.subarray(0, nl).toString('utf8').trim();
      buffer = buffer.subarray(nl + 1);
      if (!line) continue;
      try { await handleMessage(JSON.parse(line)); } catch { /* ignore */ }
    }
  });
}

main();
