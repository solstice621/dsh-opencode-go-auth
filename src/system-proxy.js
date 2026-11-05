import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OpenCodeGoError } from './opencode-api.js';
import { createProxyTransport } from './proxy-transport.js';

const execute = promisify(execFile);

export function parseSystemProxy(text) {
  const field = name => text.match(new RegExp(`^\\s*${name}\\s*:\\s*(.*?)\\s*$`, 'm'))?.[1];
  const proxy = scheme => {
    if (field(`${scheme}Enable`) !== '1') return undefined;
    const host = field(`${scheme}Proxy`), port = Number(field(`${scheme}Port`));
    if (!host || /[\s/@?#]/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new OpenCodeGoError('当前 macOS HTTP 代理无效，请检查系统代理设置。', 'SYSTEM_PROXY_INVALID');
    }
    const url = new URL(`http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${port}`);
    return url.href.replace(/\/$/, '');
  };
  const http = proxy('HTTP'), https = proxy('HTTPS');
  if (!http && !https && (field('ProxyAutoConfigEnable') === '1' || field('SOCKSEnable') === '1')) {
    throw new OpenCodeGoError('本插件需要静态 HTTP/HTTPS 系统代理；Harness 传输不支持仅 PAC 或仅 SOCKS 的设置。', 'SYSTEM_PROXY_UNSUPPORTED');
  }
  const exceptions = text.match(/ExceptionsList\s*:\s*<array>\s*\{([^}]+)\}/)?.[1] ?? '';
  const bypass = [...exceptions.matchAll(/^\s*\d+\s*:\s*(.*?)\s*$/gm)].map(match => match[1]);
  return {
    ...(http ? { HTTP_PROXY: http } : {}),
    ...(https ? { HTTPS_PROXY: https } : {}),
    NO_PROXY: [...new Set(['localhost', '127.0.0.1', '::1', '[::1]', ...bypass])].join(','),
  };
}

export async function readSystemProxy() {
  try {
    const { stdout } = await execute('/usr/sbin/scutil', ['--proxy'], { timeout: 5000, maxBuffer: 65536 });
    return parseSystemProxy(stdout);
  } catch (error) {
    if (error instanceof OpenCodeGoError) throw error;
    throw new OpenCodeGoError('无法读取 macOS 系统代理，请检查网络设置后重试；也可关闭 useSystemProxy 并显式配置 Harness 代理。', 'SYSTEM_PROXY_UNAVAILABLE');
  }
}

// Each operation pins one proxy snapshot. A later request may use a new proxy
// while existing streams finish on their original transport. Failed reads or
// transport creation reject only that operation and can recover on retry.
export class SystemProxyBridge {
  constructor({ enabled, create = createProxyTransport, read = readSystemProxy, report = () => {} }) {
    this.enabled = enabled;
    this.create = create;
    this.read = read;
    this.report = report;
    this.abort = new AbortController();
    this.entries = new Set();
  }

  async start() {
    try { await this.ensure(); }
    catch { this.report('OpenCode Go could not read the system proxy at startup; the next request will retry.'); }
  }

  async ensure() {
    if (this.disposed) throw new OpenCodeGoError('插件已停用。', 'OPENCODE_GO_CANCELLED');
    if (!this.enabled) return;
    if (!this.pending) {
      this.pending = this.refresh();
      this.pending.finally(() => { this.pending = undefined; }).catch(() => {});
    }
    await this.pending;
  }

  async refresh() {
    const environment = await this.read();
    const snapshot = JSON.stringify(environment);
    if (snapshot === this.current?.snapshot) return;
    const transport = await this.create(environment);
    const entry = { snapshot, transport, users: 0, retired: false };
    entry.closed = new Promise(resolve => { entry.onClosed = resolve; });
    this.entries.add(entry);
    if (this.disposed) {
      entry.retired = true;
      this.closeIdle(entry);
      throw new OpenCodeGoError('插件已停用。', 'OPENCODE_GO_CANCELLED');
    }
    const previous = this.current;
    this.current = entry;
    if (previous) { previous.retired = true; this.closeIdle(previous); }
  }

  closeIdle(entry) {
    if (!entry.retired || entry.users || entry.closing) return;
    entry.closing = Promise.resolve().then(() => entry.transport.close()).catch(() => {
      this.report('OpenCode Go could not close a retired proxy transport.');
    }).finally(() => { this.entries.delete(entry); entry.onClosed(); });
  }

  async acquire(signal) {
    signal?.throwIfAborted();
    await this.ensure();
    if (this.disposed) throw new OpenCodeGoError('插件已停用。', 'OPENCODE_GO_CANCELLED');
    signal?.throwIfAborted();
    const entry = this.current;
    if (entry) entry.users += 1;
    return {
      signal: signal ? AbortSignal.any([signal, this.abort.signal]) : this.abort.signal,
      run: operation => entry ? entry.transport.run(operation) : operation(),
      release: () => { if (entry) { entry.users -= 1; this.closeIdle(entry); } },
    };
  }

  async run(operation, signal) {
    const lease = await this.acquire(signal);
    try { return await lease.run(() => operation(lease.signal)); }
    finally { lease.release(); }
  }

  async *stream(operation, signal) {
    const lease = await this.acquire(signal);
    let iterator;
    try {
      iterator = lease.run(() => operation(lease.signal)[Symbol.asyncIterator]());
      while (true) {
        const next = await lease.run(() => iterator.next());
        if (next.done) return;
        yield next.value;
      }
    } finally {
      try { await lease.run(() => iterator?.return?.()); }
      finally { lease.release(); }
    }
  }

  async dispose() {
    this.disposed = true;
    this.abort.abort();
    await this.pending?.catch(() => {});
    for (const entry of this.entries) { entry.retired = true; this.closeIdle(entry); }
    // Active scopes are aborted above and release their transport in finally.
    await Promise.all([...this.entries].map(entry => entry.closed));
  }
}

export function withSystemProxy(adapter, bridge) {
  const wrap = stream => options => bridge.stream(signal => stream({ ...options, signal }), options.signal);
  adapter.stream = wrap(adapter.stream.bind(adapter));
  const prepareCall = adapter.prepareCall.bind(adapter);
  adapter.prepareCall = async (...args) => {
    const prepared = await prepareCall(...args);
    return { ...prepared, stream: wrap(prepared.stream.bind(prepared)) };
  };
  return adapter;
}
