import { createHash } from 'node:crypto';

/** OpenCode Zen Go API root. Both the usage and the model catalog live under it. */
export const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';

export const USAGE_WINDOWS = [
  { id: 'rolling', name: '5 小时额度', nameEn: '5-hour window' },
  { id: 'weekly', name: '每周额度', nameEn: 'Weekly window' },
  { id: 'monthly', name: '每月额度', nameEn: 'Monthly window' },
];

export class OpenCodeGoError extends Error {
  constructor(message, code = 'OPENCODE_GO_AUTH_REQUIRED') {
    super(message);
    this.name = 'OpenCodeGoError';
    this.code = code;
  }
}

/** Never surface the secret itself: a short prefix and suffix is enough to tell keys apart. */
export function maskApiKey(key) {
  if (typeof key !== 'string' || !key) return null;
  if (key.length <= 12) return `${key.slice(0, 2)}…`;
  return `${key.slice(0, 9)}…${key.slice(-4)}`;
}

/** Key-scoped identity for caches; the raw secret never leaves this function. */
export function keyFingerprint(key) {
  return createHash('sha256').update(String(key ?? '')).digest('hex');
}

const validModelId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value);

/** Read the three documented usage windows; percent is usage, so the UI shows 100 - percent. */
export function normalizeUsage(payload) {
  const usage = payload?.usage;
  if (!usage || typeof usage !== 'object') throw new OpenCodeGoError('OpenCode Go 返回了无法识别的额度数据。', 'OPENCODE_GO_PROTOCOL_ERROR');
  const windows = [];
  for (const definition of USAGE_WINDOWS) {
    const value = usage[definition.id];
    if (value === undefined) continue;
    if (!value || typeof value !== 'object') throw new OpenCodeGoError('OpenCode Go 返回了无法识别的额度数据。', 'OPENCODE_GO_PROTOCOL_ERROR');
    const percent = Number(value.percent);
    const resetsAt = typeof value.resetsAt === 'string' ? Date.parse(value.resetsAt) : NaN;
    windows.push({
      id: definition.id,
      name: definition.name,
      nameEn: definition.nameEn,
      status: value.status === 'rate-limited' ? 'rate-limited' : 'ok',
      usedPercent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : null,
      resetsAt: Number.isFinite(resetsAt) ? resetsAt : null,
    });
  }
  if (!windows.length) throw new OpenCodeGoError('OpenCode Go 返回了空的额度数据。', 'OPENCODE_GO_PROTOCOL_ERROR');
  return windows;
}

/** The catalog endpoint returns ids only; names and limits stay with the bundled provider. */
export function normalizeModelIds(payload) {
  const rows = payload?.data;
  if (!Array.isArray(rows) || rows.length > 1000) throw new OpenCodeGoError('OpenCode Go 返回了无法识别的模型目录。', 'OPENCODE_GO_PROTOCOL_ERROR');
  const seen = new Set(), ids = [];
  for (const row of rows) {
    const id = typeof row === 'string' ? row : row?.id;
    if (!validModelId(id) || seen.has(id)) continue;
    ids.push(id);
    seen.add(id);
  }
  if (!ids.length) throw new OpenCodeGoError('OpenCode Go 返回了空的模型目录。', 'OPENCODE_GO_PROTOCOL_ERROR');
  return ids;
}

function classify(status) {
  if (status === 401) return ['API key 无效或已被撤销，请重新登录 OpenCode Go。', 'OPENCODE_GO_KEY_INVALID'];
  if (status === 403) return ['该 API key 没有 OpenCode Go 订阅。请在 OpenCode 控制台订阅 Go 或 Go Plus。', 'OPENCODE_GO_SUBSCRIPTION_REQUIRED'];
  if (status === 404) return ['OpenCode Go 接口地址不可用，请检查 baseUrl 配置。', 'OPENCODE_GO_ENDPOINT_NOT_FOUND'];
  if (status === 429) return ['OpenCode Go 暂时限流，请稍后重试。', 'OPENCODE_GO_RATE_LIMITED'];
  return [`OpenCode Go 请求失败（HTTP ${status}）。`, 'OPENCODE_GO_REQUEST_FAILED'];
}

/**
 * One authenticated JSON read against OpenCode Go.
 * The API key is only ever placed in the Authorization header.
 */
export async function requestJson(path, { baseUrl = DEFAULT_BASE_URL, apiKey, signal, timeoutMs = 20000, fetchImpl = fetch } = {}) {
  if (typeof apiKey !== 'string' || !apiKey) throw new OpenCodeGoError('还没有可用的 OpenCode Go API key。', 'OPENCODE_GO_AUTH_REQUIRED');
  let url;
  try {
    url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    if (url.protocol !== 'https:') throw new Error('insecure');
  } catch {
    throw new OpenCodeGoError('OpenCode Go 接口地址无效，请检查 baseUrl 配置。', 'OPENCODE_GO_ENDPOINT_INVALID');
  }
  const timer = new AbortController();
  const onAbort = () => timer.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) throw new OpenCodeGoError('操作已取消。', 'OPENCODE_GO_CANCELLED');
    signal.addEventListener('abort', onAbort, { once: true });
  }
  const timeout = setTimeout(() => timer.abort(new OpenCodeGoError('OpenCode Go 请求超时，请检查当前网络和代理。', 'OPENCODE_GO_TIMEOUT')), timeoutMs);
  timeout.unref?.();
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json', 'user-agent': 'dsh-opencode-go-auth/0.1.0' },
      signal: timer.signal,
      redirect: 'error',
    });
  } catch (error) {
    if (signal?.aborted) throw new OpenCodeGoError('操作已取消。', 'OPENCODE_GO_CANCELLED');
    if (error instanceof OpenCodeGoError) throw error;
    if (timer.signal.aborted) throw new OpenCodeGoError('OpenCode Go 请求超时，请检查当前网络和代理。', 'OPENCODE_GO_TIMEOUT');
    throw new OpenCodeGoError('无法连接 OpenCode Go，请检查网络或系统代理。', 'OPENCODE_GO_UNREACHABLE');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
  if (!response.ok) {
    const [message, code] = classify(response.status);
    throw new OpenCodeGoError(message, code);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new OpenCodeGoError('OpenCode Go 返回了无法解析的响应。', 'OPENCODE_GO_PROTOCOL_ERROR');
  }
  return payload;
}

export const fetchUsage = options => requestJson('usage', options).then(normalizeUsage);
export const fetchModelIds = options => requestJson('models', options).then(normalizeModelIds);
