# OpenCode Go Auth for DeepSeek Harness Desktop

在 DeepSeek Harness 桌面版连接你的 **OpenCode Go / Go Plus** 订阅：保存 API key、查看用量、同步模型，并勾选会话中显示的模型。

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
| 自动同步模型 | 启动时及默认每 6 小时读取官方公开目录，登录前也可刷新 |
| 筛选模型 | 搜索并勾选会话中显示的模型，自动保存、即时生效，重启后保留 |
| 补齐缺失模型 | 内置目录缺少的模型会从 Zen 目录借用元数据，或按保守设置补齐 |
| 原生对话能力 | 复用 Harness adapter 的流式输出、工具调用、历史 replay 和图片处理 |
| 系统代理 | macOS 上按当前系统 HTTP/HTTPS 代理运行，不修改系统设置 |

## 兼容性与前提

- 当前验证环境：**macOS + DeepSeek Harness Desktop `0.2.1-rc.3` + pi-ai `1.1.0`**，包含授权、额度读取、桌面模型勾选及实际对话。此前也在 Harness `0.2.0-rc.2` / `0.2.1-rc.2` 验证过。
- 依赖声明允许 Harness `0.2.0-rc.2` / `0.2.1-rc.2` / `0.2.1-rc.3`，以及配套的 pi-ai `0.87.1` / `1.1.0`；其他版本仍需验证。
- 需要 **OpenCode Go 或 Go Plus 订阅**及对应 API key，在 [opencode.ai/auth](https://opencode.ai/auth) 订阅后复制。
- 可选：本机安装 opencode CLI 并完成 `/connect`，插件会直接复用 `~/.local/share/opencode/auth.json`。
- 当前只支持 `type: "api"` 形式的登录；OAuth 形式的条目会被忽略。
- macOS PAC / SOCKS-only 系统代理暂不支持。
- 设置页顺序：账号连接 → 订阅额度 → 模型自动同步 → 模型显示；`showModelSync: false` 只隐藏同步卡片，仍可勾选模型。

## 安装到桌面版

以下从 `main` 安装，包含上述 Harness 兼容性修复、授权与模型同步修复，以及模型勾选功能。如需固定版本，可将地址中的 `main` 换成已确认的提交 SHA。

1. 取得 OpenCode Go API key（[opencode.ai/auth](https://opencode.ai/auth) → 订阅 Go / Go Plus → 复制 key）。
2. 在 Harness 左侧打开「插件」→「添加插件」。
3. 输入以下 GitHub 包地址：

   ```text
   github:solstice621/dsh-opencode-go-auth#main
   ```

4. 安装并启用插件，然后完全退出并重新打开 Harness。
5. 打开「设置」→ **OpenCode / Go**，点击「登录 OpenCode Go」，粘贴 API key 并保存；已有本机登录时会自动识别。
6. 在「模型自动同步」中点击「刷新模型」，然后在「模型显示」中搜索并勾选常用模型。
7. 回到会话，在模型选择器的 **OpenCode · Go 额度** 下选择模型。

本地安装可在仓库中运行 `npm pack --ignore-scripts`，再在「添加插件」中填写生成的 `.tgz` 的绝对路径。

本仓库提供可直接运行的 JavaScript 和原生 client entry，不需要执行 `prepare`、`postinstall` 或第三方安装脚本。

## 凭据来源与优先级

`resolve` 在每次请求时执行，轮换 key 不需要重启：

1. 插件配置里的 `apiKey` 字面值（不推荐，会出现在配置文件中）；
2. Harness 凭据存储中 `apiKeyEnv`（默认 `OPENCODE_GO_API_KEY`）指向的值，包含继承的环境变量；
3. 进程环境变量中 `apiKeyEnv` 指向的值，以及 `OPENCODE_AUTH_CONTENT` 中的 API key 条目；
4. 本机 OpenCode CLI 登录文件 `~/.local/share/opencode/auth.json`（跟随 `XDG_DATA_HOME`，也可用 `authFile` 覆盖）。

OpenCode 登录条目优先读取 `opencode-go`，其次为 `opencode`，均要求 `type: "api"`。推荐通过设置页保存 key，避免将其写进插件配置。

本插件在会话中的名称是 **OpenCode · Go 额度**。Harness 内置的 `opencode-go` provider 使用自己的凭据配置；只有配置为相同引用名时才会共用 key。

## 授权界面操作

### 登录与更换

点「登录 OpenCode Go」或「更换 API key」展开输入框。插件会先用该 key 调一次额度接口：

- 成功 → 写入 Harness 凭据存储，并立即刷新额度与模型目录；
- 401 → 提示 key 无效，不保存；
- 403 → 提示需要订阅 Go / Go Plus，不保存。

默认保存到 `OPENCODE_GO_API_KEY`。更换 key 无需重启；若当前凭据来自配置字面值或环境变量，请在对应来源更新。

### 使用已有 key

页面显示 key 标签（形如 `oc_sk_030…b5Cz`，不含完整值）、来源、最近验证时间和订阅状态。来自凭据存储的 key 可以随时更换或移除。

### 查看用量

打开页面时，插件先显示**上次成功读取的用量快照**，同时在后台请求官方接口；返回后数字自动替换。这样打开设置的瞬间就能看到额度，而不是先空着等一次网络往返。

也可点击「刷新额度」手动读取。显示缓存时时间行标注为「上次更新」；刷新失败会保留原有数字并在下方给出原因，而不是把额度清空。快照按 API key 隔离，保存在 `~/.dsh/cache/dsh-opencode-go-auth/<baseUrl 哈希>/quota.json`，只含三个窗口本身，不含 key；「移除授权」会一并删除它（可用 `quotaCachePath` 改位置）。

### 自动同步模型

插件在启动时读取官方 Go 目录，默认每 **6 小时**同步一次；也可在「模型自动同步」中点击「刷新模型」，查看目录来源、模型数量和最近成功时间。同步会更新 Harness 的会话模型列表，无需重启。

官方 Go 模型目录是公开数据：模型发现无需 API key，登录前也可以刷新，目录请求不携带 key。移除授权后仍可保留公开目录；**额度读取与实际调用需要有效的 Go API key**。自定义接口继续按其授权要求读取并隔离缓存。

读取失败时保留最近成功的目录，重启后可从缓存恢复。已有模型优先使用 SDK 元数据，缺失模型会尝试补齐；新协议或未知模型的完整支持仍可能需要升级插件和 Harness。

### 后台定时刷新

Harness 运行且插件连接启用时，默认每 **5 分钟**读取额度，模型目录默认每 **6 小时**同步。这里更新的是**额度与模型数据**，不会拉取、安装或执行新的插件代码。

调度器每分钟检查一次上次尝试时间；启动时没有本账号快照或快照已过期会立即刷新，仍新鲜的成功快照可避免重复启动请求。手动与后台额度读取共享同一个进行中的请求；失败保留最近成功的磁盘快照，并按设定周期重试。停用连接后不发起读取，退出 Harness 或卸载插件会清理计时器并取消请求，没有独立 daemon 或 launchd。运行中更换 key 或卸载后到达的旧响应不会保存或展示。

设置页打开期间每 30 秒读取本地额度快照，因此后台更新会自动显示；轮询失败或旧快照不会覆盖较新的手动读取结果。系统休眠时不会运行计时器，恢复后在下一次分钟检查刷新。

### 移除授权与停用

「移除授权」删除凭据存储中的 key，不影响本机 OpenCode CLI 的登录。「停用此连接」只让 Harness 停用该 provider，保留已保存的 key。

## 选择会话中显示的模型

打开「设置 → OpenCode / Go → 模型显示」，勾选希望在会话模型选择器中保留的模型。每次勾选自动保存并即时更新，无需重启；支持按名称或 ID 搜索、全选、全不选和恢复默认。

| 操作 | 会话中的模型列表 | 之后同步到的新模型 |
| --- | --- | --- |
| 初次使用 / 恢复默认 | 显示完整目录 | 自动显示 |
| 手动勾选 / 全选 | 只显示已选模型；全选勾选当前完整目录 | 需要手动勾选 |
| 全不选 | 隐藏该插件的全部模型 | 需要手动勾选 |

设置页始终保留完整目录，即使全不选也能重新勾选。选择会随 Harness 配置保存并在重启后恢复；暂时不在目录中的已选 ID 也会保留。保存失败时页面会提示并恢复上次已保存的选择。

筛选只影响会话模型列表，不主动切换已有会话或默认模型；已有请求继续使用原来的模型描述。

## 配置项

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 是否在 Harness 中启用该连接 |
| `selectedModelIds` | 未设置 / `null` | 会话中显示的模型 ID；未设置显示全部，`[]` 隐藏全部；实时修改并保存 |
| `apiKey` | — | 直接给出 API key（优先于其他来源，会写入配置文件） |
| `apiKeyEnv` | `OPENCODE_GO_API_KEY` | 保存 / 读取 key 的凭据引用名 |
| `baseUrl` | `https://opencode.ai/zen/go/v1` | OpenCode Zen Go 接口根地址 |
| `authFile` | `~/.local/share/opencode/auth.json` | 本机 OpenCode CLI 登录文件 |
| `showModelSync` | `true` | 显示模型同步卡片；设为 `false` 仍保留模型显示卡片 |
| `modelRefreshMinutes` | `360` | 模型目录自动刷新间隔，范围 5–10080 分钟 |
| `modelCachePath` | `~/.dsh/cache/dsh-opencode-go-auth/<baseUrl-hash>/models.json` | 模型目录缓存文件 |
| `quotaRefreshMinutes` | `5` | 后台额度刷新间隔，范围 1–1440 分钟；修改后重启 Harness |
| `quotaCachePath` | `~/.dsh/cache/dsh-opencode-go-auth/<baseUrl-hash>/quota.json` | 上次成功的用量快照文件；按 API key 校验 |
| `requestTimeoutMs` | `20000` | 额度与目录请求超时，范围 1000–120000 毫秒 |
| `useSystemProxy` | macOS 为 `true` | Host 未显式配置代理时使用系统 HTTP/HTTPS 代理 |

连接开关和模型显示选择即时生效；更换已保存的 key 也无需重启。修改其他插件配置后请重启 Harness。默认模型和额度缓存位置跟随 `DSH_HOME`。

## 网络与权限

- 默认连接访问 `https://opencode.ai`：`/zen/go/v1/usage`（额度）与 `/zen/go/v1/models`（公开模型目录）；模型请求由原生传输层按各模型协议发往 OpenCode 的 Go 端点。自定义 `baseUrl` 会改变请求目标。
- 需要授权的请求通过对应协议的请求头传递 key；公开模型目录请求不携带 key。日志、错误信息和后端返回的展示数据不包含完整 key。
- 读取 `authFile`，通过 Harness 凭据服务保存或移除 key，并读写本地模型目录及用量快照。
- 官方公开目录缓存独立于授权；用量快照和自定义授权目录按 key 的不可逆摘要隔离，不保存 key。

## 常见问题

**设置页没有出现**：确认已安装 `main` 或包含当前 Harness 兼容性修复的包，并在启用后完全退出、重新打开 Harness。

**能看到模型，但提示没有授权**：公开目录无需登录。请在「设置 → OpenCode / Go」保存有效 API key，并确认额度可读取；模型列表或目录缓存不能替代授权。会话中请选择 **OpenCode · Go 额度**。

**新模型没有出现在会话列表**：先在「模型自动同步」中刷新，再到「模型显示」搜索模型并勾选；手动筛选或「全选」后，新模型不会自动加入。需要持续显示所有新模型时点击「恢复默认」。

**更换 key 后仍使用旧授权**：检查凭据来源。插件配置中的 `apiKey` 优先于凭据存储；环境变量等来源也可能影响凭据解析。在对应来源更新后再次刷新额度。

**授权被拒绝或调用受限**：401 表示 key 无效，403 表示需要 Go / Go Plus 订阅；实际调用还受模型权限、额度和限速约束。

**如何停用或卸载**：先在会话选择其他 provider，再在 Harness「插件」页停用或卸载。本机 OpenCode CLI 登录不受影响；若需删除插件保存的 key，请先在设置页「移除授权」。

## 已知限制

- 模型目录接口只返回模型 ID。已知模型沿用官方元数据；内置目录没有的模型会尝试从 Zen 目录借用（并把 baseUrl 换成 Go 路由），仍无法确定的按 chat/completions 与保守的上下文 / 费用设置补齐，可能与该模型的真实协议不符。
- OpenCode 不通过 API key 暴露账号邮箱，也不区分 Go 与 Go Plus，因此页面只显示订阅可用状态与用量窗口。
- 用量百分比由官方按各自窗口的额度计算，插件只做展示。
- Keychain 形式、Windows 和 Linux 桌面环境尚未验证。

## 验证与开发

```sh
npm test
npm pack --ignore-scripts
```

当前实现的验证记录（插件 `0.2.2-local.6`，macOS + Harness `0.2.1-rc.3` + pi-ai `1.1.0`）：

- **99 项测试通过**：覆盖凭据解析、登录校验、公开目录同步、缓存恢复与隔离、后台额度刷新、模型筛选和保存失败恢复、原生传输兼容及清理。
- **原生适配器通过**：模型列表筛选、隐藏模型的精确查询、已准备请求和配置 schema 均通过验证。
- **授权与实际对话通过**：凭据存储、三个额度窗口、流式回复、工具调用和历史回放已验证。
- **桌面模型选择通过**：设置页搜索、勾选及会话模型选择器显示已验证。

## English overview

A native OpenCode Go / Go Plus subscription plugin for DeepSeek Harness Desktop. Save your API key in the Harness credential store, view usage windows, and refresh quota and model data in the background. The official model catalog is public; inference and usage reads require valid Go credentials.

Install from `github:solstice621/dsh-opencode-go-auth#main` for the current compatibility, authorization, sync, and model-selection updates. Search and check models in **Settings → OpenCode / Go → 模型显示**; changes apply immediately and persist across restarts. Reset to defaults to include future models automatically; a custom selection or Select all requires selecting newly discovered models manually. The current integration was verified on macOS with Harness `0.2.1-rc.3` and pi-ai `1.1.0`. This independent community plugin is not an official OpenCode / Anomaly product.

## License

[MIT License](LICENSE)
