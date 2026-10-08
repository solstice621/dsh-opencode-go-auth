import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BASE_URL, OpenCodeGoError, keyFingerprint, maskApiKey, normalizeModelIds, normalizeUsage, requestJson } from '../src/opencode-api.js';

const KEY = 'oc_sk_0308a826449c_glgjvXswCEqZN73tZUvOY2UxVCRzb5Cz';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('maskApiKey never returns the whole secret', () => {
  const masked = maskApiKey(KEY);
  assert.equal(masked, 'oc_sk_030…b5Cz');
  assert.ok(!masked.includes('glgjvXsw'));
  assert.equal(maskApiKey('short'), 'sh…');
  assert.equal(maskApiKey(''), null);
  assert.equal(maskApiKey(undefined), null);
});

test('keyFingerprint is stable and hides the key', () => {
  assert.equal(keyFingerprint(KEY), keyFingerprint(KEY));
  assert.notEqual(keyFingerprint(KEY), keyFingerprint(`${KEY}x`));
  assert.match(keyFingerprint(KEY), /^[a-f0-9]{64}$/);
  assert.ok(!keyFingerprint(KEY).includes('oc_sk'));
});

test('normalizeUsage reads the three documented windows', () => {
  const windows = normalizeUsage({ usage: {
    rolling: { status: 'ok', percent: 0, resetsAt: '2026-10-08T16:42:29.000Z' },
    weekly: { status: 'ok', percent: 12.5, resetsAt: '2026-10-12T00:00:00.000Z' },
    monthly: { status: 'rate-limited', percent: 70, resetsAt: '2026-10-15T07:49:03.000Z' },
  } });
  assert.deepEqual(windows.map(window => window.id), ['rolling', 'weekly', 'monthly']);
  assert.deepEqual(windows.map(window => window.name), ['5 小时额度', '每周额度', '每月额度']);
  assert.equal(windows[1].usedPercent, 12.5);
  assert.equal(windows[2].status, 'rate-limited');
  assert.equal(windows[0].resetsAt, Date.parse('2026-10-08T16:42:29.000Z'));
});

test('normalizeUsage clamps percentages and tolerates missing windows', () => {
  const windows = normalizeUsage({ usage: { rolling: { status: 'ok', percent: 180, resetsAt: 'nonsense' } } });
  assert.equal(windows.length, 1);
  assert.equal(windows[0].usedPercent, 100);
  assert.equal(windows[0].resetsAt, null);
});

test('normalizeUsage rejects payloads it cannot trust', () => {
  assert.throws(() => normalizeUsage({}), error => error.code === 'OPENCODE_GO_PROTOCOL_ERROR');
  assert.throws(() => normalizeUsage({ usage: { rolling: 'nope' } }), error => error.code === 'OPENCODE_GO_PROTOCOL_ERROR');
  assert.throws(() => normalizeUsage({ usage: {} }), error => error.code === 'OPENCODE_GO_PROTOCOL_ERROR');
});

test('normalizeModelIds dedupes, filters and rejects an empty catalog', () => {
  const ids = normalizeModelIds({ object: 'list', data: [{ id: 'kimi-k3' }, { id: 'kimi-k3' }, { id: 'bad id' }, { id: 'glm-5.3' }] });
  assert.deepEqual(ids, ['kimi-k3', 'glm-5.3']);
  assert.throws(() => normalizeModelIds({ data: [] }), error => error.code === 'OPENCODE_GO_PROTOCOL_ERROR');
  assert.throws(() => normalizeModelIds({ data: 'nope' }), error => error.code === 'OPENCODE_GO_PROTOCOL_ERROR');
});

test('requestJson sends the key as a bearer token to the configured base', async () => {
  let seen;
  const payload = await requestJson('usage', {
    apiKey: KEY, baseUrl: DEFAULT_BASE_URL,
    fetchImpl: async (url, options) => { seen = { url: String(url), options }; return jsonResponse({ usage: { rolling: { status: 'ok', percent: 1, resetsAt: '2026-10-08T16:42:29.000Z' } } }); },
  });
  assert.equal(seen.url, 'https://opencode.ai/zen/go/v1/usage');
  assert.equal(seen.options.headers.authorization, `Bearer ${KEY}`);
  assert.ok(payload.usage);
});

test('requestJson maps the documented refusals to stable codes', async () => {
  const status = async code => {
    await assert.rejects(requestJson('usage', { apiKey: KEY, fetchImpl: async () => jsonResponse({ type: 'error' }, code) }), error => {
      assert.ok(error instanceof OpenCodeGoError);
      assert.equal(error.code, expected[code]);
      assert.ok(!error.message.includes(KEY));
      return true;
    });
  };
  const expected = { 401: 'OPENCODE_GO_KEY_INVALID', 403: 'OPENCODE_GO_SUBSCRIPTION_REQUIRED', 404: 'OPENCODE_GO_ENDPOINT_NOT_FOUND', 429: 'OPENCODE_GO_RATE_LIMITED', 500: 'OPENCODE_GO_REQUEST_FAILED' };
  for (const code of Object.keys(expected)) await status(Number(code));
});

test('requestJson reports an unreachable host without leaking the key', async () => {
  await assert.rejects(requestJson('usage', { apiKey: KEY, fetchImpl: async () => { throw new TypeError('fetch failed'); } }), error => {
    assert.equal(error.code, 'OPENCODE_GO_UNREACHABLE');
    assert.ok(!error.message.includes(KEY));
    return true;
  });
});

test('requestJson times out instead of hanging', async () => {
  await assert.rejects(requestJson('usage', {
    apiKey: KEY, timeoutMs: 20,
    fetchImpl: (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })),
  }), error => error.code === 'OPENCODE_GO_TIMEOUT');
});

test('requestJson refuses to send a key over plain HTTP or without one', async () => {
  await assert.rejects(requestJson('usage', { apiKey: KEY, baseUrl: 'http://opencode.ai/zen/go/v1', fetchImpl: async () => jsonResponse({}) }), error => error.code === 'OPENCODE_GO_ENDPOINT_INVALID');
  await assert.rejects(requestJson('usage', { apiKey: '', fetchImpl: async () => jsonResponse({}) }), error => error.code === 'OPENCODE_GO_AUTH_REQUIRED');
});

test('requestJson honours an already-aborted caller signal', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(requestJson('usage', { apiKey: KEY, signal: controller.signal, fetchImpl: async () => jsonResponse({}) }), error => error.code === 'OPENCODE_GO_CANCELLED');
});
