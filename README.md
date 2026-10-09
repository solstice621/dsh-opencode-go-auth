# OpenCode Go Auth for DeepSeek Harness Desktop

在 DeepSeek Harness 桌面版连接你的 **OpenCode Go / Go Plus** 订阅：用一个 API key 使用订阅额度，并在原生设置页查看订阅状态、用量窗口和模型目录。

**原生 Harness bundle + 后端 provider + 客户端设置页** · MIT · 无安装脚本 · 无需修改 App 安装包或 asar

这是独立社区插件，与 OpenCode / Anomaly 官方无关联。插件不增加额度，也不改变 OpenCode 的账号权限或限速规则。

## 功能

| 功能 | 使用方式 |
| --- | --- |
| API key 登录 | 在设置页粘贴 `oc_sk_…`，插件先验证再保存 |
| 凭据托管 | key 存入 Harness 凭据存储的 `OPENCODE_GO_API_KEY`，配置文件里不出现明文 |
| 复用已有登录 | 识别本机 OpenCode CLI 的 `auth.json`，无需重复粘贴 |
| 查看用量 | 显示官方返回的 5 小时 / 每周 / 每月三个额度窗口、剩余比例与重置时间 |
| 秒开额度 | 打开页面先显示上次读取的用量，再在后台刷新 |
| 后台刷新额度 | Harness 运行且连接启用时默认每 5 分钟刷新用量，不依赖设置页 |
| 订阅校验 | 分别识别 key 无效（401）与未订阅 Go（403），并给出对应提示 |
| 管理连接 | 启用或停用 Harness 中的 OpenCode Go 连接，并保存选择 |
| 隐藏 key | 录屏、演示或截图前隐藏 key 标签 |
| 自动同步模型 | 启动时及默认每 6 小时读取官方 Go 目录；设置页可手动刷新 |
| 补齐缺失模型 | 内置目录缺少的模型会从 Zen 目录借用元数据，或按保守设置补齐 |
| 原生对话能力 | 复用 Harness adapter 的流式输出、工具调用、历史 replay 和图片处理 |
| 系统代理 | macOS 上按当前系统 HTTP/HTTPS 代理运行，不修改系统设置 |

## 兼容性与前提

