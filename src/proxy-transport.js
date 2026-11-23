import { AsyncLocalStorage } from 'node:async_hooks';

// Google GenAI uses global fetch and rejects a custom fetch option. Select an
// explicit dispatcher only inside this plugin's asynchronous request scope;
// never replace the Host's dispatcher or publish proxy variables process-wide.
const scope = new AsyncLocalStorage();
let hook;

function retainFetchHook() {
  if (!hook) {
    const previous = globalThis.fetch;
    const routed = (input, init) => {
      const dispatcher = scope.getStore();
      return previous(input, dispatcher ? { ...init, dispatcher } : init);
    };
    hook = { previous, routed, users: 0 };
    globalThis.fetch = routed;
  }
  const current = hook;
  current.users += 1;
  return () => {
    if (--current.users !== 0) return;
    if (globalThis.fetch === current.routed) globalThis.fetch = current.previous;
    if (hook === current) hook = undefined;
  };
}

export async function createProxyTransport(environment) {
  const { Agent, EnvHttpProxyAgent, Dispatcher1Wrapper } = await import('undici');
  // Empty strings explicitly suppress EnvHttpProxyAgent's process.env fallback.
  // The macOS settings, including proxy-off, are authoritative for this scope.
  const dispatcher = environment.HTTP_PROXY || environment.HTTPS_PROXY
    ? new EnvHttpProxyAgent({
      httpProxy: environment.HTTP_PROXY ?? '',
      httpsProxy: environment.HTTPS_PROXY ?? environment.HTTP_PROXY ?? '',
      noProxy: environment.NO_PROXY ?? 'localhost,127.0.0.1,::1,[::1]',
    })
    : new Agent();
  const releaseHook = retainFetchHook();
  // Node 24's built-in fetch still uses Dispatcher API v1. Undici 8 exports
  // this adapter and uses the same wrapper for its own setGlobalDispatcher.
  const fetchDispatcher = typeof Dispatcher1Wrapper === 'function' ? new Dispatcher1Wrapper(dispatcher) : dispatcher;
  return {
    run: operation => scope.run(fetchDispatcher, operation),
    async close() {
      try { await dispatcher.close(); } finally { releaseHook(); }
    },
  };
}
