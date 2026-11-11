import fs from 'node:fs/promises';
import { constants } from 'node:fs';

/**
 * Read a regular file through an already-open file descriptor.
 *
 * The lstat/open/fstat identity checks prevent a path from being swapped for
 * a symlink between discovery and reading on platforms that expose inode
 * metadata. O_NOFOLLOW is used where supported. This is defense in depth,
 * not a substitute for scanning inside an isolated environment.
 */
export async function readRegularFile(filePath, options = {}) {
  const maxBytes = options.maxBytes ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error('maxBytes must be a non-negative safe integer.');
  }

  const before = await fs.lstat(filePath);
  if (before.isSymbolicLink()) {
    throw new Error('Refusing to read a symbolic link.');
  }
  if (!before.isFile()) {
    throw new Error('Refusing to read a non-regular file.');
  }

  let flags = constants.O_RDONLY;
  if (Number.isInteger(constants.O_NOFOLLOW)) flags |= constants.O_NOFOLLOW;
  if (Number.isInteger(constants.O_NONBLOCK)) flags |= constants.O_NONBLOCK;

  const handle = await fs.open(filePath, flags);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error('File identity changed while opening; retry the operation.');
    }
    if (
      opened.size !== before.size ||
      opened.mtimeMs !== before.mtimeMs ||
      opened.ctimeMs !== before.ctimeMs
    ) {
      throw new Error('File changed while opening; retry the operation.');
    }
    if (!Number.isSafeInteger(opened.size)) {
      throw new Error('File size is not a safe integer.');
    }
    if (opened.size > maxBytes) {
      return { oversized: true, stat: opened, bytes: null };
    }

    const bytes = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) {
        throw new Error('File was truncated while being read; retry the operation.');
      }
      offset += bytesRead;
    }

    const after = await handle.stat();
    if (
      !after.isFile() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs
    ) {
      throw new Error('File changed while being read; retry the operation.');
    }

    return { oversized: false, stat: after, bytes };
  } finally {
    await handle.close();
  }
}
