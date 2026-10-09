import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthController } from '../src/auth-controller.js';
import { QuotaSync } from '../src/quota-sync.js';
import { OpenCodeGoError, keyFingerprint } from '../src/opencode-api.js';

const KEY = 'oc_sk_fake_quota_test_key_000000000000';
const NEXT = 'oc_sk_fake_quota_test_key_111111111111';
const WINDOWS = [{ id: 'rolling', usedPercent: 12, resetsAt: 9000000 }];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

function fixture({ initial = null, enabled = true, fetchUsageImpl, intervalMinutes } = {}) {
  let now = 1000000;
  const box = { key: KEY, enabled, reads: 0, fetches: 0, writes: 0, schedules: 0, clears: 0, unrefs: 0 };
  const source = {
    baseUrl: 'https://example.invalid/zen/go/v1',
    read: async () => {
      box.reads++;
      if (!box.key) throw new OpenCodeGoError('none', 'OPENCODE_GO_AUTH_REQUIRED');
      return { key: box.key, source: 'fake' };
    },
    store: async key => { box.key = key; }, clear: async () => { box.key = undefined; },
  };
  const store = {
    data: initial,
    read: async () => store.data,
    write: async (value, { shouldCommit = () => true, signal } = {}) => {
      if (!await shouldCommit()) return false;
      signal?.throwIfAborted();
      store.data = value; box.writes++;
      return true;
    },
    clear: async () => { store.data = null; },
  };
  const controller = new AuthController({
    source, enabled: () => box.enabled, quotaStore: store, now: () => now,
    fetchUsageImpl: options => {
      box.fetches++; box.signal = options.signal;
      return fetchUsageImpl ? fetchUsageImpl(options) : Promise.resolve(WINDOWS);
    },
  });
  const sync = new QuotaSync({
    controller, now: () => now, ...(intervalMinutes === undefined ? {} : { intervalMinutes }),
    schedule: (callback, ms) => {
      box.schedules++; box.callback = callback; box.ms = ms;
      return box.timer = { unref: () => { box.unrefs++; } };
    },
    unschedule: timer => { assert.equal(timer, box.timer); box.clears++; },
  });
  controller.quotaSync = sync;
  return { box, controller, sync, store, source, advance: ms => { now += ms; }, now: () => now };
}
const snapshot = (fetchedAt = 999000, key = KEY) => ({ version: 1, keyHash: keyFingerprint(key), fetchedAt, windows: WINDOWS });

test('starts immediately without cache and checks a five-minute TTL on a minute timer', async () => {
  const f = fixture();
  await f.sync.start();
  assert.equal(f.box.ms, 60000);
  assert.equal(f.box.schedules, 1);
  assert.equal(f.box.unrefs, 1);
  assert.equal(f.box.fetches, 1);
  assert.equal(f.box.writes, 1);
  assert.equal(f.sync.state().intervalMinutes, 5);
  assert.equal(f.sync.state().lastSyncAt, f.now());
  for (let minute = 1; minute < 5; minute++) {
    f.advance(60000); await f.box.callback();
    assert.equal(f.box.fetches, 1);
  }
  f.advance(60000); await f.box.callback();
  assert.equal(f.box.fetches, 2);
  await f.sync.start();
  assert.equal(f.box.schedules, 1, 'start is idempotent');
  f.sync.dispose(); f.sync.dispose();
  assert.equal(f.box.clears, 1);
  assert.equal(f.sync.state().nextSyncAt, null);
});

test('fresh matching successful disk data avoids an unnecessary initial request', async () => {
  const f = fixture({ initial: snapshot(880000) });
  await f.sync.start();
  assert.equal(f.box.fetches, 0);
  assert.equal(f.sync.state().lastSyncAt, 880000);
  f.advance(179999); await f.sync.tick();
  assert.equal(f.box.fetches, 0);
  f.advance(1); await f.sync.tick();
  assert.equal(f.box.fetches, 1);
  f.sync.dispose();
});

test('missing, stale, future and foreign snapshots all refresh on startup', async () => {
  for (const initial of [null, snapshot(600000), snapshot(1000001), snapshot(999000, NEXT)]) {
    const f = fixture({ initial });
    await f.sync.start();
    assert.equal(f.box.fetches, 1);
    assert.equal(f.store.data.keyHash, keyFingerprint(KEY));
    f.sync.dispose();
  }
});

test('failure preserves the successful snapshot and retries after five minutes, not every tick', async () => {
  const old = snapshot(600000);
  const f = fixture({ initial: old, fetchUsageImpl: async () => { throw new OpenCodeGoError('offline', 'OPENCODE_GO_UNREACHABLE'); } });
  await f.sync.start();
  assert.equal(f.sync.state().error, 'OPENCODE_GO_UNREACHABLE');
  assert.equal(f.store.data, old);
  assert.equal(f.box.writes, 0);
  f.advance(60000); await f.sync.tick();
  assert.equal(f.box.fetches, 1);
  f.advance(240000); await f.sync.tick();
  assert.equal(f.box.fetches, 2);
  assert.equal(f.store.data, old);
  f.sync.dispose();
});

