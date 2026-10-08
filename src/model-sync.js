import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fetchModelIds, OpenCodeGoError, keyFingerprint } from './opencode-api.js';
import { mergeOpencodeModels } from './model-catalog.js';

const safeCode = error => (error instanceof OpenCodeGoError ? error.code : 'OPENCODE_GO_MODEL_SYNC_FAILED');
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value);
const cacheIds = entries => {
  if (!Array.isArray(entries) || entries.length > 1000) throw new Error('Invalid cache');
  const ids = entries.filter(validId);
  if (!ids.length) throw new Error('Empty cache');
  return ids;
};

export function modelCacheFile(baseDir, env = process.env) {
  const homeKey = createHash('sha256').update(String(baseDir ?? '')).digest('hex').slice(0, 16);
  // Follow DSH_HOME so a relocated Harness home keeps its own cache.
  return resolve(env.DSH_HOME || resolve(homedir(), '.dsh'), 'cache', 'dsh-opencode-go-auth', homeKey, 'models.json');
}

export function modelCacheStore(path) {
  return {
    async read() {
      try {
        const raw = await readFile(path, 'utf8');
        if (Buffer.byteLength(raw) > 1048576) return null;
        const data = JSON.parse(raw);
        if (data.version !== 1 || !/^[a-f0-9]{64}$/.test(data.keyHash) || !Number.isFinite(data.fetchedAt) || data.fetchedAt <= 0) return null;
        return { version: 1, keyHash: data.keyHash, fetchedAt: data.fetchedAt, models: cacheIds(data.models) };
      } catch { return null; }
    },
    async write(value) {
      const temporary = `${path}.${randomUUID()}.tmp`;
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      try { await writeFile(temporary, JSON.stringify(value), { mode: 0o600 }); await rename(temporary, path); }
      finally { await rm(temporary, { force: true }); }
    },
  };
}

/**
 * Keeps the model picker aligned with the subscription's live catalog. The
 * account key is the API key's fingerprint, so switching keys can never
 * reuse another subscription's cached catalog.
 */
export class ModelSync {
  constructor({ source, baseline, fallbackCatalog = [], provider, enabled = () => true, beforeAuth = async () => {}, fetchIds = fetchModelIds,
    intervalMinutes = 360, store, onUpdate = () => {}, now = Date.now,
    schedule = callback => setInterval(callback, 60000), unschedule = clearInterval } = {}) {
    Object.assign(this, { source, baseline, fallbackCatalog, provider, enabled, beforeAuth, fetchIds, intervalMinutes, onUpdate, now, schedule, unschedule });
    this.store = store ?? modelCacheStore(modelCacheFile(source?.baseUrl));
    this.models = baseline; this.origin = 'bundled'; this.discovered = []; this.abort = new AbortController();
  }

  state() {
    return {
      automatic: true, intervalMinutes: this.intervalMinutes, refreshing: Boolean(this.pending),
      source: this.origin, totalModels: this.models.length, discoveredModels: this.discovered.length,
      lastSyncAt: this.lastSyncAt ?? null, lastAttemptAt: this.lastAttemptAt ?? null,
      nextSyncAt: this.enabled() ? (this.lastAttemptAt ?? this.now()) + this.intervalMinutes * 60000 : null,
      error: this.error ?? null, cacheSaved: this.cacheSaved ?? null,
    };
  }

  observeKey(fingerprint) {
    const key = fingerprint ? keyFingerprint(fingerprint) : undefined;
    if (key === this.key) return false;
    this.key = key; this.discovered = []; this.lastSyncAt = undefined; this.lastAttemptAt = undefined;
    this.error = undefined; this.cacheSaved = undefined;
    this.publish([], 'bundled');
    return true;
  }

  publish(ids, origin) {
    if (this.disposed) return;
    this.discovered = ids; this.origin = origin;
    const models = ids.length ? mergeOpencodeModels(this.baseline, ids, { provider: this.provider, fallbackCatalog: this.fallbackCatalog }) : this.baseline;
    if (JSON.stringify(models) === JSON.stringify(this.models)) return;
    this.models = models; this.onUpdate();
  }

  async start() {
    try {
      const auth = await this.source.read();
      this.observeKey(auth.key);
      const cached = await this.store.read();
      const current = await this.source.read();
      this.observeKey(current.key);
      // Never restore another key's catalog or a future-dated snapshot.
      if (!this.disposed && cached?.keyHash === this.key && cached.fetchedAt <= this.now() + 300000 && cached.fetchedAt > (this.lastSyncAt ?? 0)) {
        this.lastSyncAt = cached.fetchedAt; this.publish(cached.models, 'cache');
      }
    } catch (error) { this.error = safeCode(error); }
    if (this.disposed) return;
    this.timer = this.schedule(() => { this.tick().catch(() => {}); }); this.timer?.unref?.();
    await this.tick(true);
  }

  async tick(force = false) {
    if (this.disposed || !this.enabled()) return this.state();
    try {
      const auth = await this.source.read();
      const changed = this.observeKey(auth.key);
      if (force || changed || this.lastAttemptAt === undefined || this.now() - this.lastAttemptAt >= this.intervalMinutes * 60000) return await this.refresh();
    } catch (error) {
      if (error instanceof OpenCodeGoError && error.code === 'OPENCODE_GO_AUTH_REQUIRED') this.observeKey(undefined);
      this.error = safeCode(error);
    }
    return this.state();
  }

  async refresh() {
    if (this.disposed) throw new OpenCodeGoError('插件已停用。', 'OPENCODE_GO_CANCELLED');
    if (!this.enabled()) throw new OpenCodeGoError('请先启用 OpenCode Go 连接。', 'OPENCODE_GO_CONNECTION_DISABLED');
    if (!this.pending) {
      this.pending = this.fetchModels();
      this.pending.finally(() => { this.pending = undefined; }).catch(() => {});
    }
    await this.pending;
    return this.state();
  }

  async fetchModels() {
    try {
      const before = await this.source.read();
      this.observeKey(before.key); const key = this.key;
      this.lastAttemptAt = this.now();
      await this.beforeAuth();
      if (this.disposed) throw new OpenCodeGoError('插件已停用。', 'OPENCODE_GO_CANCELLED');
      const ids = await this.fetchIds({ baseUrl: this.source.baseUrl, apiKey: before.key, signal: this.abort.signal });
      const after = await this.source.read();
      if (this.disposed) throw new OpenCodeGoError('插件已停用。', 'OPENCODE_GO_CANCELLED');
      if (keyFingerprint(after.key) !== key) {
        this.observeKey(after.key);
        throw new OpenCodeGoError('API key 已变化，请重新同步。', 'OPENCODE_GO_KEY_CHANGED');
      }
      this.lastSyncAt = this.now(); this.error = undefined;
      this.publish(ids, 'opencode');
      try { await this.store.write({ version: 1, keyHash: key, fetchedAt: this.lastSyncAt, models: ids }); this.cacheSaved = true; }
      catch { this.cacheSaved = false; }
    } catch (error) {
      if (error instanceof OpenCodeGoError && error.code === 'OPENCODE_GO_AUTH_REQUIRED') this.observeKey(undefined);
      this.error = safeCode(error);
      throw new OpenCodeGoError('模型同步失败，保留当前目录。', safeCode(error));
    }
  }

  dispose() { this.disposed = true; this.unschedule(this.timer); this.abort.abort(); }
}
