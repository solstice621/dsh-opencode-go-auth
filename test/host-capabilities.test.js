import test from 'node:test';
import assert from 'node:assert/strict';
import { assertHostCapabilities } from '../src/host-capabilities.js';

function host() {
  const unused = () => { throw Error('Capability checks must not invoke host APIs'); };
  return { get: unused, on: unused, effect: unused, llm: { registerAdapter: unused },
    connection: { fetch: { register: unused } } };
}

test('activation accepts the required service contract without optional services or version metadata', () => {
  assert.doesNotThrow(() => assertHostCapabilities(host(), 'dsh-opencode-go-auth'));
});

test('missing adapter and authenticated fetch APIs produce actionable activation errors', () => {
  for (const api of ['llm.registerAdapter', 'connection.fetch.register']) {
    const ctx = host();
    if (api === 'llm.registerAdapter') ctx.llm.registerAdapter = undefined;
    else ctx.connection.fetch.register = 'unavailable';
    assert.throws(() => assertHostCapabilities(ctx, 'dsh-opencode-go-auth'), error =>
      error.message.includes('dsh-opencode-go-auth') && error.message.includes(api));
  }
});
