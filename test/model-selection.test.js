import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { withModelSelection } from '../src/model-selection.js';

const catalog = [
  { id: 'model-a', name: 'Alpha', inputModalities: ['text', 'image'] },
  { id: 'model-b', name: 'Beta', inputModalities: ['text'] },
];

test('picker filtering follows live preferences while exact model resolution stays available', async () => {
  let ids = null, models = catalog;
  const native = {
    async listModels() { assert.equal(this, native); return models; },
    async resolveModel(_provider, id) { return models.find(model => model.id === id); },
  };
  const adapter = withModelSelection(native, { selectedModelIds: { get: () => ids } });
  assert.deepEqual(await adapter.listModels('provider'), catalog);
  ids = ['model-b', 'temporarily-unavailable'];
  assert.deepEqual(await adapter.listModels('provider'), [catalog[1]]);
  assert.equal(await adapter.resolveModel('provider', 'model-a'), catalog[0]);
  models = [...catalog, { id: 'model-c', name: 'New model' }];
  assert.deepEqual(await adapter.listModels('provider'), [catalog[1]], 'new discovery stays unchecked');
  ids = [];
  assert.deepEqual(await adapter.listModels('provider'), []);
  ids = null;
  assert.deepEqual(await adapter.listModels('provider'), models);
});

test('legacy omitted config and explicit lists both work without a volatile ref', async () => {
  const native = () => ({ listModels: async () => catalog });
  assert.deepEqual(await withModelSelection(native(), {}).listModels('p'), catalog);
  assert.deepEqual(await withModelSelection(native(), { selectedModelIds: [] }).listModels('p'), []);
});

const CLIENT = await readFile(new URL('../src/client.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function mount(ids = null) {
  let registration, AuthPage, Component, cursor = 0, tree;
  let hooks = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = initial;
      return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return hooks[i] ??= { current: initial }; },
    useEffect() {},
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  };
  vm.runInNewContext(CLIENT, { window: { __ModuleLoader__: { load: value => { registration = value; } } } });
  registration.factory(() => React).apply({
    effect() {},
    slots: { inject: (_name, callback) => callback(), register: (_options, page) => { AuthPage = page; } },
  });
  const state = { value: { enabled: true, selectedModelIds: ids }, writable: true };
  const form = {
    calls: [], failure: false,
    getSnapshot: () => state, subscribe() {},
    async set(path, value) {
      form.calls.push([path, structuredClone(value)]);
      if (form.wait) await form.wait;
      if (form.failure) return false;
      state.value[path] = structuredClone(value);
      return true;
    },
  };
  const walk = node => {
    if (Array.isArray(node)) return node.flatMap(walk);
    if (!node || typeof node !== 'object') return [];
    return [node, ...node.children.flatMap(walk)];
  };
  const page = AuthPage({ form, rpc: async () => ({ ok: true }) });
  Component = walk(page).find(node => node.type?.name === 'ModelSelection').type;
  hooks = [];
  const props = { models: structuredClone(catalog), form, formState: state };
  const render = () => { cursor = 0; return tree = Component(props); };
  const inputs = () => walk(tree).filter(node => node.type === 'input' && node.props.type === 'checkbox');
  const button = label => walk(tree).find(node => node.type === 'button' && node.children.includes(label));
  const text = () => JSON.stringify(tree);
  render();
  return { form, state, props, render, inputs, button, text,
    async check(index, checked) { inputs()[index].props.onChange({ target: { checked } }); await flush(); render(); },
    async click(label) { await button(label).props.onClick(); await flush(); render(); },
    search(value) { walk(tree).find(node => node.props.type === 'search').props.onChange({ target: { value } }); render(); },
  };
}

test('the shipped settings page saves unchecked ids and restores them after remount', async () => {
  const page = mount();
  assert.deepEqual(page.inputs().map(input => input.props.checked), [true, true]);
  await page.check(0, false);
  assert.deepEqual(page.form.calls, [['selectedModelIds', ['model-b']]]);
  const reopened = mount(page.state.value.selectedModelIds);
  assert.deepEqual(reopened.inputs().map(input => input.props.checked), [false, true]);
  assert.match(page.text(), /已保存/);
});

test('searching limits the view without changing choices; hidden and new models remain selectable', async () => {
  const page = mount(['model-a', 'temporarily-unavailable']);
  page.search('BETA');
  assert.equal(page.inputs().length, 1);
  await page.check(0, true);
  assert.deepEqual(page.form.calls[0][1], ['model-a', 'temporarily-unavailable', 'model-b']);
  page.props.models.push({ id: 'model-c', name: 'New model' });
  page.search('');
  assert.deepEqual(page.inputs().map(input => input.props.checked), [true, true, false]);
  await page.check(2, true);
  assert(page.state.value.selectedModelIds.includes('model-c'));
});

test('select none, select all, and reset work even when every model is hidden', async () => {
  const page = mount();
  await page.click('全不选');
  assert.deepEqual(page.state.value.selectedModelIds, []);
  assert.deepEqual(page.inputs().map(input => input.props.checked), [false, false]);
  assert.match(page.text(), /已隐藏此插件的全部模型/);
  await page.click('全选');
  assert.deepEqual(page.state.value.selectedModelIds, ['model-a', 'model-b']);
  await page.click('恢复默认');
  assert.equal(page.state.value.selectedModelIds, null);
});

test('save failures preserve the saved selection and rapid clicks cannot overlap writes', async () => {
  const page = mount(['model-a']);
  page.form.failure = true;
  await page.check(0, false);
  assert.deepEqual(page.state.value.selectedModelIds, ['model-a']);
  assert.match(page.text(), /模型选择未保存/);
  let release;
  page.form.wait = new Promise(resolve => { release = resolve; });
  const previousCalls = page.form.calls.length;
  page.inputs()[0].props.onChange({ target: { checked: false } });
  page.inputs()[1].props.onChange({ target: { checked: true } });
  page.render();
  assert.equal(page.form.calls.length, previousCalls + 1);
  assert(page.inputs().every(input => input.props.disabled));
  assert.equal(page.inputs()[0].props.checked, false, 'the click paints before the network save finishes');
  release();
  await flush();
  page.render();
  assert(page.inputs().every(input => !input.props.disabled));
  assert.equal(page.inputs()[0].props.checked, true, 'a failed save restores the persisted choice');
});
