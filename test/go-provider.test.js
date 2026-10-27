import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withGoogleTransport } from '../src/go-provider.js';

function fixture() {
  const calls = [];
  const provider = name => Object.fromEntries(['stream', 'streamSimple'].map(method => [method, (...args) => {
    calls.push({ provider: name, method, args }); return name + '/' + method;
  }]));
  return { calls, provider: withGoogleTransport(provider('go'), provider('zen')) };
}
const argon = { id: 'gemini-4-argon', api: 'google-generative-ai', maxTokens: 65536 };

test('Argon uses the native Google stream with discrete reasoning, exact id, session and bearer auth', () => {
  const { provider, calls } = fixture();
  for (const level of ['low', 'medium', 'high']) {
    const context = { messages: [] };
    assert.equal(provider.streamSimple(argon, context, { reasoning: level, apiKey: 'test-key', sessionId: 'session-a', headers: { 'x-test': 'yes' }, maxTokens: 128, temperature: 0.5 }), 'zen/stream');
    const call = calls.at(-1), options = call.args[2];
    assert.equal(call.args[0], argon);
    assert.equal(call.args[1], context);
    assert.deepEqual(options.thinking, { enabled: true, level: level.toUpperCase() });
    assert.equal(options.thinking.budgetTokens, undefined);
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(options.headers['x-test'], 'yes');
    assert.equal(options.sessionId, 'session-a');
    assert.equal(options.maxTokens, 128);
    assert.equal(options.temperature, undefined);
  }
});

test('Argon defaults to medium, caps synchronous output and rejects unsupported effort levels', () => {
  const { provider, calls } = fixture();
  provider.streamSimple(argon, {}, {});
  assert.deepEqual(calls.at(-1).args[2].thinking, { enabled: true, level: 'MEDIUM' });
  provider.streamSimple(argon, {}, { maxTokens: 1048576 });
  assert.equal(calls.at(-1).args[2].maxTokens, 65536);
  assert.throws(() => provider.streamSimple(argon, {}, { reasoning: 'max' }));
});

test('existing Go models retain their native dispatch, while other Google models use Zen Google', () => {
  const { provider } = fixture();
  assert.equal(provider.streamSimple({ id: 'kimi-k3', api: 'openai-completions' }, {}, {}), 'go/streamSimple');
  assert.equal(provider.streamSimple({ id: 'gemini-3.8-flash', api: 'google-generative-ai' }, {}, {}), 'zen/streamSimple');
  assert.equal(provider.stream(argon, {}, { thinking: { enabled: true, level: 'LOW' } }), 'zen/stream');
});
