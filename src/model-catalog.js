/**
 * The bundled pi-ai catalog carries names, limits, prices and the wire
 * protocol; the OpenCode Go catalog endpoint carries ids only. Metadata is
 * resolved in three steps, from most to least trustworthy:
 *
 *   1. the bundled Go catalog, for ids it already knows;
 *   2. the bundled Zen catalog, for ids the Go catalog is missing, because Zen
 *      and Go share model ids and differ only in the API root;
 *   3. a conservative template, because neither token limits nor the protocol
 *      can be inferred from an id alone.
 */

const PROTOCOL_ORDER = ['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai'];

/** The Go route for a protocol, taken from the bundled Go catalog itself. */
function routeFor(baseline, api) {
  return baseline.find(model => model.api === api)?.baseUrl;
}

/** Prefer a chat/completions template: most Go models are served on that route. */
function templateFor(baseline) {
  for (const api of PROTOCOL_ORDER) {
    const found = baseline.find(model => model.api === api);
    if (found) return found;
  }
  return baseline[0];
}

function conservative(baseline, id, provider) {
  const model = {
    ...structuredClone(templateFor(baseline)),
    id,
    name: id,
    contextWindow: 16384,
    maxTokens: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    reasoning: false,
  };
  // Do not infer reasoning controls or protocol quirks from a different model.
  delete model.thinkingLevelMap;
  delete model.compat;
  if (provider) model.provider = provider;
  return model;
}

function borrowed(baseline, entry, provider) {
  const baseUrl = routeFor(baseline, entry.api);
  // Without a Go route for that protocol the entry cannot be called correctly.
  if (!baseUrl) return undefined;
  const model = { ...structuredClone(entry), baseUrl };
  if (provider) model.provider = provider;
  return model;
}

export function mergeOpencodeModels(baseline, discoveredIds, { provider, fallbackCatalog = [] } = {}) {
  if (!Array.isArray(discoveredIds) || !discoveredIds.length) return baseline;
  if (!baseline.length) return baseline;
  const known = new Map(baseline.map(model => [model.id, model]));
  const fallback = new Map(fallbackCatalog.map(model => [model.id, model]));
  const models = [];
  for (const id of discoveredIds) {
    const existing = known.get(id);
    if (existing) { models.push(existing); continue; }
    const sibling = fallback.get(id);
    const adopted = sibling ? borrowed(baseline, sibling, provider) : undefined;
    models.push(adopted ?? conservative(baseline, id, provider));
  }
  const remote = new Set(discoveredIds);
  // Keep previously working models so an existing selection never disappears.
  return [...models, ...baseline.filter(model => !remote.has(model.id))];
}

/** Tag every model with this plugin's provider id so the picker groups them. */
export function tagModels(models, provider) {
  return models.map(model => ({ ...model, provider }));
}
