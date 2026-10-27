// A null preference follows the complete catalog. An explicit list, including
// an empty one, only advertises those ids; discovery keeps its full catalog.
export function filterSelectedModels(models, selectedIds) {
  if (selectedIds == null) return models;
  const selected = new Set(selectedIds);
  return models.filter(model => selected.has(model.id));
}

export function withModelSelection(adapter, config) {
  const listModels = adapter.listModels.bind(adapter);
  adapter.listModels = async provider => {
    const models = await listModels(provider);
    const preference = config.selectedModelIds;
    const ids = typeof preference?.get === 'function' ? preference.get() : preference;
    return filterSelectedModels(models, ids);
  };
  // Exact resolution and prepared calls still use the full native catalog, so
  // hiding a picker entry does not invalidate a conversation already using it.
  return adapter;
}
