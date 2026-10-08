import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthController, authRpcHandler } from '../src/auth-controller.js';
import { OpenCodeGoError, keyFingerprint } from '../src/opencode-api.js';

const KEY = 'oc_sk_0308a826449c_glgjvXswCEqZN73tZUvOY2UxVCRzb5Cz';
const WINDOWS = [{ id: 'rolling', name: '5 小时额度', status: 'ok', usedPercent: 0, resetsAt: 1 }];

/** An in-memory stand-in for the credential seam, with observable writes. */
function fakeSource(key = KEY) {
  const box = { key };
  return {
    box,
    baseUrl: 'https://opencode.ai/zen/go/v1',
    read: async () => {
      if (!box.key) throw new OpenCodeGoError('none', 'OPENCODE_GO_AUTH_REQUIRED');
      return { key: box.key, source: 'file' };
    },
    describe: async () => ({ configured: Boolean(box.key), source: 'file', writable: true }),
    store: async value => { box.key = value; box.stored = value; },
    clear: async () => { box.key = undefined; box.cleared = true; },
  };
}

const noKeySource = () => ({ baseUrl: 'x', read: async () => { throw new OpenCodeGoError('none', 'OPENCODE_GO_AUTH_REQUIRED'); } });

/** Mirrors the real observer: it reports a change only when the key actually changed. */
function fakeModelSync() {
  const observed = [];
  let last = Symbol('unset');
  return {
    observed,
    observeKey: key => { const changed = key !== last; last = key; if (changed) observed.push(key); return changed; },
    tick: () => Promise.resolve(),
    state: () => null,
  };
}

test('state exposes a masked credential and never the key', async () => {
  const controller = new AuthController({ source: fakeSource(), now: () => 1000 });
  const state = await controller.getState();
  assert.equal(state.configured, true);
  assert.equal(state.connected, true);
  assert.equal(state.credential.label, 'oc_sk_030…b5Cz');
  assert.equal(state.credential.id, keyFingerprint(KEY).slice(0, 16));
  assert.equal(state.credential.writable, true);
  assert.equal(JSON.stringify(state).includes(KEY), false);
});

test('a machine with no key reports AUTH_REQUIRED and stays disconnected', async () => {
  const state = await new AuthController({ source: noKeySource() }).getState();
  assert.equal(state.configured, false);
  assert.equal(state.connected, false);
  assert.equal(state.credential, null);
  assert.equal(state.error, 'OPENCODE_GO_AUTH_REQUIRED');
});

test('a failed verification is remembered instead of reporting a healthy connection', async () => {
  const controller = new AuthController({ source: fakeSource(), fetchUsageImpl: async () => { throw new OpenCodeGoError('bad key', 'OPENCODE_GO_KEY_INVALID'); }, now: () => 2000 });
  await assert.rejects(controller.usage(), error => error.code === 'OPENCODE_GO_KEY_INVALID');
  const failed = await controller.getState();
  assert.equal(failed.configured, true);
  assert.equal(failed.connected, false);
  assert.equal(failed.error, 'OPENCODE_GO_KEY_INVALID');
  assert.equal(failed.verifiedAt, null);
});

test('a successful verification is remembered with its timestamp', async () => {
  const controller = new AuthController({ source: fakeSource(), fetchUsageImpl: async () => WINDOWS, now: () => 3000 });
  assert.deepEqual((await controller.usage()).windows, WINDOWS);
  const state = await controller.getState();
  assert.equal(state.connected, true);
  assert.equal(state.error, null);
  assert.equal(state.verifiedAt, 3000);
});

test('login validates the candidate before storing it', async () => {
  const source = fakeSource();
  const controller = new AuthController({ source, fetchUsageImpl: async () => { throw new OpenCodeGoError('rejected', 'OPENCODE_GO_KEY_INVALID'); } });
  await assert.rejects(controller.login('  oc_sk_bad  '), error => error.code === 'OPENCODE_GO_KEY_INVALID');
  assert.equal(source.box.stored, undefined);
  await assert.rejects(controller.login('   '), error => error.code === 'OPENCODE_GO_KEY_INVALID');
});

test('login stores the trimmed key and returns the usage it just verified', async () => {
  const source = fakeSource('oc_sk_previous_key_000000000000000000');
  const modelSync = fakeModelSync();
  const controller = new AuthController({ source, modelSync, fetchUsageImpl: async () => WINDOWS, now: () => 4000 });
  const result = await controller.login(`  ${KEY}  `);
  assert.equal(source.box.key, KEY);
  assert.equal(source.box.stored, KEY);
  assert.deepEqual(result.windows, WINDOWS);
  assert.equal(result.fetchedAt, 4000);
  assert.equal(result.connected, true);
  assert.deepEqual(modelSync.observed, [KEY]);
});

test('logout clears the key and reports an unconfigured machine', async () => {
  const source = fakeSource();
  const modelSync = fakeModelSync();
  const controller = new AuthController({ source, modelSync, fetchUsageImpl: async () => WINDOWS });
  await controller.usage();
  const state = await controller.logout();
  assert.equal(source.box.cleared, true);
  assert.equal(source.box.key, undefined);
  assert.equal(state.configured, false);
  assert.equal(state.connected, false);
  assert.deepEqual(modelSync.observed, [undefined]);
});

test('refresh needs a key before it talks to the network', async () => {
  await assert.rejects(new AuthController({ source: noKeySource() }).refresh(), error => error.code === 'OPENCODE_GO_AUTH_REQUIRED');
});

test('the RPC handler accepts only the documented payloads', async () => {
  const handle = authRpcHandler(new AuthController({ source: fakeSource(), fetchUsageImpl: async () => WINDOWS }));
  assert.equal((await handle('state', {})).ok, true);
  assert.equal((await handle('state', { key: 'x' })).error.code, 'OPENCODE_GO_BAD_REQUEST');
  assert.equal((await handle('nope', {})).error.code, 'OPENCODE_GO_BAD_REQUEST');
  assert.equal((await handle('state', null)).error.code, 'OPENCODE_GO_BAD_REQUEST');
  assert.equal((await handle('login', {})).error.code, 'OPENCODE_GO_BAD_REQUEST');
  assert.equal((await handle('login', { key: 'k', extra: 1 })).error.code, 'OPENCODE_GO_BAD_REQUEST');
  const loggedIn = await handle('login', { key: KEY });
  assert.equal(loggedIn.ok, true);
  assert.deepEqual(loggedIn.value.windows, WINDOWS);
});

test('the RPC handler maps unknown failures to a generic code', async () => {
  const controller = new AuthController({ source: fakeSource(), fetchUsageImpl: async () => { throw new TypeError('boom'); } });
  const result = await authRpcHandler(controller)('quota', {});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'OPENCODE_GO_OPERATION_FAILED');
});
