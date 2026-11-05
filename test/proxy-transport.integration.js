import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { getGlobalDispatcher } from 'undici';
import { SystemProxyBridge } from '../src/system-proxy.js';

async function listen(server) {
  const sockets = new Set();
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { port: server.address().port, async close() {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  } };
}

async function proxy(label) {
  const target = await listen(http.createServer((_req, res) => res.end(label)));
  const requests = [];
  const server = http.createServer((req, res) => { requests.push(req.url); res.end(label); });
  server.on('connect', (req, socket, head) => {
    requests.push(req.url);
    const upstream = net.connect(target.port, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream); upstream.pipe(socket);
    });
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
  });
  const listener = await listen(server);
  return { url: `http://127.0.0.1:${listener.port}`, requests,
    async close() { await listener.close(); await target.close(); } };
}

test('real proxy traffic follows the request snapshot without changing Host routing', { timeout: 15000 }, async () => {
  const a = await proxy('proxy-A'), b = await proxy('proxy-B');
  const direct = await listen(http.createServer((_req, res) => res.end('direct')));
  const fetchBefore = globalThis.fetch, dispatcherBefore = getGlobalDispatcher();
  const envBefore = Object.fromEntries(['HTTP_PROXY','HTTPS_PROXY','NO_PROXY','http_proxy','https_proxy','no_proxy'].map(k => [k, process.env[k]]));
  let current = { HTTP_PROXY: a.url, HTTPS_PROXY: a.url, NO_PROXY: 'localhost,127.0.0.1,::1,[::1]' };
  const bridge = new SystemProxyBridge({ enabled: true, read: async () => current });
  const read = url => fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.text());
  const publicUrl = 'http://opencode-test.invalid/probe';
  const directUrl = `http://127.0.0.1:${direct.port}/probe`;
  let releaseFirst, enteredFirst;
  const wait = new Promise(resolve => { releaseFirst = resolve; });
  const started = new Promise(resolve => { enteredFirst = resolve; });
  try {
    const first = bridge.run(async () => {
      assert.equal(await read(publicUrl), 'proxy-A');
      enteredFirst(); await wait;
      // A still owns this operation, even though another request switched to B.
      assert.equal(await read(publicUrl), 'proxy-A');
    });
    await Promise.race([started, first]);
    current = { ...current, HTTP_PROXY: b.url, HTTPS_PROXY: b.url };
    assert.equal(await bridge.run(() => read(publicUrl)), 'proxy-B');
    assert.equal(await read(directUrl), 'direct');
    assert.equal(await bridge.run(() => read(directUrl)), 'direct');
    assert.equal(getGlobalDispatcher(), dispatcherBefore);
    assert.deepEqual(Object.fromEntries(Object.keys(envBefore).map(k => [k, process.env[k]])), envBefore);
    releaseFirst(); await first;
    current = { NO_PROXY: 'localhost,127.0.0.1,::1,[::1]' };
    assert.equal(await bridge.run(() => read(directUrl)), 'direct');
    current = { HTTP_PROXY: a.url, HTTPS_PROXY: a.url, NO_PROXY: '' };
    assert.equal(await bridge.run(() => read(publicUrl)), 'proxy-A');
    assert.ok(a.requests.length >= 2);
    assert.ok(b.requests.length >= 1);
    await bridge.dispose();
    assert.equal(globalThis.fetch, fetchBefore);
    assert.equal(getGlobalDispatcher(), dispatcherBefore);
  } finally {
    releaseFirst();
    await bridge.dispose();
    await Promise.all([a.close(), b.close(), direct.close()]);
  }
});

test('proxy-off suppresses stale inherited proxy variables for scoped requests', { timeout: 10000 }, async () => {
  const target = await listen(http.createServer((_req, res) => res.end('direct')));
  const names = ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) process.env[name] = 'http://127.0.0.1:1';
  const bridge = new SystemProxyBridge({ enabled: true, read: async () => ({ NO_PROXY: '' }) });
  try {
    const body = await bridge.run(async signal => (await fetch(`http://127.0.0.1:${target.port}/`, { signal })).text());
    assert.equal(body, 'direct');
  } finally {
    await bridge.dispose(); await target.close();
    for (const name of names) if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
  }
});
