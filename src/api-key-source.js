import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { credentialRef } from './credential-ref.js';
import { DEFAULT_BASE_URL, OpenCodeGoError } from './opencode-api.js';

export const DEFAULT_API_KEY_ENV = 'OPENCODE_GO_API_KEY';

/**
 * Local OpenCode CLI logins are keyed by provider id. Zen is `opencode`, the
 * Go plan is `opencode-go`; accept either so a machine connected through the
 * TUI works without touching this plugin's configuration.
 */
export const OPENCODE_AUTH_PROVIDERS = ['opencode-go', 'opencode'];

export function defaultAuthFile(env = process.env) {
  const dataHome = env.XDG_DATA_HOME || resolve(homedir(), '.local', 'share');
  return resolve(dataHome, 'opencode', 'auth.json');
}

/** `{ type: 'api', key }` is the only entry shape this plugin can use. */
export function pickApiKeyFromAuth(document, providers = OPENCODE_AUTH_PROVIDERS) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return undefined;
  for (const id of providers) {
    const entry = document[id];
    if (entry && typeof entry === 'object' && !Array.isArray(entry) && entry.type === 'api'
      && typeof entry.key === 'string' && entry.key) return { key: entry.key, provider: id };
  }
  return undefined;
}

export async function readOpencodeAuthFile(path, read = readFile) {
  let raw;
  try { raw = await read(path, 'utf8'); } catch { return undefined; }
  try { return pickApiKeyFromAuth(JSON.parse(raw)); } catch { return undefined; }
}

/**
 * Resolves the OpenCode Go API key without ever putting it in configuration.
 *
 * Order: a literal `apiKey` from plugin config, then the Harness credential
 * store (which also covers the inherited environment), then the raw process
 * environment, then the local OpenCode CLI login. `read()` is called per
 * operation, so rotating the stored key needs no restart.
 */
export class ApiKeySource {
  constructor({ credentials, apiKey, apiKeyEnv = DEFAULT_API_KEY_ENV, baseUrl = DEFAULT_BASE_URL, env = process.env,
    authFile, readAuthFile = readOpencodeAuthFile } = {}) {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.apiKeyEnv = apiKeyEnv;
    this.env = env;
    this.authFile = authFile ?? defaultAuthFile(env);
    this.readAuthFile = readAuthFile;
  }

  ref() {
    try { return credentialRef(this.apiKeyEnv); } catch { return undefined; }
  }

  async read() {
    if (typeof this.apiKey === 'string' && this.apiKey) return { key: this.apiKey, source: 'plugin-config' };
    const ref = this.ref();
    if (ref && typeof this.credentials?.resolve === 'function') {
      const hit = await this.credentials.resolve(ref);
      if (hit?.value) return { key: hit.value, source: hit.source ?? 'credentials' };
    }
    const inherited = this.env?.[this.apiKeyEnv];
    if (typeof inherited === 'string' && inherited) return { key: inherited, source: 'environment' };
    const content = this.env?.OPENCODE_AUTH_CONTENT;
    if (typeof content === 'string' && content) {
      try {
        const picked = pickApiKeyFromAuth(JSON.parse(content));
        if (picked) return { key: picked.key, source: `opencode:${picked.provider}` };
      } catch { /* an unreadable override must not hide the file below */ }
    }
    const file = await this.readAuthFile(this.authFile);
    if (file) return { key: file.key, source: `opencode:${file.provider}` };
    throw new OpenCodeGoError('还没有可用的 OpenCode Go API key。请在设置中粘贴，或配置 OPENCODE_GO_API_KEY。', 'OPENCODE_GO_AUTH_REQUIRED');
  }

  /** Whether `login` can persist a key, and where the current one comes from. Never the value. */
  async describe() {
    const ref = this.ref();
    const info = ref && typeof this.credentials?.describe === 'function' ? await this.credentials.describe(ref) : undefined;
    let resolved;
    try { resolved = await this.read(); } catch { resolved = undefined; }
    return {
      configured: Boolean(resolved),
      source: resolved?.source ?? null,
      writable: Boolean(ref && (info ? info.writable : true) && typeof this.credentials?.set === 'function' && !this.apiKey),
    };
  }

  async store(key) {
    if (typeof key !== 'string' || !key.trim()) throw new OpenCodeGoError('API key 不能为空。', 'OPENCODE_GO_KEY_INVALID');
    const ref = this.ref();
    if (!ref || typeof this.credentials?.set !== 'function') {
      throw new OpenCodeGoError('Harness 凭据服务不可用，无法保存 API key。请改用环境变量或 opencode auth.json。', 'OPENCODE_GO_CREDENTIALS_UNAVAILABLE');
    }
    await this.credentials.set(ref, key.trim());
  }

  async clear() {
    const ref = this.ref();
    if (!ref || typeof this.credentials?.unset !== 'function') {
      throw new OpenCodeGoError('Harness 凭据服务不可用，无法移除 API key。', 'OPENCODE_GO_CREDENTIALS_UNAVAILABLE');
    }
    await this.credentials.unset(ref);
  }
}
