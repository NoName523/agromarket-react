import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 15_000;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function validateSource(source) {
  if (!source || source.repository !== 'NoName523/agromarket-server' ||
      source.path !== 'shared/schemas/index.js') {
    throw new Error('Schema source must be NoName523/agromarket-server/shared/schemas/index.js.');
  }
  if (typeof source.commit !== 'string' || source.commit.length !== 40 || !/^[a-f\d]{40}$/i.test(source.commit)) {
    throw new Error('Set commit in schemas-source.json to a full 40-character commit SHA.');
  }
  if (typeof source.sha256 !== 'string' || source.sha256.length !== 64 || !/^[a-f\d]{64}$/i.test(source.sha256)) {
    throw new Error('Set sha256 in schemas-source.json to the 64-character SHA-256 of the source file.');
  }
}

export async function syncSchemas({ root = ROOT, fetchImpl = globalThis.fetch } = {}) {
  const source = JSON.parse(await readFile(resolve(root, 'schemas-source.json'), 'utf8'));
  validateSource(source);
  const expectedHash = source.sha256.toLowerCase();
  const target = resolve(root, 'src/generated/schemas.js');
  try {
    const local = await readFile(target);
    if (local.length <= MAX_BYTES && digest(local) === expectedHash) return { cached: true };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  // Only a fixed GitHub host/repository/path and a validated immutable revision are allowed.
  const url = `https://raw.githubusercontent.com/NoName523/agromarket-server/${source.commit}/shared/schemas/index.js`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let bytes;
  try {
    const response = await fetchImpl(url, { redirect: 'error', signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Schema download failed: HTTP ${response.status}.`);
    }
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) {
      await response.body?.cancel();
      throw new Error(`Schema download exceeds the ${MAX_BYTES}-byte limit.`);
    }
    if (!response.body) throw new Error('Schema download returned an empty response body.');
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) throw new Error(`Schema download exceeds the ${MAX_BYTES}-byte limit.`);
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    bytes = Buffer.concat(chunks, total);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Schema download timed out after 15 seconds.', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (digest(bytes) !== expectedHash) throw new Error('Schema SHA-256 mismatch; the local file was not replaced.');
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return { cached: false };
}

// Importing this module for tests never starts a download or executes the downloaded source.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncSchemas().then(({ cached }) => {
    console.log(cached ? 'Verified local schemas.' : 'Downloaded and verified schemas.');
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
