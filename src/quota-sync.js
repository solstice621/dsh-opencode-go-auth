import { OpenCodeGoError, keyFingerprint } from './opencode-api.js';

const safeCode = error => error instanceof OpenCodeGoError ? error.code : 'OPENCODE_GO_QUOTA_SYNC_FAILED';

/**
 * Process-scoped quota DATA refresh, independent of the settings page.
 * AuthController owns coalescing, key checks, aborts and guarded disk commits.
 * The minute timer merely checks a per-key attempt/cache TTL; it is not a daemon.
 */
export class QuotaSync {
  constructor({ controller, intervalMinutes = 5, now = Date.now,
    schedule = callback => setInterval(callback, 60000), unschedule = clearInterval } = {}) {
    if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
      throw new RangeError('quotaRefreshMinutes must be between 1 and 1440');
    }
    Object.assign(this, { controller, intervalMinutes, now, schedule, unschedule });
  }

  state() {
    const active = !this.disposed && this.controller.isEnabled();
    const attempt = this.controller.quotaAttempt;
    const now = this.now();
    const localAttempt = this.lastAttemptAt <= now ? this.lastAttemptAt : undefined;
    const lastAttemptAt = attempt && attempt.keyHash === this.key && attempt.at <= now
      ? Math.max(localAttempt ?? 0, attempt.at) : localAttempt;
    const lastSyncAt = this.lastSyncAt <= now ? this.lastSyncAt : undefined;
    const anchor = Math.max(lastAttemptAt ?? 0, lastSyncAt ?? 0);
    return {
      automatic: true, intervalMinutes: this.intervalMinutes,
      refreshing: active && Boolean(this.controller.quotaPending),
      lastAttemptAt: lastAttemptAt ?? null, lastSyncAt: lastSyncAt ?? null,
      nextSyncAt: active ? (anchor || now) + this.intervalMinutes * 60000 : null,
      error: this.error ?? null,
    };
  }

  observeKey(key) {
    if (key === this.key) return;
    this.key = key;
    this.lastAttemptAt = undefined; this.lastSyncAt = undefined; this.error = undefined;
  }

  start() {
    if (this.disposed) return Promise.resolve(this.state());
    if (!this.started) {
      this.started = true;
      this.timer = this.schedule(() => this.tick(), 60000);
      this.timer?.unref?.();
    }
    return this.tick();
  }

  tick() {
    if (this.disposed || !this.controller.isEnabled()) return Promise.resolve(this.state());
    if (!this.pending) {
      const pending = this.runTick();
      this.pending = pending;
      pending.finally(() => { if (this.pending === pending) this.pending = undefined; }).catch(() => {});
    }
    return this.pending;
  }

  async runTick() {
    let key;
    try {
      const auth = await this.controller.source.read();
      if (this.disposed || !this.controller.isEnabled()) return this.state();
      key = keyFingerprint(auth.key);
      this.observeKey(key);
      const cached = await this.controller.cachedUsage();
      const current = await this.controller.source.read();
      if (this.disposed || !this.controller.isEnabled()) return this.state();
      if (keyFingerprint(current.key) !== key) {
        this.observeKey(keyFingerprint(current.key));
        return this.state();
      }
      const now = this.now();
      // Clock rollback must not freeze refresh until a future timestamp catches up.
      if (this.lastAttemptAt > now) this.lastAttemptAt = undefined;
      if (this.lastSyncAt > now) this.lastSyncAt = undefined;
      // Only successful, matching, non-future disk data can postpone initial work.
      if (cached?.credentialId === key.slice(0, 16) && Number.isFinite(cached.fetchedAt)
        && cached.fetchedAt > 0 && cached.fetchedAt <= now) {
        this.lastSyncAt = Math.max(this.lastSyncAt ?? 0, cached.fetchedAt);
      }
      const attempt = this.controller.quotaAttempt;
      if (attempt?.keyHash === key && attempt.at <= now) this.lastAttemptAt = Math.max(this.lastAttemptAt ?? 0, attempt.at);
      const anchor = Math.max(this.lastAttemptAt ?? -Infinity, this.lastSyncAt ?? -Infinity);
      if (now - anchor < this.intervalMinutes * 60000) return this.state();
      // Failed attempts also throttle: network failure must not retry every minute.
      this.lastAttemptAt = now;
      const usage = await this.controller.usage();
      const after = await this.controller.source.read();
      if (this.disposed || !this.controller.isEnabled()) return this.state();
      if (keyFingerprint(after.key) !== key || usage.credentialId !== key.slice(0, 16)) {
        this.observeKey(keyFingerprint(after.key));
        return this.state();
      }
      this.lastSyncAt = usage.fetchedAt; this.error = undefined;
    } catch (error) {
      if (this.disposed || !this.controller.isEnabled()) return this.state();
      // A failure from an old key is not the current subscription's failure.
      try {
        const current = await this.controller.source.read();
        if (this.disposed || !this.controller.isEnabled()) return this.state();
        const currentKey = keyFingerprint(current.key);
        if (key && currentKey !== key) { this.observeKey(currentKey); return this.state(); }
      } catch {
        if (this.disposed) return this.state();
        this.observeKey(undefined);
      }
      this.error = safeCode(error);
    }
    return this.state();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.started) this.unschedule(this.timer);
    this.timer = undefined;
    this.controller.dispose();
  }
}
