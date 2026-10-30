# Changelog

## Unreleased

- Remove host SDK version allowlists while retaining all peer dependencies.
- Check required host service APIs before starting proxy, account, quota, or model-sync work.
- Keep tested environments documented separately from activation requirements.

## 0.2.2-local.6 (local enhancement, not published)

- Discover the official public Go catalog without requiring or sending an API key; keep authenticated usage and inference separate.
- Cache public catalog snapshots across logins and allow manual model refresh before login.
- Add Gemini 4 Argon with the official Google Go endpoint, text/image input, 1M context, 64K synchronous output and low/medium/high thinking.
- Reuse the native Zen Google transport and its OpenCode session headers; translate Argon's thinking levels for older SDKs without changing the model id.

## 0.2.2-local.5 (local enhancement, not published)

- Add a searchable model checkbox list with automatic saving, select all/none, and restore defaults.
- Paint checkbox changes immediately while saving and roll back the display if persistence fails.
- Persist `selectedModelIds` in Harness settings and update the native conversation picker immediately; explicit selections also apply to future catalog refreshes.
- Keep the full settings catalog and exact model resolution available when picker entries are hidden.

## 0.2.1

- Add `showModelSync` (default `true`); set it to `false` to drop the model-catalog card, leaving account and usage on the page. The preference is reported through `state` rather than read from raw configuration.
- Document the settings-page order: account, usage, then the model catalog.

## 0.2.0

- Show the last successful usage reading immediately when the settings page opens, then refresh it behind the user instead of leaving the card empty for the round trip.
- Persist a sanitized, key-scoped usage snapshot; another key's snapshot is never reused, and 移除授权 deletes it.
- Label a restored reading as `上次更新` and keep it on screen when a refresh fails, with the failure reported beside it rather than replacing the numbers.
- Add `quotaCachePath` and a `cached` RPC that answers from disk without a network call.

## 0.1.0

首个版本，对齐 `dsh-openai-auth` 的结构与交互，改为面向 OpenCode Go 订阅。

- 原生设置页：key 标签、来源、订阅状态、5 小时 / 每周 / 每月三个用量窗口、模型同步状态。
- 凭据来源：插件配置、Harness 凭据存储（默认引用 `OPENCODE_GO_API_KEY`）、环境变量、本机 OpenCode CLI `auth.json`。
- 登录先验证后保存：401（key 无效）与 403（未订阅 Go）都不会写入凭据存储。
- 注册 provider `opencode-go-subscription`，复用 Harness 的 pi-ai 传输、历史 replay、工具调用与图片处理。
- 模型目录同步：内置 Go 目录 → Zen 目录借用元数据 → 保守兜底，三级解析，并按 API key 隔离缓存。
- macOS 系统代理桥接，静态 HTTP/HTTPS 代理；PAC / SOCKS-only 明确拒绝。
