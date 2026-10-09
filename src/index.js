import Schema from '@deepseek-ai/schemastery';
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai';
import { LlmError, resolveRetryPolicy, resolveImageAttachmentAccess } from '@deepseek-ai/dsh-llm';
import { installProxyFromEnvironment, proxyEnvironmentForChild, proxyRouteFor } from '@deepseek-ai/dsh-http-proxy';
import { clientRequestSchema } from '@deepseek-ai/dsh-client-connection';
import { opencodeGoProvider } from '@earendil-works/pi-ai/providers/opencode-go';
import { opencodeProvider } from '@earendil-works/pi-ai/providers/opencode';
import { ApiKeySource, DEFAULT_API_KEY_ENV } from './api-key-source.js';
import { SystemProxyBridge } from './system-proxy.js';
import { AuthController, authRpcHandler } from './auth-controller.js';
import { ModelSync, modelCacheStore } from './model-sync.js';
import { quotaCacheFile, quotaCacheStore } from './quota-cache.js';
import { QuotaSync } from './quota-sync.js';
import { tagModels } from './model-catalog.js';
import { DEFAULT_BASE_URL, fetchModelIds, fetchUsage } from './opencode-api.js';

export const name = 'dsh-opencode-go-auth';
export const inject = ['llm', 'connection'];
export const PROVIDER = 'opencode-go-subscription';
export const ROUTE_PREFIX = '/api/opencode-go-auth';
export const ENDPOINTS = ['state', 'refresh', 'quota', 'cached', 'login', 'logout', 'models'];

export const Config = Schema.object({
  enabled: Schema.boolean().default(true).description('Enable the OpenCode Go connection in Harness').volatile(),
  apiKey: Schema.string().description('Literal OpenCode Go API key; prefer the credential store or the environment'),
  apiKeyEnv: Schema.string().default(DEFAULT_API_KEY_ENV).description('Credential reference that holds the API key'),
  baseUrl: Schema.string().default(DEFAULT_BASE_URL).description('OpenCode Zen Go API root'),
  authFile: Schema.string().description('Local OpenCode CLI auth.json; defaults to ~/.local/share/opencode/auth.json'),
  showModelSync: Schema.boolean().default(true).description('Show the model-catalog card under the quota card on the settings page'),
  modelRefreshMinutes: Schema.number().min(5).max(10080).default(360).description('Automatically refresh the model catalog at this interval'),
  modelCachePath: Schema.string().description('Optional model metadata cache path; defaults to ~/.dsh/cache/dsh-opencode-go-auth'),
  quotaRefreshMinutes: Schema.number().min(1).max(1440).default(5).description('Automatically refresh quota data while Harness is running and this connection is enabled'),
  quotaCachePath: Schema.string().description('Optional last-usage cache path; defaults to ~/.dsh/cache/dsh-opencode-go-auth'),
  requestTimeoutMs: Schema.number().min(1000).max(120000).default(20000).description('Bound on one OpenCode Go request'),
  useSystemProxy: Schema.boolean().default(process.platform === 'darwin').description('Use the active macOS HTTP proxy when the GUI Host has no explicit proxy'),
});

export function childEnvironment() {
  const environment = { ...process.env };
  for (const [key, value] of Object.entries(proxyEnvironmentForChild())) {
    if (value === undefined) delete environment[key];
    else environment[key] = value;
  }
  return environment;
}

// This adapter uses the host's provider catalog, wire protocol, history replay,
// tool-call conversion, image projection, cancellation and attribution headers.
export function createOpencodeGoAdapter(ctx, config = {}, sourceOverride, beforeAuth = async () => {}, getCatalog) {
  const source = sourceOverride ?? new ApiKeySource({ ...config, credentials: ctx.get('credentials') });
  const native = opencodeGoProvider();
  const models = tagModels(native.getModels(), PROVIDER);
  const providerBase = {
    ...native,
    id: PROVIDER,
    name: 'OpenCode · Go 额度',
    // pi-ai's apiKey resolver is its generic bearer-token handoff. The value
    // comes exclusively from the OpenCode Go credential seam; the native
    // `opencode-go` provider in the profile keeps using its own apiKeyEnv.
    auth: { apiKey: {
      name: 'OpenCode Go API key',
      resolve: async ({ signal }) => {
        await beforeAuth();
        const auth = await source.read(signal);
        return { auth: { apiKey: auth.key }, source: 'OpenCode Go subscription' };
      },
    } },
  };
  let previousModels, profiles;
  const currentProfiles = () => {
    const catalog = getCatalog?.() ?? models;
    if (catalog === previousModels) return profiles;
    previousModels = catalog;
    // Freeze each collection's catalog so a refresh cannot change a prepared
    // request's model metadata while that request is running.
    const provider = { ...providerBase, getModels: () => catalog };
    profiles = new Map([[PROVIDER, {
      provider: PROVIDER,
      displayName: provider.name,
      piProvider: provider,
      transport: 'sse',
      streamIdleTimeoutMs: 300000,
      maxRequestImageBytes: 20971520,
      requestImagePixelBudget: 4194304,
      requestImageMaxBytes: 1048576,
      retryPolicy: resolveRetryPolicy({ mode: 'normal', maxRetries: 2 }, name),
      configuredMaxTokens: new Map(),
      modelErrors: new Map(),
    }]]);
    return profiles;
  };
  return new PiAiAdapter({
    profiles: currentProfiles,
    resolveApiKey: async () => undefined,
    auth: {
      credentials: {
        read: async () => undefined,
        list: async () => [],
        modify: async () => { throw new LlmError('OpenCode Go 的 API key 由本插件管理，请在设置 → OpenCode / Go 中登录。', 'OPENCODE_GO_AUTH_REQUIRED'); },
        delete: async () => {},
      },
      authContext: { env: async () => undefined, fileExists: async () => false },
    },
    resolveAttachments: () => ctx.get('attachments'),
    resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(attachments, path => ctx.get('fs')?.processPathFromHostPath(path), ref),
    onReplayDegrade: () => ctx.logger.warn('OpenCode Go response history fell back to provider-neutral content.'),
  });
}

