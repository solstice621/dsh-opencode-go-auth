/** Check the services used during activation before starting background work. */
export function assertHostCapabilities(ctx, plugin) {
  const missing = [
    ['get', ctx?.get], ['on', ctx?.on], ['effect', ctx?.effect],
    ['llm.registerAdapter', ctx?.llm?.registerAdapter],
    ['connection.fetch.register', ctx?.connection?.fetch?.register],
  ].filter(([, method]) => typeof method !== 'function').map(([api]) => api);
  if (missing.length) throw new Error(`${plugin}: Harness is missing required APIs: ${missing.join(', ')}`);
}
