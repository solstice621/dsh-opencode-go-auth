import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SystemProxyBridge, parseSystemProxy } from '../src/system-proxy.js';

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
  assert.deepEqual(environment, { HTTPS_PROXY: 'http://127.0.0.1:7890', NO_PROXY: 'localhost,127.0.0.1,::1' });
});

test('HTTP and HTTPS proxies are both carried over', () => {
  const environment = parseSystemProxy(scutil({ http: { host: '10.0.0.2', port: 3128 }, https: { host: '10.0.0.2', port: 3129 } }));
  assert.equal(environment.HTTP_PROXY, 'http://10.0.0.2:3128');
  assert.equal(environment.HTTPS_PROXY, 'http://10.0.0.2:3129');
});

test('bypass entries join the no-proxy list without duplicates', () => {
  const text = `${scutil({ https: { host: 'proxy.local', port: 8080 } })}\nExceptionsList : <array> {\n  0 : *.local\n  1 : 127.0.0.1\n}\n`;
  const environment = parseSystemProxy(text);
  assert.equal(environment.NO_PROXY, 'localhost,127.0.0.1,::1,*.local');
});

test('PAC-only and SOCKS-only settings are refused rather than silently ignored', () => {
  assert.throws(() => parseSystemProxy(scutil({ pac: true })), error => error.code === 'SYSTEM_PROXY_UNSUPPORTED');
  assert.throws(() => parseSystemProxy(scutil({ socks: true })), error => error.code === 'SYSTEM_PROXY_UNSUPPORTED');
  assert.deepEqual(parseSystemProxy(scutil({})), { NO_PROXY: 'localhost,127.0.0.1,::1' });
});

test('an implausible proxy host or port is refused', () => {
  assert.throws(() => parseSystemProxy(scutil({ https: { host: 'bad host', port: 8080 } })), error => error.code === 'SYSTEM_PROXY_INVALID');
  assert.throws(() => parseSystemProxy(scutil({ https: { host: 'proxy.local', port: 0 } })), error => error.code === 'SYSTEM_PROXY_INVALID');
  assert.throws(() => parseSystemProxy(scutil({ https: { host: 'proxy.local', port: 70000 } })), error => error.code === 'SYSTEM_PROXY_INVALID');
});

test('the bridge installs the proxy once and refuses to follow a later change', async () => {
  let current = parseSystemProxy(scutil({ https: { host: '127.0.0.1', port: 7890 } }));
  const installed = [];
  const bridge = new SystemProxyBridge({
    enabled: true, hostProxied: false, read: async () => current,
    install: async env => { installed.push(env.get('HTTPS_PROXY').value); return async () => installed.push('released'); },
  });
  await bridge.start();
  assert.deepEqual(installed, ['http://127.0.0.1:7890']);
  await bridge.ensure();
  current = parseSystemProxy(scutil({ https: { host: '127.0.0.1', port: 7891 } }));
  await assert.rejects(bridge.ensure(), error => error.code === 'SYSTEM_PROXY_CHANGED');
  assert.deepEqual(installed, ['http://127.0.0.1:7890', 'released']);
});

test('the bridge stays out of the way when the host already proxies or it is disabled', async () => {
  let reads = 0;
  const bridge = new SystemProxyBridge({ enabled: false, hostProxied: false, read: async () => { reads += 1; return {}; }, install: async () => {} });
  await bridge.start();
  await bridge.ensure();
  assert.equal(reads, 0);
  const hostProxied = new SystemProxyBridge({ enabled: true, hostProxied: true, read: async () => { reads += 1; return {}; }, install: async () => {} });
  await hostProxied.start();
  assert.equal(reads, 0);
});
