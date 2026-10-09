import { OpenCodeGoError, fetchUsage, maskApiKey, keyFingerprint } from './opencode-api.js';

/**
 * Turns the API-key seam into the small state machine the settings page reads.
 * Verification is remembered per key, so a rotated key is never reported as
 * connected just because the previous one worked.
 */
export class AuthController {
  constructor({ source, enabled = true, beforeAuth = async () => {}, modelSync, quotaStore, showModelSync = true, fetchUsageImpl = fetchUsage, now = Date.now } = {}) {
    Object.assign(this, { source, enabled, beforeAuth, modelSync, quotaStore, showModelSync, fetchUsage: fetchUsageImpl, now });
    this.abort = new AbortController();
    this.quotaGeneration = 0;
  }

  isEnabled() { return (typeof this.enabled === 'function' ? this.enabled() : this.enabled) !== false; }

  assertActive(requireEnabled = true) {
    if (this.disposed) throw new OpenCodeGoError('操作已取消。', 'OPENCODE_GO_CANCELLED');
    if (requireEnabled && !this.isEnabled()) throw new OpenCodeGoError('请先启用 OpenCode Go 连接。', 'OPENCODE_GO_CONNECTION_DISABLED');
  }

  /** Remembers the outcome for the key it belongs to; only a hash is retained. */
  verify(key, outcome) {
    if (this.disposed) return;
    this.verification = { fingerprint: keyFingerprint(key), ok: outcome.ok, code: outcome.code ?? null, at: this.now() };
  }

  cancelQuota() {
    this.quotaGeneration++;
    this.quotaPending?.abort.abort();
    this.quotaPending = undefined;
  }

  async validateQuota(job) {
    this.assertActive();
    if (job.abort.signal.aborted || job.generation !== this.quotaGeneration) {
      throw new OpenCodeGoError('操作已取消。', 'OPENCODE_GO_CANCELLED');
    }
    let auth;
    try { auth = await this.source.read(); }
    catch { throw new OpenCodeGoError('API key 已变化，请重新读取额度。', 'OPENCODE_GO_KEY_CHANGED'); }
    this.assertActive();
    if (job.abort.signal.aborted || job.generation !== this.quotaGeneration) {
      throw new OpenCodeGoError('操作已取消。', 'OPENCODE_GO_CANCELLED');
    }
    if (keyFingerprint(auth.key) !== job.keyHash) {
      throw new OpenCodeGoError('API key 已变化，请重新读取额度。', 'OPENCODE_GO_KEY_CHANGED');
    }
    return true;
  }

