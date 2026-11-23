import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SystemProxyBridge, parseSystemProxy, withSystemProxy } from '../src/system-proxy.js';

const scutil = ({ http, https, pac, socks }) => [
  'HTTPEnable : ' + (http ? 1 : 0),
  'HTTPPort : ' + (http?.port ?? 0),
  'HTTPProxy : ' + (http?.host ?? ''),
  'HTTPSEnable : ' + (https ? 1 : 0),
  'HTTPSPort : ' + (https?.port ?? 0),
  'HTTPSProxy : ' + (https?.host ?? ''),
  'ProxyAutoConfigEnable : ' + (pac ? 1 : 0),
  'SOCKSEnable : ' + (socks ? 1 : 0),
  '',
].join('\n');

test('a static HTTPS proxy becomes the transport environment', () => {
  const environment = parseSystemProxy(scutil({ https: { host: '127.0.0.1', port: 7890 } }));
  assert.deepEqual(environment, { HTTPS_PROXY: 'http://127.0.0.1:7890', NO_PROXY: 'localhost,127.0.0.1,::1,[::1]' });
});

test('HTTP and HTTPS proxies are both carried over', () => {
  const environment = parseSystemProxy(scutil({ http: { host: '10.0.0.2', port: 3128 }, https: { host: '10.0.0.2', port: 3129 } }));
  assert.equal(environment.HTTP_PROXY, 'http://10.0.0.2:3128');
  assert.equal(environment.HTTPS_PROXY, 'http://10.0.0.2:3129');
});

test('bypass entries join the no-proxy list without duplicates', () => {
  const text = `${scutil({ https: { host: 'proxy.local', port: 8080 } })}\nExceptionsList : <array> {\n  0 : *.local\n  1 : 127.0.0.1\n}\n`;
  const environment = parseSystemProxy(text);
  assert.equal(environment.NO_PROXY, 'localhost,127.0.0.1,::1,[::1],*.local');
});

test('PAC-only and SOCKS-only settings are refused rather than silently ignored', () => {
  assert.throws(() => parseSystemProxy(scutil({ pac: true })), error => error.code === 'SYSTEM_PROXY_UNSUPPORTED');
  assert.throws(() => parseSystemProxy(scutil({ socks: true })), error => error.code === 'SYSTEM_PROXY_UNSUPPORTED');
  assert.deepEqual(parseSystemProxy(scutil({})), { NO_PROXY: 'localhost,127.0.0.1,::1,[::1]' });
});

test('an implausible proxy host or port is refused', () => {
  assert.throws(() => parseSystemProxy(scutil({ https: { host: 'bad host', port: 8080 } })), error => error.code === 'SYSTEM_PROXY_INVALID');
  assert.throws(() => parseSystemProxy(scutil({ https: { host: 'proxy.local', port: 0 } })), error => error.code === 'SYSTEM_PROXY_INVALID');
  assert.throws(() => parseSystemProxy(scutil({ https: { host: 'proxy.local', port: 70000 } })), error => error.code === 'SYSTEM_PROXY_INVALID');
});

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const environment = port => parseSystemProxy(scutil({ https: { host: 'proxy.local', port } }));

function fixture() {
  let current = environment(8080);
  const created = [], closed = [];
  const bridge = new SystemProxyBridge({
    enabled: true, read: async () => { if (current instanceof Error) throw current; return current; },
    create: async env => {
      const id = env.HTTPS_PROXY ?? 'direct';
      created.push(id);
      return { run: fn => fn(), close: async () => { closed.push(id); } };
    },
  });
  return { bridge, created, closed, change: value => { current = value; } };
}

test('proxy A → B → direct → A automatically recovers without restarting', async () => {
  const { bridge, created, closed, change } = fixture();
  await bridge.start();
  await bridge.run(() => 'first');
  change(environment(8081));
  assert.equal(await bridge.run(() => 'second'), 'second');
  change(parseSystemProxy(scutil({})));
  await bridge.run(() => 'direct');
  change(environment(8080));
  await bridge.run(() => 'restored');
  await bridge.dispose();
  assert.deepEqual(created, ['http://proxy.local:8080', 'http://proxy.local:8081', 'direct', 'http://proxy.local:8080']);
  assert.deepEqual(closed, created);
});

