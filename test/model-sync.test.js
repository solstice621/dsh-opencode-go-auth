import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModelSync, modelCacheStore } from '../src/model-sync.js';
import { OpenCodeGoError, keyFingerprint } from '../src/opencode-api.js';

const KEY = 'oc_sk_0308a826449c_glgjvXswCEqZN73tZUvOY2UxVCRzb5Cz';
const baseline = () => [
  { id: 'kimi-k3', api: 'openai-completions', name: 'Kimi K3', contextWindow: 1048576 },
  { id: 'grok-4.7', api: 'openai-responses', name: 'Grok 4.7' },
];
const source = key => ({ baseUrl: 'https://opencode.ai/zen/go/v1', read: async () => ({ key, source: 'file' }) });
const memoryStore = (initial = null) => ({
  data: initial,
  async read() { return this.data; },
  async write(value) { this.data = value; },
});
const sync = (options = {}) => new ModelSync({
  source: source(KEY), baseline: baseline(), store: memoryStore(), intervalMinutes: 360,
  schedule: () => undefined, unschedule: () => {}, now: () => 5000, ...options,
});

test('the cache store round-trips and refuses untrustworthy documents', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-go-auth-'));
  const path = join(dir, 'models.json');
  const store = modelCacheStore(path);
  await store.write({ version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 1234, models: ['kimi-k3'] });
  assert.deepEqual(await store.read(), { version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 1234, models: ['kimi-k3'] });

  for (const bad of [
    { version: 2, keyHash: keyFingerprint(KEY), fetchedAt: 1, models: ['kimi-k3'] },
    { version: 1, keyHash: 'not-a-hash', fetchedAt: 1, models: ['kimi-k3'] },
    { version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 0, models: ['kimi-k3'] },
    { version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 1, models: [] },
  ]) {
    await writeFile(path, JSON.stringify(bad));
    assert.equal(await store.read(), null);
  }
  await writeFile(path, '{not json');
  assert.equal(await store.read(), null);
});

test('a cache written by the same key restores the catalog before any network call', async () => {
  const store = memoryStore({ version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 1000, models: ['kimi-k3'] });
  const sync1 = sync({ store, fetchIds: async () => { throw new OpenCodeGoError('down', 'OPENCODE_GO_UNREACHABLE'); } });
  await sync1.start();
  assert.equal(sync1.state().source, 'cache');
  assert.deepEqual(sync1.models.map(model => model.id), ['kimi-k3', 'grok-4.7']);
  assert.equal(sync1.state().error, 'OPENCODE_GO_UNREACHABLE');
});

test('another key’s cache is never reused', async () => {
  const store = memoryStore({ version: 1, keyHash: keyFingerprint('oc_sk_someone_else'), fetchedAt: 1000, models: ['kimi-k3'] });
  const sync1 = sync({ store, fetchIds: async () => { throw new OpenCodeGoError('down', 'OPENCODE_GO_UNREACHABLE'); } });
  await sync1.start();
  assert.equal(sync1.state().source, 'bundled');
  assert.deepEqual(sync1.models.map(model => model.id), ['kimi-k3', 'grok-4.7']);
  assert.equal(sync1.state().discoveredModels, 0);
});

test('discovery publishes the live catalog and persists it for that key', async () => {
  const store = memoryStore();
  let replaced = 0;
  const sync1 = sync({ store, fetchIds: async () => ['kimi-k3', 'brand-new-model'], onUpdate: () => { replaced += 1; } });
  await sync1.start();
  const state = sync1.state();
  assert.equal(state.source, 'opencode');
  assert.equal(state.discoveredModels, 2);
  assert.equal(state.totalModels, 3);
  assert.deepEqual(state.availableModels, sync1.models.map(({ id, name }) => ({ id, name })));
  assert.equal(state.cacheSaved, true);
  assert.equal(replaced, 1);
  assert.deepEqual(sync1.models.map(model => model.id), ['kimi-k3', 'brand-new-model', 'grok-4.7']);
  assert.equal(store.data.keyHash, keyFingerprint(KEY));
  assert.deepEqual(store.data.models, ['kimi-k3', 'brand-new-model']);
});

test('a failed sync keeps the working catalog and surfaces the reason', async () => {
  const sync1 = sync({ fetchIds: async () => { throw new OpenCodeGoError('bad key', 'OPENCODE_GO_KEY_INVALID'); } });
  await sync1.start();
  assert.equal(sync1.state().source, 'bundled');
  assert.equal(sync1.state().error, 'OPENCODE_GO_KEY_INVALID');
  assert.deepEqual(sync1.models.map(model => model.id), ['kimi-k3', 'grok-4.7']);
  await assert.rejects(sync1.refresh(), error => error.code === 'OPENCODE_GO_KEY_INVALID');
});

test('a disabled connection neither schedules nor fetches', async () => {
  let fetched = 0;
  const sync1 = sync({ enabled: () => false, fetchIds: async () => { fetched += 1; return ['kimi-k3']; } });
  await sync1.start();
  assert.equal(fetched, 0);
  await assert.rejects(sync1.refresh(), error => error.code === 'OPENCODE_GO_CONNECTION_DISABLED');
  assert.equal(sync1.state().nextSyncAt, null);
});

test('public discovery works before login, persists a public snapshot, and survives credential removal', async () => {
  const store = memoryStore();
  let reads = 0;
  const sync1 = sync({ publicCatalog: true, store, source: { baseUrl: 'https://opencode.ai/zen/go/v1', read: async () => { reads++; throw new OpenCodeGoError('missing', 'OPENCODE_GO_AUTH_REQUIRED'); } },
    fetchIds: async options => { assert.equal(options.apiKey, undefined); return ['gemini-4-argon']; } });
  await sync1.start();
  assert.equal(reads, 0);
  assert.equal(sync1.state().source, 'opencode');
  assert.equal(sync1.state().error, null);
  assert.equal(sync1.state().publicCatalog, true);
  assert.deepEqual(store.data, { version: 2, scope: 'public', fetchedAt: 5000, models: ['gemini-4-argon'] });
  assert.equal(sync1.observeKey(undefined), false);
  assert(sync1.models.some(model => model.id === 'gemini-4-argon'));
  sync1.dispose();
});

test('public caches restore offline across logins, without reusing a legacy private snapshot', async () => {
  const cache = { version: 2, scope: 'public', fetchedAt: 1000, models: ['gemini-4-argon'] };
  const options = { publicCatalog: true, fetchIds: async () => { throw new OpenCodeGoError('offline', 'OPENCODE_GO_UNREACHABLE'); } };
  const restored = sync({ ...options, store: memoryStore(cache) });
  await restored.start();
  assert.equal(restored.state().source, 'cache');
  assert(restored.models.some(model => model.id === 'gemini-4-argon'));
  const legacy = sync({ ...options, store: memoryStore({ version: 1, keyHash: keyFingerprint(KEY), fetchedAt: 1000, models: ['private-model'] }) });
  await legacy.start();
  assert.equal(legacy.state().source, 'bundled');
  assert(!legacy.models.some(model => model.id === 'private-model'));
  restored.dispose(); legacy.dispose();
});

test('the disk cache accepts explicit public snapshots and rejects unsupported scopes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-go-public-'));
  const store = modelCacheStore(join(dir, 'models.json'));
  const value = { version: 2, scope: 'public', fetchedAt: 1234, models: ['gemini-4-argon'] };
  await store.write(value);
  assert.deepEqual(await store.read(), value);
  await store.write({ ...value, scope: 'private' });
  assert.equal(await store.read(), null);
});