- 已验证：**macOS + DeepSeek Harness Desktop `0.2.0-rc.2`**。
- 插件当前绑定 Harness `0.2.0-rc.2` 的接口版本；其他 Harness 版本尚未验证。
- 需要 **OpenCode Go 或 Go Plus 订阅**及对应 API key，在 [opencode.ai/auth](https://opencode.ai/auth) 订阅后复制。
- 可选：本机安装 opencode CLI 并完成 `/connect`，插件会直接复用 `~/.local/share/opencode/auth.json`。
- 当前只支持 `type: "api"` 形式的登录；OAuth 形式的条目会被忽略。
- macOS PAC / SOCKS-only 系统代理暂不支持。

## 安装到桌面版

1. 取得 OpenCode Go API key（[opencode.ai/auth](https://opencode.ai/auth) → 订阅 Go / Go Plus → 复制 key）。
2. 在 Harness 左侧打开「插件」→「添加插件」。
3. 输入以下 GitHub 包地址，或从 Releases 下载 `.tgz` 后填写其绝对路径：

   ```text
   github:solstice621/dsh-opencode-go-auth#v0.2.1
   ```

4. 安装并启用插件，然后刷新页面或完全退出并重新打开 Harness。
5. 打开左下角「更多」→「设置」→ **OpenCode / Go**，粘贴 API key 并保存。
6. 在会话模型选择器中选择 **OpenCode · Go 额度** 下的模型，例如 **Kimi K3**。

本仓库提供可直接运行的 JavaScript 和原生 client entry，不需要执行 `prepare`、`postinstall` 或第三方安装脚本。

## 凭据来源与优先级

`resolve` 在每次请求时执行，轮换 key 不需要重启：

1. 插件配置里的 `apiKey` 字面值（不推荐，会出现在配置文件中）；
2. Harness 凭据存储中 `apiKeyEnv`（默认 `OPENCODE_GO_API_KEY`）指向的值，包含继承的环境变量；
3. 进程环境变量 `OPENCODE_GO_API_KEY`，以及 `OPENCODE_AUTH_CONTENT`；
4. 本机 OpenCode CLI 登录文件 `~/.local/share/opencode/auth.json`（可用 `authFile` 覆盖）。

> 默认引用名与 profile 里 `@deepseek-ai/dsh-llm-pi-ai` 的 `providers.opencode-go.apiKeyEnv` 一致，所以在设置页登录后，Harness 内置的 `opencode-go` provider 也会立刻可用。

## 授权界面操作

### 使用已有 key

页面显示 key 标签（形如 `oc_sk_030…b5Cz`，不含完整值）、来源、最近验证时间和订阅状态。来自凭据存储的 key 可以随时更换或移除。

### 查看用量

打开页面时，插件先显示**上次成功读取的用量快照**，同时在后台请求官方接口；返回后数字自动替换。这样打开设置的瞬间就能看到额度，而不是先空着等一次网络往返。

也可点击「刷新额度」手动读取。显示缓存时时间行标注为「上次更新」；刷新失败会保留原有数字并在下方给出原因，而不是把额度清空。快照按 API key 隔离，保存在 `~/.dsh/cache/dsh-opencode-go-auth/<baseUrl 哈希>/quota.json`，只含三个窗口本身，不含 key；「移除授权」会一并删除它（可用 `quotaCachePath` 改位置）。

### 后台自动更新数据

本地开发版本 `0.2.2-local.1` 增加进程内的额度调度：Harness 运行且插件连接启用时，默认每 **5 分钟**读取额度，模型目录仍默认每 **6 小时**同步。这里更新的是**额度与模型数据**，不会拉取、安装或执行新的插件代码。

调度器每分钟检查一次上次尝试时间；启动时没有本账号快照或快照已过期会立即刷新，仍新鲜的成功快照可避免重复启动请求。手动与后台额度读取共享同一个进行中的请求；失败保留最近成功的磁盘快照，并按设定周期重试。停用连接后不发起读取，退出 Harness 或卸载插件会清理计时器并取消请求，没有独立 daemon 或 launchd。运行中更换 key 或卸载后到达的旧响应不会保存或展示。

设置页打开期间每 30 秒读取本地额度快照，因此后台更新会自动显示；轮询失败或旧快照不会覆盖较新的手动读取结果。系统休眠时不会运行计时器，恢复后在下一次分钟检查刷新。

### 登录与更换

点「登录 OpenCode Go」或「更换 API key」展开输入框。插件会先用该 key 调一次额度接口：

- 成功 → 写入凭据存储，并立即刷新额度与模型目录；
- 401 → 提示 key 无效，**不会**保存；
- 403 → 提示需要订阅 Go / Go Plus，**不会**保存。

### 移除授权与停用

「移除授权」删除凭据存储中的 key，不影响本机 OpenCode CLI 的登录。「停用此连接」只让 Harness 停用该 provider，保留已保存的 key。

## 配置项

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 是否在 Harness 中启用该连接 |
| `apiKey` | — | 直接给出 API key（优先于其他来源，会写入配置文件） |
| `apiKeyEnv` | `OPENCODE_GO_API_KEY` | 保存 / 读取 key 的凭据引用名 |
| `baseUrl` | `https://opencode.ai/zen/go/v1` | OpenCode Zen Go 接口根地址 |
| `authFile` | `~/.local/share/opencode/auth.json` | 本机 OpenCode CLI 登录文件 |
| `showModelSync` | `true` | 是否在设置页显示模型目录卡片（账户与用量始终显示） |
| `modelRefreshMinutes` | `360` | 模型目录自动刷新间隔 |
| `modelCachePath` | `~/.dsh/cache/dsh-opencode-go-auth` | 模型目录缓存位置 |
| `quotaRefreshMinutes` | `5` | 后台额度刷新间隔，范围 1–1440 分钟；修改后重启 Harness |
| `quotaCachePath` | `~/.dsh/cache/dsh-opencode-go-auth` | 上次用量快照位置 |
| `requestTimeoutMs` | `20000` | 单次请求超时 |
| `useSystemProxy` | macOS 为 `true` | Host 未显式配置代理时使用系统 HTTP/HTTPS 代理 |

## 网络与权限

- 只访问 `https://opencode.ai`：`/zen/go/v1/usage`（额度）与 `/zen/go/v1/models`（模型目录）；模型请求由 Harness 传输层按 pi-ai 的 `opencode-go` 协议发往 `/zen/go/...`。
- API key 只出现在 `Authorization: Bearer` 头中；不写入日志，不返回给客户端，错误信息中也不包含。
- 读取 `authFile` 与模型缓存，写入凭据存储和模型缓存。

## 已知限制

- 模型目录接口只返回模型 ID。已知模型沿用官方元数据；内置目录没有的模型会尝试从 Zen 目录借用（并把 baseUrl 换成 Go 路由），仍无法确定的按 chat/completions 与保守的上下文 / 费用设置补齐，可能与该模型的真实协议不符。
- OpenCode 不通过 API key 暴露账号邮箱，也不区分 Go 与 Go Plus，因此页面只显示订阅可用状态与用量窗口。
- 用量百分比由官方按各自窗口的额度计算，插件只做展示。
- Keychain 形式、Windows 和 Linux 桌面环境尚未验证。

## License

MIT
