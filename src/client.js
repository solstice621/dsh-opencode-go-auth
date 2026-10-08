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
      SYSTEM_PROXY_CHANGED: '系统代理已切换，请重启 Harness 后继续。',
      SYSTEM_PROXY_UNSUPPORTED: '系统代理仅支持静态 HTTP/HTTPS 设置，PAC 或 SOCKS 暂不支持。',
      SYSTEM_PROXY_INVALID: '系统代理设置无效，请检查 macOS 代理。',
      SYSTEM_PROXY_UNAVAILABLE: '无法读取 macOS 系统代理，请重启 Harness 或关闭 useSystemProxy。',
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
      async function loadQuota() {
        if (active.current) { setBusy('quota'); setQuotaError(null); }
        // A cached reading stays on screen while the refresh runs; only a failure
        // with nothing to show falls back to the placeholder text.
        try { const value = await call('quota'); if (active.current) setQuota(value); }
        catch (err) { if (active.current) setQuotaError(errors[err.code] ?? '额度读取失败，请检查网络后重试。'); }
        finally { if (active.current) setBusy(null); }
      }
      // Paint the previous reading first, then refresh it behind the user.
      async function showCachedQuota() {
        try {
          const value = await call('cached');
          if (!active.current || !value?.windows?.length) return false;
          setQuota(value);
          return true;
        } catch { return false; }
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
        if (!state?.models) return;
        // Poll only local display state; network discovery has its own TTL.
        const timer = window.setInterval(() => { sync().catch(() => {}); }, state.models.refreshing ? 1500 : 30000);
        return () => window.clearInterval(timer);
      }, [state?.models?.refreshing]);

      async function operation(method, payload) {
        setBusy(method); setError(null); setNotice(null);
        try {
          const value = await call(method, payload);
          accept(value);
          if (method === 'refresh') setNotice('已重新读取订阅额度。');
          if (method === 'login') { setNotice('已保存 API key，OpenCode Go 授权可用。'); setEditing(false); setDraft(''); if (value.windows) setQuota({ windows: value.windows, fetchedAt: value.fetchedAt }); }
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
            h('button', { className: !state?.connected ? 'primary' : '', disabled: locked || !state?.credential?.writable, onClick: () => { setEditing(value => !value); setError(null); setNotice(null); } },
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
            : h('p', { className: 'muted', style: { marginTop: 14 } }, busy === 'quota' ? '正在读取 OpenCode Go 额度…' : quotaError ?? '连接账号后可读取额度。'),
          quota?.windows?.length && quotaError && h('p', { className: 'small muted', style: { marginTop: 10 }, role: 'alert' }, quotaError),
          quota && h('p', { className: 'small muted', style: { marginTop: 14 } },
            `${quota.cached ? '上次更新' : '更新于'} ${date(quota.fetchedAt)} · 由 OpenCode Go 订阅返回`,
            quota.cached && busy === 'quota' ? ' · 正在刷新…' : quota.cached ? ' · 刷新未完成' : ''),
        ),
        h('div', { className: 'card' },
          h('div', { className: 'row' }, h('h3', null, '模型自动同步'), h('button', { className: 'text-button', disabled: locked || !enabled || !state?.connected || state?.models?.refreshing, onClick: () => operation('models') }, busy === 'models' || state?.models?.refreshing ? '同步中…' : '刷新模型')),
          h('p', { className: 'muted small', style: { marginTop: 14 } }, !enabled ? '连接已停用，自动同步已暂停。' : `启动时同步，每 ${state?.models?.intervalMinutes ?? 360} 分钟自动刷新；更换 API key 后重新同步。`),
          state?.models && h('p', { className: 'small muted', style: { marginTop: 8 } }, `当前 ${state.models.totalModels} 个模型 · ${state.models.source === 'opencode' ? 'OpenCode Go 官方目录' : state.models.source === 'cache' ? '最近成功的缓存' : '内置备用目录'} · 最近同步：${date(state.models.lastSyncAt)}`),
          state?.models?.error && h('p', { className: 'small muted' }, errors[state.models.error] ?? '同步未完成，当前模型目录仍可使用。'),
          state?.models?.cacheSaved === false && h('p', { className: 'small muted' }, '模型目录已更新，但缓存未保存；重启后会重新同步。'),
          h('p', { className: 'small muted', style: { marginTop: 8 } }, '目录接口只返回模型 ID；已知模型沿用官方元数据，新增模型改用保守的上下文与协议设置。'),
        ),
        h('p', { className: 'footer' }, '使用时，在会话模型选择器中选择「OpenCode · Go 额度」。系统代理切换后需要重启 Harness。'));
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
      },
    };
  },
});
