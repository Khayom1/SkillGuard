import fs from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';

function isWithinDirectory(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(\`..\${path.sep}\`) && !path.isAbsolute(relative));
}

/**
 * Read a regular file through an already-open file descriptor.
 *
 * O_NOFOLLOW, inode checks, canonical-root checks, and before/after metadata
 * checks reduce common symlink-swap and file-mutation risks. This remains
 * defense in depth; scan untrusted bundles in an isolated environment.
 */
export async function readRegularFile(filePath, options = {}) {
  const maxBytes = options.maxBytes ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error('maxBytes must be a non-negative safe integer.');
  }

  const allowedRoot = options.allowedRoot ? await fs.realpath(options.allowedRoot) : null;
  const canonicalBefore = await fs.realpath(filePath);
  if (allowedRoot && !isWithinDirectory(allowedRoot, canonicalBefore)) {
    throw new Error('Refusing to read a file outside the scan root.');
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
    const pathAfter = await fs.lstat(filePath);
    const canonicalAfter = await fs.realpath(filePath);
    if (
      !after.isFile() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs ||
      pathAfter.isSymbolicLink() ||
      !pathAfter.isFile() ||
      pathAfter.dev !== opened.dev ||
      pathAfter.ino !== opened.ino ||
      (allowedRoot && !isWithinDirectory(allowedRoot, canonicalAfter)) ||
      canonicalBefore !== canonicalAfter
    ) {
      throw new Error('File changed while being read; retry the operation.');
    }

    return { oversized: false, stat: after, bytes };
  } finally {
    await handle.close();
  }
}
