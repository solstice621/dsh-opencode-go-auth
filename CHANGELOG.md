# Changelog

## 0.1.0

首个版本，对齐 `dsh-openai-auth` 的结构与交互，改为面向 OpenCode Go 订阅。

- 原生设置页：key 标签、来源、订阅状态、5 小时 / 每周 / 每月三个用量窗口、模型同步状态。
- 凭据来源：插件配置、Harness 凭据存储（默认引用 `OPENCODE_GO_API_KEY`）、环境变量、本机 OpenCode CLI `auth.json`。
- 登录先验证后保存：401（key 无效）与 403（未订阅 Go）都不会写入凭据存储。
- 注册 provider `opencode-go-subscription`，复用 Harness 的 pi-ai 传输、历史 replay、工具调用与图片处理。
- 模型目录同步：内置 Go 目录 → Zen 目录借用元数据 → 保守兜底，三级解析，并按 API key 隔离缓存。
- macOS 系统代理桥接，静态 HTTP/HTTPS 代理；PAC / SOCKS-only 明确拒绝。
