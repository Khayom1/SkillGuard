import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const inflateRaw = promisify(zlib.inflateRaw);

const DEFAULTS = Object.freeze({
  maxEntries: 2000,
  maxUncompressedTotal: 32 * 1024 * 1024,
  maxUncompressedFile: 2 * 1024 * 1024,
  maxCompressedFile: 4 * 1024 * 1024,
  maxArchiveBytes: 40 * 1024 * 1024
});

function readU16(buf, offset) {
  return buf.readUInt16LE(offset);
}

function readU32(buf, offset) {
  return buf.readUInt32LE(offset);
}

function isSafeZipPath(name) {
  if (!name || typeof name !== 'string') return false;
  const normalized = name.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.includes('\0')) return false;
  if (normalized.split('/').some((part) => part === '..')) return false;
  if (/^[A-Za-z]:/.test(normalized)) return false;
  return true;
}

function findEndOfCentralDirectory(buf) {
  // EOCD is at least 22 bytes; comment up to 65535
  const min = Math.max(0, buf.length - (22 + 65535));
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (readU32(buf, i) === 0x06054b50) return i;
  }
  return -1;
}

/**
 * Read a ZIP archive into memory and return text members only.
 * Never writes extracted files to disk. Rejects traversal, symlinks (via external attrs when present),
 * oversized entries, and zip bombs via aggregate uncompressed limits.
 */
export async function readZipTextMembers(archivePath, options = {}) {
  const limits = { ...DEFAULTS, ...options };
  const absolute = path.resolve(archivePath);
  const stat = await fs.lstat(absolute);
  if (stat.isSymbolicLink()) throw new Error('Refusing to read a ZIP through a symbolic link.');
  if (!stat.isFile()) throw new Error('ZIP path must be a regular file.');
  if (stat.size > limits.maxArchiveBytes) throw new Error(`ZIP exceeds max archive size (${limits.maxArchiveBytes} bytes).`);

  const buf = Buffer.from(await fs.readFile(absolute));
  if (buf.length < 22) throw new Error('ZIP archive is too small or corrupt.');

  const eocd = findEndOfCentralDirectory(buf);
  if (eocd < 0) throw new Error('ZIP end-of-central-directory not found.');

  const totalEntries = readU16(buf, eocd + 10);
  const centralOffset = readU32(buf, eocd + 16);
  if (totalEntries > limits.maxEntries) throw new Error(`ZIP has too many entries (${totalEntries} > ${limits.maxEntries}).`);
  if (centralOffset >= buf.length) throw new Error('ZIP central directory offset is invalid.');

  const members = [];
  const skipped = [];
  let cursor = centralOffset;
  let uncompressedTotal = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > buf.length || readU32(buf, cursor) !== 0x02014b50) {
      throw new Error('ZIP central directory is corrupt.');
    }
    const compression = readU16(buf, cursor + 10);
    const compressedSize = readU32(buf, cursor + 20);
    const uncompressedSize = readU32(buf, cursor + 24);
    const nameLen = readU16(buf, cursor + 28);
    const extraLen = readU16(buf, cursor + 30);
    const commentLen = readU16(buf, cursor + 32);
    const externalAttrs = readU32(buf, cursor + 38);
    const localHeaderOffset = readU32(buf, cursor + 42);
    const name = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
    cursor += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue; // directory entry
    if (!isSafeZipPath(name)) {
      skipped.push({ file: name, reason: 'Unsafe ZIP path rejected (traversal or absolute path).' });
      continue;
    }
    // Unix symlink: high byte of external attrs often 0o120000 when created on Unix
    const mode = (externalAttrs >>> 16) & 0xffff;
    if ((mode & 0xf000) === 0xa000) {
      skipped.push({ file: name, reason: 'ZIP symlink entry rejected.' });
      continue;
    }
    if (compressedSize > limits.maxCompressedFile || uncompressedSize > limits.maxUncompressedFile) {
      skipped.push({ file: name, reason: 'ZIP entry exceeds size limits.' });
      continue;
    }
    if (uncompressedTotal + uncompressedSize > limits.maxUncompressedTotal) {
      skipped.push({ file: name, reason: 'ZIP uncompressed total size limit reached.' });
      continue;
    }
    if (compression !== 0 && compression !== 8) {
      skipped.push({ file: name, reason: `Unsupported ZIP compression method ${compression}.` });
      continue;
    }
    if (localHeaderOffset + 30 > buf.length || readU32(buf, localHeaderOffset) !== 0x04034b50) {
      skipped.push({ file: name, reason: 'ZIP local header is corrupt.' });
      continue;
    }
    const localNameLen = readU16(buf, localHeaderOffset + 26);
    const localExtraLen = readU16(buf, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) {
      skipped.push({ file: name, reason: 'ZIP entry data extends past archive end.' });
      continue;
    }
    const compressed = buf.subarray(dataStart, dataEnd);
    let raw;
    try {
      raw = compression === 0 ? Buffer.from(compressed) : await inflateRaw(compressed);
    } catch {
      skipped.push({ file: name, reason: 'ZIP entry failed to decompress.' });
      continue;
    }
    if (raw.length !== uncompressedSize && uncompressedSize !== 0) {
      // Some writers leave size 0 in local header; still bound by maxUncompressedFile via inflate output length
      if (raw.length > limits.maxUncompressedFile) {
        skipped.push({ file: name, reason: 'Decompressed ZIP entry exceeds size limit.' });
        continue;
      }
    }
    uncompressedTotal += raw.length;
    if (raw.includes(0)) {
      skipped.push({ file: name, reason: 'Binary ZIP member skipped.' });
      continue;
    }
    members.push({ filePath: name.replace(/\\/g, '/'), content: raw.toString('utf8') });
  }

  return { members, skipped, archivePath: absolute };
}