test('switching proxy does not close a transport still serving another operation', async () => {
  const { bridge, created, closed, change } = fixture();
  const entered = deferred(), finish = deferred();
  const active = bridge.run(async () => { entered.resolve(); await finish.promise; return 'first'; });
  await entered.promise;
  change(environment(8081));
  const values = await Promise.all(Array.from({ length: 10 }, () => bridge.run(() => 'next')));
  assert.equal(values.length, 10);
  assert.equal(created.length, 2);
  assert.deepEqual(closed, []);
  finish.resolve();
  assert.equal(await active, 'first');
  await bridge.dispose();
  assert.deepEqual(closed, created);
});

test('a transient read failure refuses the request, then retries successfully', async () => {
  const { bridge, created, change } = fixture();
  await bridge.start();
  let operations = 0;
  change(new Error('system settings temporarily unavailable'));
  await assert.rejects(bridge.run(() => ++operations), /temporarily unavailable/);
  assert.equal(operations, 0);
  change(environment(8081));
  await bridge.run(() => ++operations);
  assert.equal(operations, 1);
  assert.equal(created.length, 2);
  await bridge.dispose();
});

test('failure to create a transport does not poison subsequent requests', async () => {
  let fail = true, calls = 0;
  const bridge = new SystemProxyBridge({ enabled: true, read: async () => environment(8080), create: async () => {
    if (fail) throw new Error('temporary transport error');
    return { run: fn => fn(), close: async () => {} };
  } });
  await bridge.start();
  await assert.rejects(bridge.run(() => ++calls), /temporary transport error/);
  fail = false;
  await bridge.run(() => ++calls);
  assert.equal(calls, 1);
  await bridge.dispose();
});

test('disabled system proxy leaves the explicit Host transport alone', async () => {
  const bridge = new SystemProxyBridge({ enabled: false, read: () => { throw new Error('unexpected read'); }, create: () => { throw new Error('unexpected transport'); } });
  await bridge.start();
  assert.equal(await bridge.run(() => 42), 42);
  await bridge.dispose();
  await assert.rejects(bridge.run(() => 0), error => error.code === 'OPENCODE_GO_CANCELLED');
});

test('unload aborts active operations, closes transports and refuses new work', async () => {
  const { bridge, closed } = fixture();
  const entered = deferred();
  const active = bridge.run(signal => new Promise(resolve => {
    signal.addEventListener('abort', () => resolve('aborted'), { once: true });
    entered.resolve();
  }));
  await entered.promise;
  await bridge.dispose();
  assert.equal(await active, 'aborted');
  assert.equal(closed.length, 1);
  await assert.rejects(bridge.ensure(), error => error.code === 'OPENCODE_GO_CANCELLED');
});

test('unload during proxy discovery closes the late transport without executing work', async () => {
  const waiting = deferred(), entered = deferred();
  let closed = 0, executed = 0;
  const bridge = new SystemProxyBridge({ enabled: true, read: async () => {
    entered.resolve(); await waiting.promise; return environment(8080);
  }, create: async () => ({ run: fn => fn(), close: async () => { closed++; } }) });
  const active = assert.rejects(bridge.run(() => ++executed), error => error.code === 'OPENCODE_GO_CANCELLED');
  await entered.promise;
  const disposed = bridge.dispose();
  waiting.resolve();
  await Promise.all([disposed, active]);
  assert.equal(executed, 0);
  assert.equal(closed, 1);
});

test('both direct and prepared streams hold their proxy lease until return', async () => {
  const { bridge, closed, change } = fixture();
  let returns = 0;
  const source = async function* (options) {
    try { yield { signal: options.signal, value: 'first' }; yield { value: 'second' }; }
    finally { returns++; }
  };
  const adapter = withSystemProxy({ stream: source, prepareCall: async () => ({ model: { id: 'test' }, stream: source }) }, bridge);
  const first = adapter.stream({});
  assert.equal((await first.next()).value.value, 'first');
  change(environment(8081));
  const prepared = await adapter.prepareCall('test', 'test');
  const second = prepared.stream({});
  assert.equal((await second.next()).value.value, 'first');
  assert.equal(closed.length, 0);
  await first.return();
  await second.return();
  await bridge.dispose();
  assert.equal(returns, 2);
  assert.equal(closed.length, 2);
});
