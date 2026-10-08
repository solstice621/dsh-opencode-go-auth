import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeOpencodeModels, tagModels } from '../src/model-catalog.js';

const GO_ROUTE = 'https://opencode.ai/zen/go/v1';

const baseline = () => [
  { id: 'kimi-k3', api: 'openai-completions', baseUrl: GO_ROUTE, name: 'Kimi K3', contextWindow: 1048576, maxTokens: 131072, reasoning: true, thinkingLevelMap: { off: null, max: 'max' }, compat: { supportsStore: false }, cost: { input: 3, output: 15 } },
  { id: 'grok-4.7', api: 'openai-responses', baseUrl: GO_ROUTE, name: 'Grok 4.7', contextWindow: 500000, reasoning: true },
];

test('known ids keep the bundled metadata object', () => {
  const models = mergeOpencodeModels(baseline(), ['kimi-k3']);
  assert.equal(models.length, 2);
  assert.equal(models[0].name, 'Kimi K3');
  assert.equal(models[0].contextWindow, 1048576);
  assert.equal(models[0].cost.input, 3);
  assert.deepEqual(models[0].thinkingLevelMap, { off: null, max: 'max' });
});

test('unknown ids are added with conservative budgets and no inferred controls', () => {
  const models = mergeOpencodeModels(baseline(), ['kimi-k3', 'brand-new-model']);
  const added = models.find(model => model.id === 'brand-new-model');
  assert.ok(added);
  assert.equal(added.api, 'openai-completions');
  assert.equal(added.name, 'brand-new-model');
  assert.equal(added.contextWindow, 16384);
  assert.equal(added.maxTokens, 4096);
  assert.equal(added.reasoning, false);
  assert.deepEqual(added.cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  assert.equal('thinkingLevelMap' in added, false);
  assert.equal('compat' in added, false);
});

test('models missing from the live catalog are preserved so selections survive', () => {
  const models = mergeOpencodeModels(baseline(), ['kimi-k3']);
  assert.deepEqual(models.map(model => model.id), ['kimi-k3', 'grok-4.7']);
});

test('an unusable remote list leaves the baseline untouched', () => {
  const original = baseline();
  assert.equal(mergeOpencodeModels(original, []), original);
  assert.equal(mergeOpencodeModels(original, undefined), original);
  assert.equal(mergeOpencodeModels([], ['kimi-k3']).length, 0);
});

const zenCatalog = () => [
  { id: 'gpt-6-luna', api: 'openai-responses', name: 'GPT 6 Luna', contextWindow: 1050000, baseUrl: 'https://opencode.ai/zen/v1', provider: 'opencode', cost: { input: 0.1, output: 0.5 } },
  { id: 'gemini-3-flash', api: 'google-generative-ai', name: 'Gemini 3 Flash', baseUrl: 'https://opencode.ai/zen/v1' },
];

test('metadata for an unknown id is borrowed from the sibling catalog and re-pointed at the Go route', () => {
  const models = mergeOpencodeModels(baseline(), ['kimi-k3', 'gpt-6-luna'], { provider: 'opencode-go-subscription', fallbackCatalog: zenCatalog() });
  const borrowed = models.find(model => model.id === 'gpt-6-luna');
  assert.equal(borrowed.name, 'GPT 6 Luna');
  assert.equal(borrowed.contextWindow, 1050000);
  assert.equal(borrowed.api, 'openai-responses');
  assert.equal(borrowed.baseUrl, GO_ROUTE);
  assert.equal(borrowed.provider, 'opencode-go-subscription');
  assert.equal(borrowed.cost.input, 0.1);
});

test('a borrowed protocol with no Go route still lands on the conservative template', () => {
  const models = mergeOpencodeModels(baseline(), ['gemini-3-flash'], { provider: 'opencode-go-subscription', fallbackCatalog: zenCatalog() });
  const entry = models.find(model => model.id === 'gemini-3-flash');
  assert.equal(entry.api, 'openai-completions');
  assert.equal(entry.contextWindow, 16384);
});

test('tagModels rewrites the provider without touching anything else', () => {
  const models = tagModels(baseline(), 'opencode-go-subscription');
  assert.deepEqual(models.map(model => model.provider), ['opencode-go-subscription', 'opencode-go-subscription']);
  assert.equal(models[1].name, 'Grok 4.7');
  assert.equal('provider' in baseline()[0], false);
});
