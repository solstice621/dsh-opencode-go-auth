import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OpenCodeGoError } from './opencode-api.js';

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
    NO_PROXY: [...new Set(['localhost', '127.0.0.1', '::1', ...bypass])].join(','),
  };
}

export async function readSystemProxy() {
  try {
    const { stdout } = await execute('/usr/sbin/scutil', ['--proxy'], { timeout: 5000, maxBuffer: 65536 });
    return parseSystemProxy(stdout);
  } catch (error) {
    if (error instanceof OpenCodeGoError) throw error;
    throw new OpenCodeGoError('无法读取 macOS 系统代理。请重启 Harness，或关闭 useSystemProxy 并显式配置 Harness 代理。', 'SYSTEM_PROXY_UNAVAILABLE');
  }
}

// The official transport owns the process-wide dispatcher and its restoration.
// Do not rewire it during an in-flight request: changes require a Host restart.
export class SystemProxyBridge {
  constructor({ enabled, hostProxied, install, read = readSystemProxy, report = () => {} }) {
    this.enabled = enabled && !hostProxied;
    this.install = install;
    this.read = read;
    this.report = report;
  }

  async start() {
    if (!this.enabled) return;
    this.environment = await this.read();
    this.snapshot = JSON.stringify(this.environment);
    if (this.environment.HTTP_PROXY || this.environment.HTTPS_PROXY) {
      this.release = await this.install({ get: name => (this.environment[name] ? { value: this.environment[name] } : undefined) }, this.report);
    }
  }

  async ensure() {
    if (!this.enabled) return;
    if (this.changed || JSON.stringify(await this.read()) !== this.snapshot) {
      this.changed = true;
      await this.dispose();
      throw new OpenCodeGoError('macOS 系统代理已切换。请重启 DeepSeek Harness，让 OpenCode Go 请求使用当前代理。未发送任何请求。', 'SYSTEM_PROXY_CHANGED');
    }
  }

  async dispose() {
    const release = this.release;
    this.release = undefined;
    await release?.();
  }
}
