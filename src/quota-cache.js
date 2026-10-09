import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const MAX_WINDOWS = 10;
const NAMES = { rolling: '5 小时额度', weekly: '每周额度', monthly: '每月额度' };
const NAMES_EN = { rolling: '5-hour window', weekly: 'Weekly window', monthly: 'Monthly window' };

function normalizeWindow(value, index) {
  if (!value || typeof value !== 'object') return null;
  const id = typeof value.id === 'string' && value.id ? value.id.slice(0, 40) : `window-${index}`;
  return {
    id,
    name: typeof value.name === 'string' && value.name ? value.name.slice(0, 60) : NAMES[id] ?? id,
    nameEn: typeof value.nameEn === 'string' && value.nameEn ? value.nameEn.slice(0, 60) : NAMES_EN[id] ?? id,
    status: value.status === 'rate-limited' ? 'rate-limited' : 'ok',
    usedPercent: Number.isFinite(value.usedPercent) ? Math.min(100, Math.max(0, value.usedPercent)) : null,
    resetsAt: Number.isFinite(value.resetsAt) ? value.resetsAt : null,
  };
}

/** Re-validate what a previous run wrote; a stale or foreign document reads as absent. */
export function normalizeCachedWindows(value) {
  if (!Array.isArray(value) || value.length > MAX_WINDOWS) throw new Error('Invalid quota cache');
  return value.map(normalizeWindow).filter(Boolean);
}

export function quotaCacheFile(scope, env = process.env) {
  const homeKey = createHash('sha256').update(String(scope ?? '')).digest('hex').slice(0, 16);
  // Follow DSH_HOME so a relocated Harness home keeps its own cache.
  return resolve(env.DSH_HOME || resolve(homedir(), '.dsh'), 'cache', 'dsh-opencode-go-auth', homeKey, 'quota.json');
}

/**
 * The last usage a successful read produced, so the settings page can render it
 * immediately instead of waiting for the network. It holds the three usage
 * windows only: no API key and no provider text.
 */
export function quotaCacheStore(path) {
  return {
    async read() {
      try {
        const raw = await readFile(path, 'utf8');
        if (Buffer.byteLength(raw) > 262144) return null;
        const data = JSON.parse(raw);
        if (data.version !== 1 || !/^[a-f0-9]{64}$/.test(data.keyHash) || !Number.isFinite(data.fetchedAt) || data.fetchedAt <= 0) return null;
        const windows = normalizeCachedWindows(data.windows);
        if (!windows.length) return null;
        return { version: 1, keyHash: data.keyHash, fetchedAt: data.fetchedAt, windows };
      } catch { return null; }
    },
    async write(value, { signal, shouldCommit = () => true } = {}) {
      const allowed = async () => {
        signal?.throwIfAborted();
        const valid = await shouldCommit();
        signal?.throwIfAborted();
        return valid;
      };
      if (!await allowed()) return false;
      const temporary = `${path}.${randomUUID()}.tmp`;
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      try {
        await writeFile(temporary, JSON.stringify(value), { mode: 0o600, signal });
        if (!await allowed()) return false;
        signal?.throwIfAborted();
        // No await between the final lifecycle/identity check and the atomic commit.
        renameSync(temporary, path);
        return true;
      } finally { await rm(temporary, { force: true }); }
    },
    async clear() { await rm(path, { force: true }); },
  };
}