export async function apply(ctx, config) {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = config.requestTimeoutMs ?? 20000;
  const bridge = new SystemProxyBridge({
    enabled: config.useSystemProxy ?? process.platform === 'darwin',
    hostProxied: proxyRouteFor(`${baseUrl.replace(/\/$/, '')}/usage`).proxied,
    install: installProxyFromEnvironment,
    report: message => ctx.logger.warn(message),
  });
  ctx.effect(() => () => bridge.dispose());
  await bridge.start();

  const source = new ApiKeySource({ ...config, baseUrl, credentials: ctx.get('credentials') });
  const enabled = () => (typeof config.enabled?.get === 'function' ? config.enabled.get() : config.enabled) !== false;
  const baseline = tagModels(opencodeGoProvider().getModels(), PROVIDER);
  // Zen and Go share model ids; the Zen catalog only supplies metadata for ids
  // the bundled Go catalog is missing, and the Go route is taken from the
  // bundled Go catalog itself.
  const fallbackCatalog = opencodeProvider().getModels();
  let registration;
  const modelSync = new ModelSync({
    source, enabled, beforeAuth: () => bridge.ensure(), baseline, fallbackCatalog, provider: PROVIDER,
    fetchIds: options => fetchModelIds({ ...options, timeoutMs }),
    intervalMinutes: config.modelRefreshMinutes ?? 360,
    ...(config.modelCachePath ? { store: modelCacheStore(config.modelCachePath) } : {}),
    onUpdate: () => registration?.replace?.([PROVIDER]),
  });
  ctx.effect(() => () => modelSync.dispose());

  const controller = new AuthController({
    source, enabled, beforeAuth: () => bridge.ensure(), modelSync,
    quotaStore: quotaCacheStore(config.quotaCachePath ?? quotaCacheFile(baseUrl)),
    showModelSync: config.showModelSync !== false,
    fetchUsageImpl: options => fetchUsage({ ...options, timeoutMs }),
  });
  ctx.effect(() => () => controller.dispose());
  const quotaSync = new QuotaSync({ controller, intervalMinutes: config.quotaRefreshMinutes ?? 5 });
  controller.quotaSync = quotaSync;
  ctx.effect(() => () => quotaSync.dispose());

  const handle = authRpcHandler(controller);
  // Exact /api routes inherit Harness's authenticated Host/Origin boundary and
  // also work through the desktop's in-process Fetch carrier.
  for (const endpoint of ENDPOINTS) {
    ctx.connection.fetch.register({
      path: `${ROUTE_PREFIX}/${endpoint}`, methods: ['POST'], requestBody: 'buffered',
      fetch: async request => {
        let parsed;
        try { parsed = clientRequestSchema.safeParse(await request.json()); } catch { return new Response('invalid request', { status: 400 }); }
        if (!parsed.success || parsed.data.method !== `opencode-go-auth/${endpoint}`) return new Response('invalid request', { status: 400 });
        return Response.json({ type: 'server-response', rpcId: parsed.data.rpcId, result: await handle(endpoint, parsed.data.payload) });
      },
    });
  }

  registration = ctx.llm.registerAdapter([PROVIDER], createOpencodeGoAdapter(ctx, config, source, async () => {
    if (!enabled()) throw new LlmError('OpenCode Go 连接已停用，请在设置 → OpenCode / Go 中启用。', 'OPENCODE_GO_CONNECTION_DISABLED');
    await bridge.ensure();
  }, () => modelSync.models));

  // Model discovery never delays startup or replaces a working catalog on error.
  modelSync.start().catch(() => ctx.logger.warn('OpenCode Go model sync failed; the current catalog remains available.'));
  // Process-owned DATA refresh: no settings page, code updater, daemon or launchd.
  quotaSync.start().catch(() => ctx.logger.warn('OpenCode Go quota sync failed; the last successful snapshot remains available.'));
  ctx.logger.info('OpenCode Go subscription provider is available. Authentication is managed by this plugin.');
}