test('disabled connection skips credentials, disk and network; reenable resumes without a page', async () => {
  const f = fixture({ enabled: false });
  await f.sync.start();
  assert.equal(f.box.reads, 0);
  assert.equal(f.box.fetches, 0);
  assert.equal(f.sync.state().nextSyncAt, null);
  await assert.rejects(f.controller.usage(), error => error.code === 'OPENCODE_GO_CONNECTION_DISABLED');
  f.box.enabled = true;
  await f.box.callback();
  assert.equal(f.box.fetches, 1);
  f.box.enabled = false;
  f.advance(300000); await f.box.callback();
  assert.equal(f.box.fetches, 1);
  f.sync.dispose();
});

test('manual quota, refresh and concurrent background ticks share a single network request', async () => {
  const network = deferred();
  const f = fixture({ fetchUsageImpl: () => network.promise });
  const start = f.sync.start();
  await flush();
  const manual = f.controller.usage();
  const refresh = f.controller.refresh();
  const ticks = [f.sync.tick(), f.sync.tick()];
  await flush();
  assert.equal(f.box.fetches, 1);
  network.resolve(WINDOWS);
  const [background, usage, refreshed] = await Promise.all([start, manual, refresh, ...ticks]);
  assert.equal(background.lastSyncAt, f.now());
  assert.deepEqual(usage.windows, WINDOWS);
  assert.deepEqual(refreshed.windows, WINDOWS);
  assert.equal(f.box.writes, 1);
  assert.equal(f.controller.quotaPending, undefined);
  f.sync.dispose();
});

test('recent manual failures and successes throttle background network attempts too', async () => {
  for (const fail of [false, true]) {
    const f = fixture({ fetchUsageImpl: async () => {
      if (fail) throw new OpenCodeGoError('offline', 'OPENCODE_GO_UNREACHABLE');
      return WINDOWS;
    } });
    if (fail) await assert.rejects(f.controller.usage()); else await f.controller.usage();
    await f.sync.start();
    assert.equal(f.box.fetches, 1);
    f.advance(300000); await f.sync.tick();
    assert.equal(f.box.fetches, 2);
    f.sync.dispose();
  }
});

test('dispose aborts outstanding quota reads and ignores a late successful response', async () => {
  const network = deferred();
  const f = fixture({ initial: snapshot(600000), fetchUsageImpl: () => network.promise });
  const old = f.store.data;
  const start = f.sync.start();
  await flush();
  const manual = f.controller.usage();
  const rejected = assert.rejects(manual, error => error.code === 'OPENCODE_GO_CANCELLED');
  await flush();
  f.sync.dispose();
  assert.equal(f.box.signal.aborted, true);
  network.resolve(WINDOWS); // Simulate a transport that ignores AbortSignal.
  await Promise.all([start, rejected]);
  assert.equal(f.store.data, old);
  assert.equal(f.box.writes, 0);
  assert.equal(f.controller.verification, undefined);
  assert.equal(f.sync.state().lastSyncAt, old.fetchedAt);
  assert.equal(f.sync.state().error, null);
  await f.sync.tick();
  assert.equal(f.box.fetches, 1);
});

test('disable while a request is in flight prevents saving or reporting its reply', async () => {
  const network = deferred();
  const f = fixture({ fetchUsageImpl: () => network.promise });
  const start = f.sync.start();
  await flush();
  f.box.enabled = false;
  network.resolve(WINDOWS);
  await start;
  assert.equal(f.box.writes, 0);
  assert.equal(f.controller.verification, undefined);
  assert.equal(f.sync.state().lastSyncAt, null);
  f.sync.dispose();
});

test('rotating or removing the key during a reply never persists or reports the old key result', async () => {
  for (const next of [NEXT, undefined]) {
    for (const success of [true, false]) {
      const network = deferred();
      const f = fixture({ fetchUsageImpl: () => network.promise });
      const manual = f.controller.usage();
      const rejected = assert.rejects(manual, error => error.code === 'OPENCODE_GO_KEY_CHANGED');
      await flush();
      f.box.key = next;
      if (success) network.resolve(WINDOWS); else network.reject(new OpenCodeGoError('old failure', 'OPENCODE_GO_KEY_INVALID'));
      await rejected;
      assert.equal(f.box.writes, 0);
      assert.equal(f.controller.verification, undefined);
      f.sync.dispose();
    }
  }
});

