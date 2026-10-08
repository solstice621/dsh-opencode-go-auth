import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiKeySource, DEFAULT_API_KEY_ENV, OPENCODE_AUTH_PROVIDERS, defaultAuthFile, pickApiKeyFromAuth } from '../src/api-key-source.js';

const KEY = 'oc_sk_0308a826449c_glgjvXswCEqZN73tZUvOY2UxVCRzb5Cz';
const OTHER = 'oc_sk_other_0000000000000000000000000000';

const source = options => new ApiKeySource({ env: {}, readAuthFile: async () => undefined, ...options });

test('the default reference matches the profile’s provider apiKeyEnv', () => {
  assert.equal(DEFAULT_API_KEY_ENV, 'OPENCODE_GO_API_KEY');
  assert.deepEqual(OPENCODE_AUTH_PROVIDERS, ['opencode-go', 'opencode']);
  assert.match(defaultAuthFile({}), /opencode\/auth\.json$/);
  assert.match(defaultAuthFile({ XDG_DATA_HOME: '/data' }), /^\/data\/opencode\/auth\.json$/);
});

test('pickApiKeyFromAuth accepts only api entries and prefers the Go plan', () => {
  assert.deepEqual(pickApiKeyFromAuth({ 'opencode-go': { type: 'api', key: KEY } }), { key: KEY, provider: 'opencode-go' });
  assert.deepEqual(pickApiKeyFromAuth({ opencode: { type: 'api', key: OTHER, metadata: {} } }), { key: OTHER, provider: 'opencode' });
  assert.equal(pickApiKeyFromAuth({ 'opencode-go': { type: 'oauth', access: KEY } }), undefined);
  assert.equal(pickApiKeyFromAuth({ 'opencode-go': { type: 'api', key: '' } }), undefined);
  assert.equal(pickApiKeyFromAuth(null), undefined);
  assert.equal(pickApiKeyFromAuth([{ type: 'api', key: KEY }]), undefined);
});

test('resolution order is config, credential store, environment, then the CLI login', async () => {
  const credentials = {
    resolve: async ref => ({ value: KEY, source: 'file' }),
    describe: async () => ({ configured: true, source: 'file', writable: true }),
    set: async () => {},
    unset: async () => {},
  };
  const fromConfig = source({ apiKey: 'literal-key', credentials, env: { [DEFAULT_API_KEY_ENV]: OTHER }, readAuthFile: async () => ({ key: OTHER, provider: 'opencode' }) });
  assert.deepEqual(await fromConfig.read(), { key: 'literal-key', source: 'plugin-config' });

  const fromStore = source({ credentials, env: { [DEFAULT_API_KEY_ENV]: OTHER }, readAuthFile: async () => ({ key: OTHER, provider: 'opencode' }) });
  assert.deepEqual(await fromStore.read(), { key: KEY, source: 'file' });

  const fromEnv = source({ env: { [DEFAULT_API_KEY_ENV]: OTHER }, readAuthFile: async () => ({ key: OTHER, provider: 'opencode' }) });
  assert.deepEqual(await fromEnv.read(), { key: OTHER, source: 'environment' });

  const fromFile = source({ readAuthFile: async () => ({ key: OTHER, provider: 'opencode-go' }) });
  assert.deepEqual(await fromFile.read(), { key: OTHER, source: 'opencode:opencode-go' });
});

test('OPENCODE_AUTH_CONTENT is read before the auth file', async () => {
  const withContent = source({ env: { OPENCODE_AUTH_CONTENT: JSON.stringify({ 'opencode-go': { type: 'api', key: KEY } }) }, readAuthFile: async () => ({ key: OTHER, provider: 'opencode' }) });
  assert.deepEqual(await withContent.read(), { key: KEY, source: 'opencode:opencode-go' });
  const broken = source({ env: { OPENCODE_AUTH_CONTENT: '{not json' }, readAuthFile: async () => ({ key: OTHER, provider: 'opencode' }) });
  assert.deepEqual(await broken.read(), { key: OTHER, source: 'opencode:opencode' });
});

test('an absent key reports AUTH_REQUIRED rather than an empty secret', async () => {
  await assert.rejects(source({}).read(), error => error.code === 'OPENCODE_GO_AUTH_REQUIRED');
});

test('a malformed reference name is skipped instead of throwing', async () => {
  const credentials = { resolve: async () => ({ value: KEY, source: 'file' }) };
  const malformed = source({ credentials, apiKeyEnv: 'not-a-ref', env: { 'not-a-ref': OTHER } });
  assert.deepEqual(await malformed.read(), { key: OTHER, source: 'environment' });
});

test('describe reports writability without the value', async () => {
  const credentials = { describe: async () => ({ configured: true, source: 'env', writable: false }), set: async () => {}, unset: async () => {} };
  const readOnly = source({ credentials, env: { [DEFAULT_API_KEY_ENV]: KEY } });
  const described = await readOnly.describe();
  assert.equal(described.configured, true);
  assert.equal(described.writable, false);
  assert.equal(JSON.stringify(described).includes(KEY), false);
});

test('store and clear go through the credential seam', async () => {
  const calls = [];
  const credentials = { set: async (ref, value) => calls.push(['set', ref, value]), unset: async ref => calls.push(['unset', ref]) };
  const writable = source({ credentials });
  await writable.store(`  ${KEY}  `);
  await writable.clear();
  assert.deepEqual(calls, [['set', DEFAULT_API_KEY_ENV, KEY], ['unset', DEFAULT_API_KEY_ENV]]);
  await assert.rejects(writable.store('   '), error => error.code === 'OPENCODE_GO_KEY_INVALID');
});

test('a missing credential service fails loudly instead of silently dropping the key', async () => {
  const orphan = source({});
  await assert.rejects(orphan.store(KEY), error => error.code === 'OPENCODE_GO_CREDENTIALS_UNAVAILABLE');
  await assert.rejects(orphan.clear(), error => error.code === 'OPENCODE_GO_CREDENTIALS_UNAVAILABLE');
});
