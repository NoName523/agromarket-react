import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncSchemas } from './sync-schemas.js';

const content = 'export const sample = true;\n';
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
// Synthetic revision used only with injected HTTP stubs; no real network requests.
const source = { repository: 'NoName523/agromarket-server', commit: 'a'.repeat(40),
  path: 'shared/schemas/index.js', sha256: sha256(content) };

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'agromarket-sync-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'schemas-source.json'), JSON.stringify({ ...source, ...overrides }));
  return root;
}

for (const commit of ['', 'main', 'master', 'a'.repeat(39), 'z'.repeat(40), '../main']) {
  test(`rejects invalid commit ${JSON.stringify(commit)} before HTTP`, async (t) => {
    const root = await fixture(t, { commit });
    await assert.rejects(syncSchemas({ root, fetchImpl: () => assert.fail('Unexpected HTTP') }),
      /40-character commit SHA/);
  });
}

test('rejects missing SHA-256 before HTTP', async (t) => {
  const root = await fixture(t, { sha256: '' });
  await assert.rejects(syncSchemas({ root, fetchImpl: () => assert.fail('Unexpected HTTP') }),
    /Set sha256/);
});

for (const overrides of [{ repository: 'someone/other' }, { path: '../app.js' }]) {
  test(`rejects an unknown source ${JSON.stringify(overrides)}`, async (t) => {
    const root = await fixture(t, overrides);
    await assert.rejects(syncSchemas({ root, fetchImpl: () => assert.fail('Unexpected HTTP') }),
      /Schema source must be/);
  });
}

test('rejects hash mismatch and preserves the existing local file', async (t) => {
  const root = await fixture(t);
  const target = join(root, 'src/generated/schemas.js');
  await mkdir(join(root, 'src/generated'), { recursive: true });
  await writeFile(target, 'previous contents');
  await assert.rejects(syncSchemas({ root, fetchImpl: async () => new Response('tampered') }),
    /SHA-256 mismatch/);
  assert.equal(await readFile(target, 'utf8'), 'previous contents');
  assert.deepEqual(await readdir(join(root, 'src/generated')), ['schemas.js']);
});

test('rejects HTTP errors without writing a target', async (t) => {
  const root = await fixture(t);
  await assert.rejects(syncSchemas({ root,
    fetchImpl: async () => new Response('Not found', { status: 404 }) }), /HTTP 404/);
  await assert.rejects(readFile(join(root, 'src/generated/schemas.js')), { code: 'ENOENT' });
});

test('rejects an oversized declared response', async (t) => {
  const root = await fixture(t);
  await assert.rejects(syncSchemas({ root, fetchImpl: async () =>
    new Response(content, { headers: { 'content-length': '65537' } }) }), /byte limit/);
});

test('rejects oversized streamed content without trusting Content-Length', async (t) => {
  const root = await fixture(t);
  await assert.rejects(syncSchemas({ root,
    fetchImpl: async () => new Response('x'.repeat(65537)) }), /byte limit/);
  await assert.rejects(readFile(join(root, 'src/generated/schemas.js')), { code: 'ENOENT' });
});

test('downloads from the pinned URL and writes exact verified bytes', async (t) => {
  const root = await fixture(t);
  const result = await syncSchemas({ root, fetchImpl: async (url, options) => {
    assert.equal(url, `https://raw.githubusercontent.com/NoName523/agromarket-server/${source.commit}/shared/schemas/index.js`);
    assert.equal(options.redirect, 'error');
    assert.equal(options.signal.aborted, false);
    return new Response(content);
  } });
  assert.deepEqual(result, { cached: false });
  assert.equal(await readFile(join(root, 'src/generated/schemas.js'), 'utf8'), content);
  assert.deepEqual(await readdir(join(root, 'src/generated')), ['schemas.js']);
});

test('reuses a verified local file without HTTP', async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, 'src/generated'), { recursive: true });
  await writeFile(join(root, 'src/generated/schemas.js'), content);
  assert.deepEqual(await syncSchemas({ root, fetchImpl: () => assert.fail('Unexpected HTTP') }),
    { cached: true });
});

test('does not execute downloaded code', async (t) => {
  const payload = 'throw new Error("Downloaded code must never run");';
  const root = await fixture(t, { sha256: sha256(payload) });
  await syncSchemas({ root, fetchImpl: async () => new Response(payload) });
  assert.equal(await readFile(join(root, 'src/generated/schemas.js'), 'utf8'), payload);
});
