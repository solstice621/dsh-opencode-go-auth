// Harness native lazy-CJS client entry. React is provided by the desktop shell.
window.__ModuleLoader__.load({
  id: 'dsh-opencode-go-auth',
  factory: require => {
    const React = require('react');
    const h = React.createElement;
    const css = `
.opencode-go-auth{color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6;padding-bottom:16px}
.opencode-go-auth h2{font-size:22px;font-weight:600;letter-spacing:-.4px;margin:0 0 4px}.opencode-go-auth h3{font-size:14px;font-weight:600;margin:0}
.opencode-go-auth p{margin:6px 0}.opencode-go-auth .muted{color:var(--dsw-alias-label-secondary)}
.opencode-go-auth .card{border:1px solid var(--dsw-alias-border-medium,rgba(128,128,128,.2));border-radius:12px;padding:18px;margin-top:20px;background:var(--dsw-alias-bg-layer-1,transparent)}
.opencode-go-auth .row{display:flex;align-items:center;justify-content:space-between;gap:12px}.opencode-go-auth .badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap;padding:3px 9px;border-radius:999px;background:rgba(40,167,110,.1);color:#239c68}.opencode-go-auth .badge.off{background:rgba(128,128,128,.12);color:var(--dsw-alias-label-secondary)}
.opencode-go-auth .dot{width:6px;height:6px;border-radius:50%;background:currentColor}.opencode-go-auth .account{font-size:17px;font-weight:500;word-break:break-all;margin:14px 0 2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.opencode-go-auth .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.opencode-go-auth button,.opencode-go-auth a.action{font:inherit;font-size:13px;font-weight:500;border:1px solid var(--dsw-alias-border-medium,rgba(128,128,128,.25));border-radius:8px;padding:7px 12px;color:inherit;background:transparent;cursor:pointer;text-decoration:none;line-height:20px}
.opencode-go-auth button:hover,.opencode-go-auth a.action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1))}.opencode-go-auth button.primary,.opencode-go-auth a.primary{background:#4d6bfe;border-color:#4d6bfe;color:white}.opencode-go-auth button:disabled{opacity:.45;cursor:default}.opencode-go-auth button:focus-visible,.opencode-go-auth a:focus-visible,.opencode-go-auth input:focus-visible{outline:2px solid #4d6bfe;outline-offset:3px}
.opencode-go-auth .small{font-size:12px}.opencode-go-auth .quota-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px}.opencode-go-auth .quota-name{font-size:12px;margin-bottom:5px}.opencode-go-auth .percent{font-size:23px;font-weight:600;line-height:1.3}.opencode-go-auth .track{background:rgba(128,128,128,.15);height:5px;border-radius:8px;margin:10px 0;overflow:hidden}.opencode-go-auth .fill{height:100%;background:#4d6bfe;border-radius:8px}.opencode-go-auth .notice{padding:12px 14px;border-radius:8px;background:rgba(77,107,254,.08);margin-top:14px}.opencode-go-auth .error{background:rgba(219,84,84,.09);color:var(--dsw-alias-label-primary)}
.opencode-go-auth .text-button{border:0;padding:0;color:#4d6bfe;background:none}.opencode-go-auth .footer{margin-top:20px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.opencode-go-auth .login-form{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}.opencode-go-auth input[type=password]{flex:1;min-width:220px;font:inherit;font-size:13px;padding:7px 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-medium,rgba(128,128,128,.3));background:transparent;color:inherit}
@media(max-width:780px){.opencode-go-auth .quota-grid{grid-template-columns:1fr}.opencode-go-auth .row{align-items:flex-start}}
.opencode-go-auth .model-search{box-sizing:border-box;width:100%;margin-top:14px;padding:8px 10px;border:1px solid var(--dsw-alias-border-medium,rgba(128,128,128,.25));border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px}
.opencode-go-auth .model-list{max-height:280px;overflow-y:auto;margin-top:10px}.opencode-go-auth .model-option{display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:8px;cursor:pointer}.opencode-go-auth .model-option:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1))}.opencode-go-auth .model-option:has(input:disabled){opacity:.6;cursor:default}
.opencode-go-auth .model-option input{width:16px;height:16px;margin:0;flex-shrink:0;accent-color:#4d6bfe}.opencode-go-auth .model-label{display:flex;flex-direction:column;min-width:0}.opencode-go-auth .model-id{overflow-wrap:anywhere}.opencode-go-auth .model-list input:focus-visible,.opencode-go-auth .model-search:focus-visible{outline:2px solid #4d6bfe;outline-offset:2px}
@media(prefers-reduced-motion:no-preference){.opencode-go-auth .fill{transition:width .2s ease}}
`;
    const errors = {
      OPENCODE_GO_AUTH_REQUIRED: '还没有可用的 OpenCode Go API key。登录后即可使用订阅额度。',
      OPENCODE_GO_KEY_INVALID: 'API key 无效或已被撤销，请重新登录。',
      OPENCODE_GO_SUBSCRIPTION_REQUIRED: '该 key 没有 OpenCode Go 订阅。请先在 OpenCode 控制台订阅 Go 或 Go Plus。',
      OPENCODE_GO_ENDPOINT_NOT_FOUND: '接口地址不可用，请检查插件配置里的 baseUrl。',
      OPENCODE_GO_ENDPOINT_INVALID: '接口地址无效，请检查插件配置里的 baseUrl。',
      OPENCODE_GO_RATE_LIMITED: 'OpenCode Go 暂时限流，请稍后重试。',
      OPENCODE_GO_UNREACHABLE: '无法连接 OpenCode Go，请检查网络或系统代理。',
      OPENCODE_GO_TIMEOUT: '请求超时，请检查当前网络和代理后重试。',
      OPENCODE_GO_PROTOCOL_ERROR: 'OpenCode Go 返回了无法识别的响应。',
      OPENCODE_GO_REQUEST_FAILED: 'OpenCode Go 请求失败，请稍后重试。',
      OPENCODE_GO_CREDENTIALS_UNAVAILABLE: 'Harness 凭据服务不可用，无法保存或移除 API key。',
      OPENCODE_GO_KEY_CHANGED: 'API key 已变化，请重新同步模型。',
      OPENCODE_GO_MODEL_SYNC_FAILED: '模型同步失败，已保留当前目录。',
      OPENCODE_GO_CONNECTION_DISABLED: '请先启用 OpenCode Go 连接。',
      SYSTEM_PROXY_UNSUPPORTED: '系统代理仅支持静态 HTTP/HTTPS 设置，PAC 或 SOCKS 暂不支持。',
      SYSTEM_PROXY_INVALID: '系统代理设置无效，请检查 macOS 代理。',
      SYSTEM_PROXY_UNAVAILABLE: '无法读取 macOS 系统代理，请检查网络设置后重试。',
    };
    const sourceLabels = source => {
      if (!source) return '未知来源';
      if (source === 'plugin-config') return '插件配置';
      if (source === 'environment' || source === 'env') return '环境变量';
      if (source === 'file') return 'Harness 凭据存储';
      if (String(source).startsWith('opencode:')) return '本机 OpenCode 登录';
      return String(source);
    };
    const date = value => value ? new Date(value).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未知';

    function ModelSelection({ models = [], form, formState }) {
      const [query, setQuery] = React.useState('');
      const [saving, setSaving] = React.useState(false);
      const [message, setMessage] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [pendingIds, setPendingIds] = React.useState(undefined);
      const pending = React.useRef(false);
      const active = React.useRef(true);
      React.useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
      const savedIds = formState.value?.selectedModelIds ?? null;
      const ids = pendingIds === undefined ? savedIds : pendingIds;
      const selected = ids === null ? null : new Set(ids);
      const count = models.filter(model => selected === null || selected.has(model.id)).length;
      const needle = query.trim().toLowerCase();
      const matches = models.filter(model => (model.name + ' ' + model.id).toLowerCase().includes(needle));
      const locked = saving || !formState.writable || !models.length;

      async function save(next) {
        if (pending.current) return;
        pending.current = true;
        setPendingIds(next);
        setSaving(true); setError(null); setMessage(null);
        try {
          if (!await form.set('selectedModelIds', next)) throw Error('settings write failed');
          if (active.current) setMessage('已保存，会话模型列表已更新。');
        } catch {
          if (active.current) setError('模型选择未保存，请重试。');
        } finally {
          pending.current = false;
          if (active.current) { setPendingIds(undefined); setSaving(false); }
        }
      }
      function toggle(id, checked) {
        const next = new Set(ids ?? models.map(model => model.id));
        if (checked) next.add(id); else next.delete(id);
        save([...next]);
      }

      return h('div', { className: 'card', 'aria-busy': saving },
        h('div', { className: 'row' }, h('h3', null, '模型显示'), h('span', { className: 'small muted', role: 'status' }, '已选 ' + count + ' / ' + models.length + ' 个模型')),
        h('p', { className: 'small muted', style: { marginTop: 12 } }, '勾选后自动保存；会话模型列表只显示选中的模型。'),
        h('p', { className: 'small muted' }, ids === null ? '默认显示全部模型，包括之后同步到的新模型。' : '之后同步到的新模型需手动勾选。'),
        h('div', { className: 'buttons' },
          h('button', { type: 'button', disabled: locked, onClick: () => save([...new Set([...(ids ?? []), ...models.map(model => model.id)])]) }, '全选'),
          h('button', { type: 'button', disabled: locked || count === 0, onClick: () => save([]) }, '全不选'),
          h('button', { type: 'button', disabled: locked || ids === null, onClick: () => save(null) }, '恢复默认')),
        h('input', { type: 'search', className: 'model-search', placeholder: '搜索模型名称或 ID…', 'aria-label': '搜索可显示的模型', value: query, onChange: event => setQuery(event.target.value) }),
        h('div', { className: 'model-list', role: 'group', 'aria-label': '会话中显示的模型' },
          matches.map(model => h('label', { className: 'model-option', key: model.id },
            h('input', { type: 'checkbox', checked: selected === null || selected.has(model.id), disabled: locked, onChange: event => toggle(model.id, event.target.checked) }),
            h('span', { className: 'model-label' }, h('span', null, model.name), h('span', { className: 'small muted model-id' }, model.id)))),
          !matches.length && h('p', { className: 'small muted' }, models.length ? '没有匹配的模型。' : '正在读取模型目录…')),
        ids !== null && count === 0 && models.length > 0 && h('p', { className: 'small muted' }, '已隐藏此插件的全部模型，可随时重新勾选。'),
        !formState.writable && h('p', { className: 'small muted' }, '当前设置暂不可写，请稍后重试。'),
        saving && h('p', { className: 'small muted', role: 'status' }, '正在保存模型选择…'),
        message && h('p', { className: 'small muted', role: 'status' }, message),
        error && h('p', { className: 'notice error', role: 'alert' }, error));
    }

    function QuotaWindow({ value, hidden }) {
      if (!value) return h('div', null, h('p', { className: 'muted small' }, '该窗口数据暂不可用'));
      const remaining = value.usedPercent == null ? null : Math.max(0, Math.round(100 - value.usedPercent));
      return h('div', null,
        h('div', { className: 'quota-name muted' }, value.name),
        h('div', { className: 'percent' }, remaining == null ? '—' : `${remaining}%`, h('span', { className: 'small muted', style: { marginLeft: 6, fontWeight: 400 } }, '剩余')),
        h('div', { className: 'track', role: 'progressbar', 'aria-label': `${value.name}剩余额度`, 'aria-valuenow': remaining ?? 0, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div', { className: 'fill', style: { width: `${remaining ?? 0}%`, background: remaining != null && remaining < 10 ? '#d9853b' : undefined } })),
        h('div', { className: 'small muted' }, `重置时间：${date(value.resetsAt)}`),
        value.status === 'rate-limited' && h('div', { className: 'small', style: { color: '#d9853b' } }, '该窗口已用尽'));
    }

    function AuthPage({ rpc, form }) {
      const [state, setState] = React.useState(null);
      const [quota, setQuota] = React.useState(null);
      const [busy, setBusy] = React.useState('state');
      const [error, setError] = React.useState(null);
      const [notice, setNotice] = React.useState(null);
      const [quotaError, setQuotaError] = React.useState(null);
      const [hideKey, setHideKey] = React.useState(false);
      const [editing, setEditing] = React.useState(false);
      const [draft, setDraft] = React.useState('');
      const formState = React.useSyncExternalStore(listener => form.subscribe(listener), () => form.getSnapshot());
      const enabled = formState.value?.enabled ?? state?.enabled ?? true;
      const active = React.useRef(true);
      const previousCredential = React.useRef(null);

      async function call(method, payload) {
        const result = await rpc(method, payload);
        if (!result.ok) throw Object.assign(new Error(result.error.message), { code: result.error.code });
        return result.value;
      }
      function accept(value) {
        if (!active.current) return;
        const identity = value.credential?.id ?? null;
        if (previousCredential.current !== identity) { setQuota(null); setQuotaError(null); previousCredential.current = identity; }
        setState(value);
      }
      function acceptQuota(value, identity = previousCredential.current) {
        if (!active.current || !value?.windows?.length || !Number.isFinite(value.fetchedAt)
          || !identity || previousCredential.current !== identity || value.credentialId !== identity) return false;
        setQuota(previous => {
          if (!active.current || previousCredential.current !== identity) return previous;
          // Slow disk polling must never downgrade a newer manual/network reading.
          if (previous && (previous.fetchedAt > value.fetchedAt
            || (previous.fetchedAt === value.fetchedAt && value.cached))) return previous;
          return value;
        });
        return true;
      }
      async function loadQuota() {
        const identity = previousCredential.current;
        if (active.current) { setBusy('quota'); setQuotaError(null); }
        // A cached reading stays on screen while the refresh runs; only a failure
        // with nothing to show falls back to the placeholder text.
        try { acceptQuota(await call('quota'), identity); }
        catch (err) { if (active.current && previousCredential.current === identity) setQuotaError(errors[err.code] ?? '额度读取失败，请检查网络后重试。'); }
        finally { if (active.current) setBusy(null); }
      }
      // Paint/poll only disk data; background network refresh belongs to the backend.
      async function showCachedQuota() {
        const identity = previousCredential.current;
        try { return acceptQuota(await call('cached'), identity); }
        catch { return false; } // Poll failures never erase a good reading.
      }
      async function sync() { const value = await call('state'); accept(value); return value; }
      React.useEffect(() => {
        active.current = true;
        sync().then(async value => {
          if (!active.current) return;
          if (!value.connected || !value.enabled) { setBusy(null); return; }
          const painted = await showCachedQuota();
          if (!active.current) return;
          if (!painted) setBusy('quota');
          await loadQuota();
        }).catch(() => { if (active.current) { setError('无法读取授权状态，请重试或重启 Harness。'); setBusy(null); } });
        const focus = () => { sync().catch(() => {}); };
        window.addEventListener('focus', focus);
        return () => { active.current = false; window.removeEventListener('focus', focus); };
      }, []);
      React.useEffect(() => {
        // Poll only local display state; network discovery has its own TTL.
        const timer = window.setInterval(() => { sync().catch(() => {}); }, state?.models?.refreshing ? 1500 : 30000);
        return () => window.clearInterval(timer);
      }, [state?.models?.refreshing]);
      React.useEffect(() => {
        // Observe backend quota refresh even when this page stays open for hours.
        const timer = window.setInterval(() => { showCachedQuota(); }, 30000);
        return () => window.clearInterval(timer);
      }, []);

      async function operation(method, payload) {
        setBusy(method); setError(null); setNotice(null);
        try {
          const value = await call(method, payload);
          if (!active.current) return;
          accept(value);
          if (method === 'refresh') { setNotice('已重新读取订阅额度。'); acceptQuota(value); setQuotaError(null); }
          if (method === 'login') { setNotice('已保存 API key，OpenCode Go 授权可用。'); setEditing(false); setDraft(''); acceptQuota(value); setQuotaError(null); }
          if (method === 'logout') { setNotice('已移除保存的 API key。'); setQuota(null); }
          if (method === 'models') setNotice(`模型目录已同步，共 ${value.models?.totalModels ?? 0} 个模型。`);
        } catch (err) { setError(errors[err.code] ?? err.message ?? '操作未完成，请检查网络后重试。'); }
        finally { if (active.current) setBusy(null); }
      }
      async function toggle() {
        setBusy('toggle'); setError(null); setNotice(null);
        try {
          const target = !enabled;
          const accepted = await form.set('enabled', target);
          if (!accepted) throw Error('settings write failed');
          setNotice(target ? 'OpenCode Go 连接已启用。' : '已停用 Harness 的 OpenCode Go 连接。');
          await sync();
        } catch { setError('设置未保存，请重新打开此页面后重试。'); }
        finally { if (active.current) setBusy(null); }
      }
      const status = !state ? (busy === 'state' ? '读取中' : '未能读取') : !enabled ? '已停用' : state.connected ? '已连接' : '需要登录';
      const locked = Boolean(busy);
      const quotaStatusError = quotaError ?? (state?.quotaSync?.error ? errors[state.quotaSync.error] ?? '后台额度刷新未完成，保留最近成功的数据。' : null);
      return h('div', { className: 'opencode-go-auth', 'aria-busy': locked },
        h('h2', null, 'OpenCode / Go'),
        h('p', { className: 'muted' }, '在 Harness 使用你的 OpenCode Go 订阅，并查看用量额度。'),
        h('div', { className: 'card' },
          h('div', { className: 'row' }, h('h3', null, '账号连接'), h('span', { className: 'badge' + (enabled && state?.connected ? '' : ' off'), role: 'status' }, h('span', { className: 'dot' }), status)),
          h('div', { className: 'row', style: { marginTop: 14 } },
            h('div', { className: 'account', style: { marginTop: 0 } }, state?.credential ? (hideKey ? 'OpenCode Go API key（已隐藏）' : state.credential.label) : '尚未配置 API key'),
            state?.credential && h('button', { className: 'text-button small', onClick: () => setHideKey(value => !value), 'aria-pressed': hideKey }, hideKey ? '显示 key' : '隐藏 key')),
          state?.credential && h('p', { className: 'muted small' }, `来源：${sourceLabels(state.credential.source)}${state.verifiedAt ? ` · 最近验证 ${date(state.verifiedAt)}` : ''}`),
          state?.error && h('p', { className: 'small muted' }, errors[state.error] ?? '当前授权不可用，请重新登录。'),
          h('div', { className: 'buttons' },
            h('button', { className: !state?.connected ? 'primary' : '', disabled: locked || !state || Boolean(state.credential && !state.credential.writable), onClick: () => { setEditing(value => !value); setError(null); setNotice(null); } },
              state?.credential ? '更换 API key' : '登录 OpenCode Go'),
            state?.credential && h('button', { disabled: locked, onClick: () => operation('refresh') }, busy === 'refresh' ? '正在读取…' : '刷新额度'),
            state?.credential && h('button', { disabled: locked || !state?.credential?.writable, onClick: () => operation('logout') }, busy === 'logout' ? '正在移除…' : '移除授权'),
            h('button', { disabled: locked || !formState.writable, onClick: toggle }, busy === 'toggle' ? '正在保存…' : enabled ? '停用此连接' : '启用此连接'),
            !state && h('button', { disabled: locked, onClick: async () => { setBusy('state'); setError(null); try { await sync(); } catch { setError('无法读取授权状态，请重启 Harness 后重试。'); } finally { setBusy(null); } } }, '重新读取状态')),
          editing && h('div', { className: 'login-form' },
            h('input', { type: 'password', value: draft, autoFocus: true, placeholder: '粘贴 OpenCode Go API key（oc_sk_…）', 'aria-label': 'OpenCode Go API key',
              onChange: event => setDraft(event.target.value), onKeyDown: event => { if (event.key === 'Enter' && draft.trim()) operation('login', { key: draft }); } }),
            h('button', { className: 'primary', disabled: locked || !draft.trim(), onClick: () => operation('login', { key: draft }) }, busy === 'login' ? '正在验证…' : '保存并验证'),
            h('button', { disabled: locked, onClick: () => { setEditing(false); setDraft(''); } }, '取消')),
          h('p', { className: 'small muted', style: { marginTop: 12 } }, '在 opencode.ai/auth 订阅 Go 或 Go Plus 后复制 API key。key 保存在 Harness 凭据存储中，页面与日志都不会读取或显示完整值。'),
          state?.credential && !state.credential.writable && h('p', { className: 'small muted' }, '当前 key 来自环境变量或插件配置，只读；请先取消对应来源再在页面中修改。'),
        ),
        error && h('p', { className: 'notice error', role: 'alert' }, error),
        notice && h('p', { className: 'notice', role: 'status' }, notice),
        h('div', { className: 'card' },
          h('div', { className: 'row' }, h('h3', null, '用量额度'), h('button', { className: 'text-button', disabled: locked || !state?.connected, onClick: loadQuota }, busy === 'quota' ? '读取中…' : '刷新额度')),
          quota?.windows?.length
            ? h('div', { className: 'quota-grid' }, quota.windows.map(value => h(QuotaWindow, { key: value.id, value })))
            : h('p', { className: 'muted', style: { marginTop: 14 } }, busy === 'quota' ? '正在读取 OpenCode Go 额度…' : quotaStatusError ?? '连接账号后可读取额度。'),
          quota?.windows?.length && quotaStatusError && h('p', { className: 'small muted', style: { marginTop: 10 }, role: 'alert' }, quotaStatusError),
          quota && h('p', { className: 'small muted', style: { marginTop: 14 } },
            `${quota.cached ? '上次更新' : '更新于'} ${date(quota.fetchedAt)} · 由 OpenCode Go 订阅返回`,
            busy === 'quota' ? ' · 正在刷新…' : ''),
          h('p', { className: 'small muted', style: { marginTop: 8 } }, !enabled ? '连接已停用，后台额度刷新已暂停。' : `Harness 运行时，后台每 ${state?.quotaSync?.intervalMinutes ?? 5} 分钟自动刷新额度；无需打开此页面。`),
        ),
        state?.showModelSync !== false && h('div', { className: 'card' },
          h('div', { className: 'row' }, h('h3', null, '模型自动同步'), h('button', { className: 'text-button', disabled: locked || !enabled || (!state?.connected && !state?.models?.publicCatalog) || state?.models?.refreshing, onClick: () => operation('models') }, busy === 'models' || state?.models?.refreshing ? '同步中…' : '刷新模型')),
          h('p', { className: 'muted small', style: { marginTop: 14 } }, !enabled ? '连接已停用，自动同步已暂停。' : `启动时同步，每 ${state?.models?.intervalMinutes ?? 360} 分钟自动刷新；更换 API key 后重新同步。`),
          state?.models && h('p', { className: 'small muted', style: { marginTop: 8 } }, `当前 ${state.models.totalModels} 个模型 · ${state.models.source === 'opencode' ? 'OpenCode Go 官方目录' : state.models.source === 'cache' ? '最近成功的缓存' : '内置备用目录'} · 最近同步：${date(state.models.lastSyncAt)}`),
          state?.models?.error && h('p', { className: 'small muted' }, errors[state.models.error] ?? '同步未完成，当前模型目录仍可使用。'),
          state?.models?.cacheSaved === false && h('p', { className: 'small muted' }, '模型目录已更新，但缓存未保存；重启后会重新同步。'),
          state?.models?.publicCatalog && h('p', { className: 'small muted' }, '公开模型目录无需登录即可同步；使用模型和读取额度仍需有效的 Go 授权。'),
          h('p', { className: 'small muted', style: { marginTop: 8 } }, '目录接口只返回模型 ID；已知模型沿用官方元数据，新增模型改用保守的上下文与协议设置。'),
        ),
        h(ModelSelection, { models: state?.models?.availableModels, form, formState }),
        h('p', { className: 'footer' }, '在会话模型选择器中选择「OpenCode · Go 额度」。启用系统代理跟随后，新请求会自动使用当前代理。'));
    }

    // This plugin owns its account quota UI and reads only its own RPC endpoints.
    function registerComposerQuota(ctx) {
      ctx.inject(['modelDirectories'], scope => {
        const { createPortal } = require('react-dom');
        const stamp = time => new Date(time).toLocaleString();
        const quotaCss = `
.dsh-opencode-plan-pill{display:inline-flex;align-items:center;flex-wrap:wrap;gap:2px 7px;max-width:100%;min-width:0;border:0;border-radius:7px;padding:3px 7px;background:transparent;color:var(--dsw-alias-label-secondary,#737373);font:inherit;font-size:12px;line-height:20px;cursor:pointer;font-variant-numeric:tabular-nums;text-align:left}
.dsh-opencode-plan-pill:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1));color:var(--dsw-alias-label-primary)}
.dsh-opencode-plan-pill:focus-visible,.dsh-opencode-plan-dialog button:focus-visible{outline:2px solid #4d6bfe;outline-offset:2px}
.dsh-opencode-plan-window{white-space:nowrap}.dsh-opencode-plan-low{color:#c46d25}.dsh-opencode-plan-separator{color:var(--dsw-alias-label-tertiary,#858585)}
[data-composer-dock]:has([data-auth-plan-usage="dsh-opencode-go-auth"]){flex-wrap:wrap}
.dsh-opencode-plan-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;padding:20px}
.dsh-opencode-plan-dialog{box-sizing:border-box;max-width:600px;width:100%;max-height:85vh;overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#262626);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));border-radius:16px;box-shadow:0 16px 60px #0003;padding:24px;font-size:13px;line-height:1.6}
.dsh-opencode-plan-dialog h2{font-size:18px;margin:0;font-weight:600}.dsh-opencode-plan-dialog p{margin:10px 0}.dsh-opencode-plan-dialog .plan-muted{color:var(--dsw-alias-label-secondary,#737373)}.dsh-opencode-plan-dialog .plan-small{font-size:12px}
.dsh-opencode-plan-dialog .plan-row{display:flex;justify-content:space-between;align-items:center;gap:12px}.dsh-opencode-plan-dialog .dsh-opencode-plan-row{padding-top:14px;margin-top:14px;border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.16))}
.dsh-opencode-plan-dialog button{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));border-radius:8px;padding:5px 10px;background:transparent;color:inherit;font:inherit;cursor:pointer}.dsh-opencode-plan-dialog button:disabled{opacity:.5;cursor:wait}.dsh-opencode-plan-dialog .plan-notice{background:rgba(77,107,254,.07);border-radius:8px;padding:10px 12px;margin-top:12px}
.dsh-opencode-plan-track{height:4px;margin:8px 0;border-radius:4px;background:rgba(128,128,128,.15);overflow:hidden}.dsh-opencode-plan-track>span{display:block;height:100%;background:#4d6bfe;border-radius:4px}
@media(max-width:560px){.dsh-opencode-plan-backdrop{padding:12px}.dsh-opencode-plan-dialog{padding:18px}.dsh-opencode-plan-pill{font-size:11px;padding-inline:4px;gap:2px 5px}}`;
        const composerSource = {"label": "OpenCode Go", "prefix": "opencode-go-auth", "kind": "opencode"};
        const composerProviders = new Set(["opencode-go-subscription", "opencode-go"]);
    const percent = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value) + '%';
    function duration(mins, fallback) {
      if (!Number.isFinite(mins) || mins <= 0) return fallback;
      if (mins % 10080 === 0) return mins === 10080 ? 'Week' : mins / 10080 + 'w';
      if (mins % 1440 === 0) return mins / 1440 + 'd';
      if (mins % 60 === 0) return mins / 60 + 'h';
      return mins + 'm';
    }
    function windowName(value, index) {
      if (Number.isFinite(value.durationMins)) return duration(value.durationMins, value.id);
      const labels = { weekly: 'Week', monthly: 'Month', daily: 'Day' };
      if (labels[value.id]) return labels[value.id];
      const name = value.nameEn || value.name || value.id || 'Window ' + (index + 1);
      const hours = name.match(/(\d+(?:\.\d+)?)\s*[- ]?\s*(?:hours?|小时)/i);
      return hours ? hours[1] + 'h' : name.replace(/额度$/, '').trim();
    }
    function quotaWindows(source, quota) {
      const remaining = value => Number.isFinite(value) ? Math.max(0, Math.min(100, 100 - value)) : null;
      if (source.kind === 'opencode') return (quota?.windows ?? []).map((value, i) => ({
        id: value.id ?? String(i),
        name: windowName(value, i),
        remaining: remaining(value.usedPercent), resetsAt: value.resetsAt,
      }));
      // Preserve every returned bucket and every non-null window within it.
      return (quota?.buckets ?? []).flatMap((bucket, i, buckets) => Object.entries(bucket)
        .filter(([, value]) => value && typeof value === 'object' &&
          ('usedPercent' in value || 'durationMins' in value || 'resetsAt' in value))
        .map(([key, value]) => ({
          id: (bucket.id ?? i) + '/' + key,
          name: (buckets.length > 1 ? (bucket.name || bucket.id || '额度 ' + (i + 1)) + ' · ' : '') + duration(value.durationMins, key),
          remaining: remaining(value.usedPercent), resetsAt: value.resetsAt,
        })));
    }
    function createPlanStore(source, rpc) {
      const empty = () => ({ status: source.prefix ? 'loading' : 'unavailable', quota: null, error: null, busy: false });
      let snapshot = empty(), identity = null, epoch = 0, pending = null, timer, disposed = false;
      let lastAttempt = -Infinity;
      const listeners = new Set();
      const keyOf = state => source.kind === 'codex' ? state?.account?.key : state?.credential?.id;
      const quotaKey = quota => source.kind === 'codex' ? quota?.identity : quota?.credentialId;
      function publish(value) { snapshot = { ...snapshot, ...value }; for (const fn of listeners) fn(); }
      async function call(method) {
        const result = await rpc(source.prefix, method);
        if (!result?.ok) throw Error('quota-unavailable');
        return result.value;
      }
      function load(force = false) {
        if (disposed || !listeners.size || !source.prefix || (document.hidden && !force)) return Promise.resolve();
        if (pending) return pending.promise;
        const job = { epoch, force };
        const valid = () => !disposed && listeners.size > 0 && epoch === job.epoch;
        pending = job;
        job.promise = (async () => {
          try {
            const state = await call('state');
            if (!valid()) return;
            const nextIdentity = keyOf(state) ?? null;
            if (nextIdentity !== identity) {
              identity = nextIdentity; lastAttempt = -Infinity;
              publish({ ...empty(), busy: force });
            }
            if (!state.enabled || !state.connected || !identity) {
              publish({ status: !state.enabled ? 'disabled' : 'disconnected', quota: null, error: null, busy: false });
              return;
            }
            if (force) publish({ busy: true, error: null });
            let quota = await call('cached');
            if (!valid()) return;
            if (quota && quotaKey(quota) !== identity) {
              publish({ status: 'loading', quota: null, busy: false, error: '账号正在切换，等待更新。' });
              return;
            }
            if (quota && (!snapshot.quota || quota.fetchedAt >= snapshot.quota.fetchedAt)) {
              publish({ status: 'ready', quota, error: null });
            }
            // The auth plugins already refresh in the backend. Only a missing
            // cache or an explicit user refresh needs an upstream quota read.
            if (force || (!quota && Date.now() - lastAttempt >= 300000)) {
              lastAttempt = Date.now(); publish({ busy: true });
              quota = await call('quota');
              if (!valid()) return;
              if (quotaKey(quota) !== identity) {
                publish({ status: 'loading', quota: null, busy: false, error: '账号正在切换，等待更新。' });
                return;
              }
              if (!snapshot.quota || quota.fetchedAt >= snapshot.quota.fetchedAt) publish({ status: 'ready', quota, error: null });
            }
            if (!valid()) return;
            publish({ status: snapshot.quota ? 'ready' : 'unavailable', busy: false });
          } catch {
            if (valid()) publish({ status: snapshot.quota ? 'ready' : 'error', busy: false, error: '额度暂时无法读取，请稍后重试。' });
          }
        })().finally(() => { if (pending === job) pending = null; });
        return job.promise;
      }
      const visible = () => { if (!document.hidden) void load(); };
      function stop() {
        epoch++; clearInterval(timer); timer = null; pending = null;
        document.removeEventListener('visibilitychange', visible);
        snapshot = empty(); identity = null; lastAttempt = -Infinity;
      }
      return {
        getSnapshot: () => snapshot,
        subscribe(fn) {
          if (disposed) return () => {};
          listeners.add(fn);
          if (listeners.size === 1 && source.prefix) {
            void load(); timer = setInterval(visible, 30000);
            document.addEventListener('visibilitychange', visible);
          }
          return () => { listeners.delete(fn); if (!listeners.size) stop(); };
        },
        async refresh() {
          if (pending && !pending.force) await pending.promise;
          return load(true);
        },
        dispose() { disposed = true; stop(); listeners.clear(); },
      };
    }
    function useDialogFocus(close) {
      const ref = React.useRef(null);
      React.useEffect(() => {
        const previous = document.activeElement;
        const root = ref.current;
        root?.querySelector('button')?.focus();
        const onKey = event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
          if (event.key === 'Tab') {
            const targets = [...root.querySelectorAll('button:not(:disabled),a[href]')];
            const first = targets[0], last = targets[targets.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        };
        document.addEventListener('keydown', onKey, true);
        return () => { document.removeEventListener('keydown', onKey, true); previous?.focus?.(); };
      }, []);
      return ref;
    }
    function PlanDialog({ source, data, windows, close, refresh }) {
      const ref = useDialogFocus(close);
      return createPortal(h('div', { className: 'dsh-opencode-plan-backdrop', onClick: event => { if (event.target === event.currentTarget) close(); } },
        h('div', { ref, className: 'dsh-opencode-plan-dialog', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'dsh-opencode-plan-title' },
          h('div', { className: 'plan-row' }, h('h2', { id: 'dsh-opencode-plan-title' }, source.label + ' 套餐额度'), h('button', { onClick: close, 'aria-label': '关闭套餐额度' }, '关闭')),
          windows.length ? windows.map(value => h('div', { className: 'dsh-opencode-plan-row', key: value.id },
            h('div', { className: 'plan-row' }, h('strong', null, value.name), h('strong', null, value.remaining === null ? '暂无数据' : percent(value.remaining))),
            value.remaining !== null && h('div', { className: 'dsh-opencode-plan-track', role: 'progressbar', 'aria-label': value.name + '可用比例', 'aria-valuenow': value.remaining, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: { width: value.remaining + '%', background: value.remaining <= 10 ? '#c46d25' : undefined } })),
            h('div', { className: 'plan-muted plan-small' }, '重置时间：' + (Number.isFinite(value.resetsAt) ? stamp(value.resetsAt) : '暂无数据')))) : h('p', { className: 'plan-muted' }, statusText(data)),
          h('p', { className: 'plan-muted plan-small' }, '当前已连接的 ' + source.label + ' 账号 · 百分比表示可用比例'),
          data.quota && h('p', { className: 'plan-muted plan-small' }, '上次更新：' + stamp(data.quota.fetchedAt)),
          data.quota && staleQuota(data.quota, windows) && h('p', { className: 'plan-muted plan-small' }, '当前为上次记录，等待额度刷新。'),
          data.error && h('p', { className: 'plan-notice', role: 'status' }, data.error),
          source.prefix && h('div', { className: 'plan-row', style: { marginTop: 16 } },
            h('span', { className: 'plan-muted plan-small' }, '显示当前套餐返回的全部窗口'),
            h('button', { onClick: refresh, disabled: data.busy || data.status === 'disabled' || data.status === 'disconnected' }, data.busy ? '刷新中…' : '刷新额度')))), document.body);
    }
    function statusText(data) {
      return ({ loading: '额度读取中…', disabled: '连接已停用', disconnected: '需要登录', unavailable: '额度暂不可用', error: '额度读取失败' })[data.status] || '额度暂不可用';
    }
    function staleQuota(quota, windows) {
      return Date.now() - quota.fetchedAt > 600000 || windows.some(value => Number.isFinite(value.resetsAt) && value.resetsAt <= Date.now());
    }
    function PlanPill({ source, store }) {
      const data = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
      const [open, setOpen] = React.useState(false);
      const windows = quotaWindows(source, data.quota);
      const stale = data.quota && staleQuota(data.quota, windows);
      return h(React.Fragment, null,
        h('button', { type: 'button', className: 'dsh-opencode-plan-pill', 'data-composer-stat': 'plan', 'data-auth-plan-usage': 'dsh-opencode-go-auth',
          'aria-label': '查看' + source.label + '套餐额度', 'aria-haspopup': 'dialog', 'aria-expanded': open,
          title: source.label + ' · 当前已连接账号的可用比例 · ' + (data.error || (data.quota ? '上次更新：' + stamp(data.quota.fetchedAt) : statusText(data))), onClick: () => setOpen(true) },
          windows.length ? windows.flatMap((value, i) => [
            i > 0 && h('span', { key: value.id + '-separator', className: 'dsh-opencode-plan-separator', 'aria-hidden': true }, '·'),
            h('span', { key: value.id, 'data-plan-window': value.id,
              title: value.name + ' · 重置时间：' + (Number.isFinite(value.resetsAt) ? stamp(value.resetsAt) : '暂无数据'),
              className: 'dsh-opencode-plan-window' + (value.remaining !== null && value.remaining <= 10 ? ' dsh-opencode-plan-low' : '') },
              value.name + ' ' + (value.remaining === null ? '—' : percent(value.remaining))),
          ]) : h('span', null, source.label + ' · ' + statusText(data)),
          stale && h('span', { className: 'dsh-opencode-plan-window' }, '待更新')),
        open && h(PlanDialog, { source, data, windows, close: () => setOpen(false), refresh: () => { void store.refresh(); } }));
    }
    function ComposerQuota(props) {
      const selection = React.useSyncExternalStore(fn => props.directory.subscribe(fn), () => props.directory.getSnapshot().current);
      return selection && composerProviders.has(selection.provider)
        ? h(PlanPill, { source: composerSource, store: props.planStore }) : null;
    }
        const planStore = createPlanStore(composerSource, (prefix, method) => scope.connection.rpc.call('/api', prefix + '/' + method, {}));
        scope.effect(() => {
          const style = document.createElement('style');
          style.dataset.plugin = 'dsh-opencode-go-auth-composer-quota'; style.textContent = quotaCss;
          document.head.appendChild(style); return () => style.remove();
        });
        scope.effect(() => () => planStore.dispose());
        scope.slots.inject('conversation.composer.dock', () => scope.slots.register({
          name: 'conversation.composer.dock', id: 'dsh-opencode-go-auth-quota', order: 2.5,
          inject: sessionId => ({ directory: scope.modelDirectories.directoryFor(sessionId).store, planStore }),
        }, ComposerQuota));
      });
    }

    return {
      inject: ['slots', 'connection', 'configForms'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style');
          style.dataset.plugin = 'dsh-opencode-go-auth'; style.textContent = css; document.head.appendChild(style);
          return () => style.remove();
        });
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'opencode-go', order: 26, label: () => 'OpenCode / Go',
          inject: () => ({ rpc: (method, payload) => ctx.connection.rpc.call('/api', 'opencode-go-auth/' + method, payload ?? {}), form: ctx.configForms.get('dsh-opencode-go-auth') }),
        }, AuthPage));
        registerComposerQuota(ctx);
      },
    };
  },
});