  async getState() {
    this.assertActive(false);
    const enabled = this.isEnabled();
    // A layout preference, reported so the page never has to read the raw config.
    const showModelSync = this.showModelSync !== false;
    let auth;
    try { auth = await this.source.read(); } catch (error) {
      this.assertActive(false);
      this.verification = undefined;
      this.modelSync?.observeKey(undefined);
      return { enabled, showModelSync, configured: false, connected: false, credential: null, verifiedAt: null,
        error: error.code ?? 'OPENCODE_GO_AUTH_REQUIRED', models: this.modelSync?.state() ?? null, quotaSync: this.quotaSync?.state() ?? null };
    }
    this.assertActive(false);
    if (this.modelSync?.observeKey(auth.key)) this.modelSync.tick(true).catch(() => {});
    // A different key invalidates the remembered outcome.
    if (this.verification && this.verification.fingerprint !== keyFingerprint(auth.key)) this.verification = undefined;
    const describe = typeof this.source.describe === 'function' ? await this.source.describe().catch(() => undefined) : undefined;
    this.assertActive(false);
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
      quotaSync: this.quotaSync?.state() ?? null,
    };
  }

  /** Background and manual reads share one request for the currently configured key. */
  async usage() {
    this.assertActive();
    const auth = await this.source.read();
    this.assertActive();
    const keyHash = keyFingerprint(auth.key);
    if (this.quotaPending?.keyHash !== keyHash) {
      this.cancelQuota();
      const job = { keyHash, generation: this.quotaGeneration, abort: new AbortController() };
      this.quotaPending = job;
      job.promise = this.fetchQuota(auth, job);
      job.promise.finally(() => {
        if (this.quotaPending === job) this.quotaPending = undefined;
      }).catch(() => {});
    }
    return this.quotaPending.promise;
  }

  async fetchQuota(auth, job) {
    try {
      await this.beforeAuth();
      await this.validateQuota(job);
      this.quotaAttempt = { keyHash: job.keyHash, at: this.now() };
      const windows = await this.fetchUsage({ baseUrl: this.source.baseUrl, apiKey: auth.key, signal: job.abort.signal });
      await this.validateQuota(job);
      const value = { windows, fetchedAt: this.now(), credentialId: job.keyHash.slice(0, 16) };
      // Cache writes recheck identity/lifecycle immediately before their atomic commit.
      // A failed disk write must not turn a successful network read into a failure.
      try {
        await this.quotaStore?.write({ version: 1, keyHash: job.keyHash, windows, fetchedAt: value.fetchedAt }, {
          signal: job.abort.signal, shouldCommit: () => this.validateQuota(job),
        });
      } catch { /* cache only; validity is checked again below */ }
      await this.validateQuota(job);
      this.verify(auth.key, { ok: true });
      return value;
    } catch (error) {
      // Do not report a success OR a failure that belongs to a removed/rotated key.
      await this.validateQuota(job);
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
    if (this.disposed || !this.quotaStore) return null;
    try {
      const auth = await this.source.read();
      const cached = await this.quotaStore.read();
      const current = await this.source.read();
      // An identity change while reading disk must not leak the old key's snapshot.
      const keyHash = keyFingerprint(current.key);
      if (this.disposed || !cached || keyFingerprint(auth.key) !== keyHash || cached.keyHash !== keyHash) return null;
      return { windows: cached.windows, fetchedAt: cached.fetchedAt, cached: true, credentialId: keyHash.slice(0, 16) };
    } catch { return null; }
  }

  /** Validate first, then persist: a rejected key never reaches the credential store. */
  async login(key) {
    this.assertActive(false);
    if (typeof key !== 'string' || !key.trim()) throw new OpenCodeGoError('API key 不能为空。', 'OPENCODE_GO_KEY_INVALID');
    await this.beforeAuth();
    this.assertActive(false);
    const candidate = key.trim();
    let windows;
    try {
      windows = await this.fetchUsage({ baseUrl: this.source.baseUrl, apiKey: candidate, signal: this.abort.signal });
    } catch (error) {
      this.assertActive(false);
      if (error instanceof OpenCodeGoError) this.verify(candidate, { ok: false, code: error.code });
      throw error;
    }
    this.assertActive(false);
    this.cancelQuota();
    await this.source.store(candidate);
    this.assertActive(false);
    const keyHash = keyFingerprint(candidate), fetchedAt = this.now();
    const valid = async () => {
      this.assertActive(false);
      const current = await this.source.read();
      this.assertActive(false);
      if (keyFingerprint(current.key) !== keyHash) throw new OpenCodeGoError('API key 已变化，请重新读取额度。', 'OPENCODE_GO_KEY_CHANGED');
      return true;
    };
    await valid();
    this.quotaAttempt = { keyHash, at: fetchedAt };
    try { await this.quotaStore?.write({ version: 1, keyHash, windows, fetchedAt }, { signal: this.abort.signal, shouldCommit: valid }); } catch { /* cache only */ }
    await valid();
    this.verify(candidate, { ok: true });
    this.modelSync?.observeKey(candidate);
    this.modelSync?.tick(true).catch(() => {});
    return { ...(await this.getState()), windows, fetchedAt, credentialId: keyHash.slice(0, 16) };
  }

  async logout() {
    this.assertActive(false);
    this.cancelQuota();
    this.quotaAttempt = undefined;
    await this.source.clear();
    this.assertActive(false);
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

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelQuota();
    this.abort.abort();
  }
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
