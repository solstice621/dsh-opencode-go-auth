import { OpenCodeGoError, fetchUsage, maskApiKey, keyFingerprint } from './opencode-api.js';

/**
 * Turns the API-key seam into the small state machine the settings page reads.
 * Verification is remembered per key, so a rotated key is never reported as
 * connected just because the previous one worked.
 */
export class AuthController {
  constructor({ source, enabled = true, beforeAuth = async () => {}, modelSync, quotaStore, showModelSync = true, fetchUsageImpl = fetchUsage, now = Date.now } = {}) {
    Object.assign(this, { source, enabled, beforeAuth, modelSync, quotaStore, showModelSync, fetchUsage: fetchUsageImpl, now });
  }

  isEnabled() { return (typeof this.enabled === 'function' ? this.enabled() : this.enabled) !== false; }

  /** Remembers the outcome for the key it belongs to; only a hash is retained. */
  verify(key, outcome) {
    this.verification = { fingerprint: keyFingerprint(key), ok: outcome.ok, code: outcome.code ?? null, at: this.now() };
  }

  async getState() {
    const enabled = this.isEnabled();
    // A layout preference, reported so the page never has to read the raw config.
    const showModelSync = this.showModelSync !== false;
    let auth;
    try { auth = await this.source.read(); } catch (error) {
      this.verification = undefined;
      this.modelSync?.observeKey(undefined);
      return { enabled, showModelSync, configured: false, connected: false, credential: null, verifiedAt: null,
        error: error.code ?? 'OPENCODE_GO_AUTH_REQUIRED', models: this.modelSync?.state() ?? null };
    }
    if (this.modelSync?.observeKey(auth.key)) this.modelSync.tick(true).catch(() => {});
    // A different key invalidates the remembered outcome.
    if (this.verification && this.verification.fingerprint !== keyFingerprint(auth.key)) this.verification = undefined;
    const describe = typeof this.source.describe === 'function' ? await this.source.describe().catch(() => undefined) : undefined;
    const failed = this.verification?.ok === false;
    return {
      enabled, showModelSync, configured: true, connected: !failed,
      credential: {
        id: keyFingerprint(auth.key).slice(0, 16),
        label: maskApiKey(auth.key),
        source: auth.source,
        writable: describe?.writable ?? false,
      },
      verifiedAt: this.verification?.ok ? this.verification.at : null,
      error: failed ? this.verification.code : null,
      models: this.modelSync?.state() ?? null,
    };
  }

  async usage() {
    await this.beforeAuth();
    const auth = await this.source.read();
    try {
      const windows = await this.fetchUsage({ baseUrl: this.source.baseUrl, apiKey: auth.key });
      this.verify(auth.key, { ok: true });
      const value = { windows, fetchedAt: this.now() };
      // Remember it for the next page load; a failed write never fails the read.
      try { await this.quotaStore?.write({ version: 1, keyHash: keyFingerprint(auth.key), ...value }); } catch { /* cache only */ }
      return value;
    } catch (error) {
      if (error instanceof OpenCodeGoError) this.verify(auth.key, { ok: false, code: error.code });
      throw error;
    }
  }

  /**
   * The last successful read for the configured key. Touches one small file and
   * no network, so the settings page can paint the previous usage immediately
   * and refresh behind it.
   */
  async cachedUsage() {
    if (!this.quotaStore) return null;
    let auth;
    try { auth = await this.source.read(); } catch { return null; }
    const cached = await this.quotaStore.read();
    // Another key's snapshot is not this subscription's usage.
    if (!cached || cached.keyHash !== keyFingerprint(auth.key)) return null;
    return { windows: cached.windows, fetchedAt: cached.fetchedAt, cached: true };
  }

  /** Validate first, then persist: a rejected key never reaches the credential store. */
  async login(key) {
    if (typeof key !== 'string' || !key.trim()) throw new OpenCodeGoError('API key 不能为空。', 'OPENCODE_GO_KEY_INVALID');
    await this.beforeAuth();
    const candidate = key.trim();
    let windows;
    try {
      windows = await this.fetchUsage({ baseUrl: this.source.baseUrl, apiKey: candidate });
    } catch (error) {
      if (error instanceof OpenCodeGoError) this.verify(candidate, { ok: false, code: error.code });
      throw error;
    }
    await this.source.store(candidate);
    this.verify(candidate, { ok: true });
    this.modelSync?.observeKey(candidate);
    this.modelSync?.tick(true).catch(() => {});
    return { ...(await this.getState()), windows, fetchedAt: this.now() };
  }

  async logout() {
    await this.source.clear();
    // Derived data leaves with the credential it was read for.
    try { await this.quotaStore?.clear(); } catch { /* cache only */ }
    this.verification = undefined;
    this.modelSync?.observeKey(undefined);
    return this.getState();
  }

  async refresh() {
    const state = await this.getState();
    if (!state.configured) throw new OpenCodeGoError('还没有可用的 OpenCode Go API key。', 'OPENCODE_GO_AUTH_REQUIRED');
    const usage = await this.usage();
    return { ...(await this.getState()), ...usage };
  }

  async refreshModels() {
    if (!this.modelSync) throw new OpenCodeGoError('模型同步不可用。', 'OPENCODE_GO_MODEL_SYNC_FAILED');
    await this.modelSync.refresh();
    return this.getState();
  }

  dispose() { this.disposed = true; }
}

const EMPTY = new Set(['state', 'refresh', 'quota', 'cached', 'logout', 'models']);

export function authRpcHandler(controller) {
  return async (endpoint, payload) => {
    const bad = () => ({ ok: false, error: { code: 'OPENCODE_GO_BAD_REQUEST', message: '无法识别的授权操作。', details: {} } });
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return bad();
    const keys = Object.keys(payload);
    if (endpoint === 'login') {
      if (keys.some(key => key !== 'key') || typeof payload.key !== 'string') return bad();
    } else if (!EMPTY.has(endpoint) || keys.length) return bad();
    const methods = {
      state: () => controller.getState(),
      refresh: () => controller.refresh(),
      quota: () => controller.usage(),
      cached: () => controller.cachedUsage(),
      login: () => controller.login(payload.key),
      logout: () => controller.logout(),
      models: () => controller.refreshModels(),
    };
    try { return { ok: true, value: await methods[endpoint]() }; }
    catch (error) {
      const known = error instanceof OpenCodeGoError;
      return { ok: false, error: { code: known ? error.code : 'OPENCODE_GO_OPERATION_FAILED', message: known ? error.message : '操作未完成，请检查网络后重试。', details: {} } };
    }
  };
}
