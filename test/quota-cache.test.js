import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeCachedWindows, quotaCacheFile, quotaCacheStore } from '../src/quota-cache.js';
import { keyFingerprint } from '../src/opencode-api.js';

const KEY = 'oc_sk_0308a826449c_glgjvXswCEqZN73tZUvOY2UxVCRzb5Cz';
const windows = () => [
  { id: 'rolling', name: '5 小时额度', nameEn: '5-hour window', status: 'ok', usedPercent: 2, resetsAt: 1791477749000 },
  { id: 'weekly', name: '每周额度', nameEn: 'Weekly window', status: 'ok', usedPercent: 0, resetsAt: 1791763200000 },
  { id: 'monthly', name: '每月额度', nameEn: 'Monthly window', status: 'rate-limited', usedPercent: 70, resetsAt: 1792050543000 },
];

test('the cache path follows DSH_HOME and the base URL', () => {
  assert.match(quotaCacheFile('https://opencode.ai/zen/go/v1', { DSH_HOME: '/custom' }), /^\/custom\/cache\/dsh-opencode-go-auth\/[a-f0-9]{16}\/quota\.json$/);
  assert.notEqual(quotaCacheFile('https://a', {}), quotaCacheFile('https://b', {}));
});

test('the store round-trips through disk and clears', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-go-quota-'));
  const store = quotaCacheStore(join(dir, 'quota.json'));
  await store.write({ version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 4321, windows: windows() });
  const read = await store.read();
  assert.equal(read.fetchedAt, 4321);
  assert.equal(read.keyHash, keyFingerprint(KEY));
  assert.equal(read.windows.length, 3);
  assert.equal(read.windows[2].status, 'rate-limited');
  await store.clear();
  assert.equal(await store.read(), null);
});

test('the store refuses documents it cannot trust', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-go-quota-'));
  const path = join(dir, 'quota.json');
  const store = quotaCacheStore(path);
  for (const bad of [
    { version: 2, keyHash: keyFingerprint(KEY), fetchedAt: 1, windows: windows() },
    { version: 1, keyHash: 'not-a-hash', fetchedAt: 1, windows: windows() },
    { version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 0, windows: windows() },
    { version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 1, windows: [] },
    { version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 1, windows: 'nope' },
  ]) {
    await writeFile(path, JSON.stringify(bad));
    assert.equal(await store.read(), null);
  }
  await writeFile(path, '{not json');
  assert.equal(await store.read(), null);
});

test('cached windows are sanitized and clamped', () => {
  const normalized = normalizeCachedWindows([
    { id: 'rolling', usedPercent: 130, resetsAt: 'nope' },
    { id: 'monthly', status: 'weird', usedPercent: 5, resetsAt: 10 },
  ]);
  assert.equal(normalized[0].usedPercent, 100);
  assert.equal(normalized[0].resetsAt, null);
  assert.equal(normalized[0].name, '5 小时额度');
  assert.equal(normalized[1].status, 'ok');
  assert.equal(normalized[1].nameEn, 'Monthly window');
  assert.throws(() => normalizeCachedWindows(new Array(11).fill({ id: 'x' })), /Invalid quota cache/);
  assert.throws(() => normalizeCachedWindows('nope'), /Invalid quota cache/);
});
