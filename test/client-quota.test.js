import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const CLIENT = await readFile(new URL('../src/client.js', import.meta.url), 'utf8');
const A = 'aaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbb';
const sample = (fetchedAt, credentialId = A, usedPercent = 10, cached = false) => ({
  fetchedAt, credentialId, cached,
  windows: [{ id: 'rolling', name: '5 小时额度', usedPercent }],
});
const displayState = (identity = A) => ({
  enabled: true, connected: true, configured: true,
  credential: { id: identity, label: 'fake…key', writable: true },
  models: null, quotaSync: { intervalMinutes: 5, error: null },
});
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

/** Minimal deterministic hook/timer host: executes the actual shipped client, no React install or DOM. */
function mount() {
  let registration, Component, cursor = 0, tree;
  const hooks = [], pendingEffects = [], timers = new Map();
  let nextTimer = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useEffect(effect, deps) {
      const index = cursor++, previous = hooks[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          hooks[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const window = {
    __ModuleLoader__: { load: value => { registration = value; } },
    addEventListener() {}, removeEventListener() {},
    setInterval: (callback, ms) => { timers.set(++nextTimer, { callback, ms }); return nextTimer; },
    clearInterval: id => timers.delete(id),
  };
  vm.runInNewContext(CLIENT, { window });
  registration.factory(name => { assert.equal(name, 'react'); return React; }).apply({
    effect() {}, // Style effect does not matter for quota state or polling.
    slots: {
      inject: (_name, callback) => callback(),
      register: (_options, component) => { Component = component; },
    },
  });
  const remote = { state: displayState(), cached: sample(100, A, 10, true), quota: sample(200, A, 20), calls: [] };
  const rpc = async method => {
    remote.calls.push(method);
    const value = typeof remote[method] === 'function' ? await remote[method]() : await remote[method];
    if (value instanceof Error) return { ok: false, error: { code: 'OPENCODE_GO_UNREACHABLE', message: 'offline' } };
    return { ok: true, value };
  };
  const form = { getSnapshot: () => ({ value: { enabled: true }, writable: true }), subscribe() {} };
  function render() {
    cursor = 0; tree = Component({ rpc, form });
    for (const effect of pendingEffects.splice(0)) effect();
    return tree;
  }
  const walk = node => {
    if (Array.isArray(node)) return node.flatMap(walk);
    if (!node || typeof node !== 'object') return [];
    return [node, ...node.children.flatMap(walk)];
  };
  return {
    remote, render,
    quota: () => hooks[1],
    poll: async () => { for (const { callback } of [...timers.values()]) callback(); await flush(); render(); },
    refresh: async () => {
      const button = walk(tree).find(node => node.type === 'button' && node.children.includes('刷新额度'));
      assert(button); await button.props.onClick(); await flush(); render();
    },
    unmount: () => { for (const value of hooks) value?.cleanup?.(); },
    timers,
  };
}
async function ready() { const page = mount(); page.render(); await flush(); page.render(); return page; }

test('a settings page left open observes a newer backend disk quota snapshot every 30 seconds', async () => {
  const page = await ready();
  assert.equal(page.quota().fetchedAt, 200);
  assert.equal(page.timers.size, 2);
  for (const timer of page.timers.values()) assert.equal(timer.ms, 30000);
  page.remote.cached = sample(400, A, 40, true);
  await page.poll();
  assert.equal(page.quota().fetchedAt, 400);
  assert.equal(page.quota().windows[0].usedPercent, 40);
  assert.equal(page.remote.calls.filter(method => method === 'quota').length, 1, 'polling is disk-only, not repeated live quota');
  page.unmount();
  assert.equal(page.timers.size, 0);
});

test('cached polling errors and empty cache replies do not erase a good quota reading', async () => {
  const page = await ready();
  const good = page.quota();
  page.remote.cached = new Error('offline');
  await page.poll();
  assert.equal(page.quota(), good);
  page.remote.cached = null;
  await page.poll();
  assert.equal(page.quota(), good);
  page.unmount();
});

test('an older or equal-timestamp cache never downgrades the manual refresh result', async () => {
  const page = await ready();
  page.remote.refresh = { ...displayState(), ...sample(500, A, 50) };
  await page.refresh();
  assert.equal(page.quota().fetchedAt, 500, 'the account refresh button also updates displayed quota');
  const manuallyRefreshed = page.quota();
  for (const fetchedAt of [400, 500]) {
    page.remote.cached = sample(fetchedAt, A, 90, true);
    await page.poll();
    assert.equal(page.quota(), manuallyRefreshed);
  }
  page.unmount();
});

test('response identity blocks another key snapshot even before the state poll notices rotation', async () => {
  const page = await ready();
  const good = page.quota();
  page.remote.cached = sample(600, B, 90, true);
  await page.poll();
  assert.equal(page.quota(), good);
  page.unmount();
});

test('late cached replies from the prior displayed key are ignored after a state identity change', async () => {
  const page = await ready();
  const pending = deferred();
  page.remote.cached = pending.promise;
  const polling = page.poll();
  await flush();
  page.remote.state = displayState(B);
  await page.poll();
  assert.equal(page.quota(), null);
  pending.resolve(sample(700, A, 90, true));
  await polling; await flush(); page.render();
  assert.equal(page.quota(), null);
  page.unmount();
});

test('unmount ignores a late cache reply and removes only page-owned timers', async () => {
  const page = await ready();
  const good = page.quota(), pending = deferred();
  page.remote.cached = pending.promise;
  const polling = page.poll();
  await flush(); page.unmount();
  pending.resolve(sample(800, A, 80, true));
  await polling;
  assert.equal(page.quota(), good);
  assert.equal(page.timers.size, 0);
});
