undefined
test('rejects unsafe and duplicate paths in integrity locks', async (t) => {
  const root = await fixture(t);
  const lock = await createIntegrityLock(root);
  const unsafe = structuredClone(lock);
  unsafe.files[0].path = '../outside.txt';
  await assert.rejects(() => verifyIntegrityLock(root, unsafe), /normalized relative paths/i);
  const duplicate = structuredClone(lock);
  duplicate.files.push({ ...duplicate.files[0] });
  await assert.rejects(() => verifyIntegrityLock(root, duplicate), /duplicate path/i);
});

test('enforces a total byte budget while creating integrity locks', async (t) => {
  const root = await fixture(t);
  await assert.rejects(() => createIntegrityLock(root, { maxTotalBytes: 8 }), /total size limit/i);
});