test('a rotated key can start its own request and a previous coalesced request is aborted', async () => {
  const first = deferred(), second = deferred();
  const signals = [];
  const f = fixture({ fetchUsageImpl: ({ apiKey, signal }) => {
    signals.push(signal); return apiKey === KEY ? first.promise : second.promise;
  } });
  const oldRead = f.controller.usage();
  const rejected = assert.rejects(oldRead, error => error.code === 'OPENCODE_GO_CANCELLED');
  await flush();
  f.box.key = NEXT;
  const nextRead = f.controller.usage();
  await flush();
  assert.equal(signals[0].aborted, true);
  second.resolve(WINDOWS);
  const usage = await nextRead;
  first.resolve([{ id: 'rolling', usedPercent: 90 }]);
  await rejected;
  assert.equal(usage.credentialId, keyFingerprint(NEXT).slice(0, 16));
  assert.equal(f.box.writes, 1);
  assert.equal(f.store.data.keyHash, keyFingerprint(NEXT));
  assert.deepEqual(f.store.data.windows, WINDOWS);
  f.sync.dispose();
});

test('a key rotated during background refresh does not report the old response and refreshes the new key next tick', async () => {
  const first = deferred();
  const f = fixture({ fetchUsageImpl: ({ apiKey }) => apiKey === KEY ? first.promise : Promise.resolve(WINDOWS) });
  const started = f.sync.start();
  await flush(); f.box.key = NEXT;
  first.resolve([{ id: 'rolling', usedPercent: 90 }]);
  await started;
  assert.equal(f.box.writes, 0);
  assert.equal(f.sync.state().lastSyncAt, null);
  assert.equal(f.sync.state().error, null);
  await f.sync.tick();
  assert.equal(f.box.fetches, 2);
  assert.equal(f.store.data.keyHash, keyFingerprint(NEXT));
  f.sync.dispose();
});

test('successful login persists a snapshot and avoids an immediate redundant background read', async () => {
  const f = fixture();
  const loggedIn = await f.controller.login(NEXT);
  assert.equal(loggedIn.credentialId, keyFingerprint(NEXT).slice(0, 16));
  assert.equal(f.store.data.keyHash, keyFingerprint(NEXT));
  await f.sync.start();
  assert.equal(f.box.fetches, 1);
  f.sync.dispose();
});

test('key changes while reading disk never return the old snapshot', async () => {
  const disk = deferred();
  const f = fixture({ initial: snapshot() });
  f.store.read = () => disk.promise;
  const cached = f.controller.cachedUsage();
  await flush();
  f.box.key = NEXT;
  disk.resolve(snapshot());
  assert.equal(await cached, null);
  f.sync.dispose();
});

test('disposal or key rotation during an asynchronous cache write blocks both commit and reply', async () => {
  for (const dispose of [true, false]) {
    const f = fixture({ initial: snapshot(600000) });
    const old = f.store.data;
    const entered = deferred(), release = deferred();
    f.store.write = async (value, options) => {
      entered.resolve(); await release.promise;
      await options.shouldCommit(); options.signal.throwIfAborted();
      f.store.data = value; f.box.writes++;
    };
    const usage = f.controller.usage();
    const rejected = assert.rejects(usage, error => error.code === (dispose ? 'OPENCODE_GO_CANCELLED' : 'OPENCODE_GO_KEY_CHANGED'));
    await entered.promise;
    if (dispose) f.sync.dispose(); else f.box.key = NEXT;
    release.resolve();
    await rejected;
    assert.equal(f.store.data, old);
    assert.equal(f.box.writes, 0);
    assert.equal(f.controller.verification, undefined);
    f.sync.dispose();
  }
});

test('clock rollback and future attempt timestamps do not freeze scheduled refresh', async () => {
  const f = fixture();
  await f.sync.start();
  f.advance(-500000);
  assert.equal(f.sync.state().lastAttemptAt, null);
  await f.sync.tick();
  assert.equal(f.box.fetches, 2);
  assert.equal(f.sync.state().lastSyncAt, f.now());
  f.controller.quotaAttempt = { keyHash: keyFingerprint(KEY), at: f.now() + 5000000 };
  f.advance(300000);
  await f.sync.tick();
  assert.equal(f.box.fetches, 3);
  f.sync.dispose();
});

test('scheduler exposes only display-safe timing state and validates configured bounds', async () => {
  const f = fixture({ intervalMinutes: 1 });
  await f.sync.start();
  const state = (await f.controller.getState()).quotaSync;
  assert.equal(state.intervalMinutes, 1);
  assert.equal(JSON.stringify(state).includes(KEY), false);
  f.advance(60000); await f.sync.tick();
  assert.equal(f.box.fetches, 2);
  for (const intervalMinutes of [0, 1441, NaN, Infinity]) {
    assert.throws(() => new QuotaSync({ controller: f.controller, intervalMinutes }), /between 1 and 1440/);
  }
  f.sync.dispose();
});
