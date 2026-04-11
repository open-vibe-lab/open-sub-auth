# open-sub-auth 任务记录

## MVP 已完成任务 (v0.1.0)

### Step 1: 项目初始化 ✅

- git init、package.json、tsconfig.json、tsup.config.ts、biome.json、vitest.config.ts
- MIT LICENSE、.gitignore
- 安装依赖：cross-keychain（运行时）、typescript、tsup、vitest、@biomejs/biome（开发）

### Step 2: 基础类型和工具 ✅

- `src/types.ts` — 所有共享接口和类型（TokenSet、Provider、ProviderConfig、TokenStore、LoginOptions 等）
- `src/errors.ts` — 8 个自定义错误类（AuthenticationError、TokenExpiredError、ProviderNotFoundError 等）
- `src/core/crypto.ts` — PKCE code_verifier/code_challenge 生成 + state 随机生成（使用 node:crypto）
- `src/core/browser.ts` — 跨平台浏览器打开工具（macOS/Linux/Windows，使用 execFile 避免 shell 注入）
- 7 个单元测试通过

### Step 3: OAuth PKCE 流程引擎 ✅

- `src/core/callback-server.ts` — 本地 HTTP 回调服务器（自动模式），提取 code + state，返回成功 HTML，超时处理
- `src/core/manual-code-input.ts` — 手动 code#state 粘贴解析（headless/CI 模式），支持纯 code 和 code#state 两种格式
- `src/core/oauth-pkce.ts` — 完整 PKCE 流程编排：buildAuthorizationUrl、exchangeCode、refreshAccessToken、executePKCEFlow
- 13 个单元测试通过（回调服务器、code#state 解析、URL 构建等）

### Step 4: Claude Provider ✅

- `src/providers/registry.ts` — Provider 注册表（Map + factory 模式）
- `src/providers/claude.ts` — Claude Pro/Max 完整实现
  - 授权端点: `https://claude.ai/oauth/authorize`
  - Token 端点: `https://console.anthropic.com/v1/oauth/token`
  - Client ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
  - 两种回调模式：自动（localhost）+ 手动（console.anthropic.com/oauth/code/callback）
  - Auth Headers: `x-api-key`（非 Bearer）+ `anthropic-version: 2023-06-01` + `anthropic-beta: oauth-2025-04-20`
  - Account ID: refresh token SHA-256 哈希前 16 位
- 12 个单元测试通过

### Step 5: 存储层 ✅

- `src/storage/keychain-store.ts` — OS Keychain 存储（cross-keychain），service="open-sub-auth"，key="{provider}::{accountId}"，维护 **index** 条目支持枚举
- `src/storage/file-store.ts` — 加密文件存储（AES-256-GCM + PBKDF2），路径 ~/.open-sub-auth/credentials.json，权限 0600
- `src/storage/store.ts` — 工厂函数 createTokenStore()，优先 keychain 回退 file store
- 9 个单元测试通过（CRUD、加密验证、多 provider 隔离等）

### Step 6: Token Manager ✅

- `src/token/jwt.ts` — JWT payload 解码（不验证签名，用于 OpenAI id_token）
- `src/token/manager.ts` — 核心 TokenManager 类
  - login(): 交互式登录 + 存储
  - getToken(): 获取有效 token（过期前 5 分钟自动刷新）
  - getAuthHeaders(): 获取 provider 特定的认证 headers
  - logout(): 删除凭证
  - status(): 查看所有凭证状态
  - 并发刷新 mutex（per provider+account）
- 11 个单元测试通过

### Step 7: OpenAI Codex Provider ✅

- `src/providers/openai-codex.ts` — OpenAI ChatGPT Plus/Pro 完整实现
  - 授权端点: `https://auth.openai.com/oauth/authorize`
  - Token 端点: `https://auth.openai.com/oauth/token`
  - Client ID: `app_EMoamEEZ73f0CkXaXp7hrann`
  - Redirect: `http://localhost:1455/auth/callback`
  - Scopes: openid, profile, email, offline_access
  - JWT id_token 解析获取 email 和 sub
  - importFromCodexCli(): 从 ~/.codex/auth.json 导入已有 token
- 14 个单元测试通过

### Step 8: CLI ✅

- `src/cli/index.ts` — CLI 入口，使用 node:util.parseArgs（零依赖）
- `src/cli/ui.ts` — 终端交互（promptSelect、printError、printSuccess）
- 5 个命令：
  - `login [provider]` — 交互式 OAuth 登录，支持 --manual 标志
  - `logout [provider]` — 删除存储的 token
  - `status` — 表格显示所有凭证状态
  - `token [provider]` — 输出原始 access token 到 stdout（用于管道）
  - `providers` — 列出可用 provider

### Step 9: 主入口 + 示例 ✅

- `src/index.ts` — 统一导出所有公开 API（类型、错误、TokenManager、Storage、Providers、Core 工具）
- `examples/basic-claude.ts` — Claude 登录 + API 调用示例
- `examples/basic-openai.ts` — OpenAI Codex 登录 + API 调用示例 + importFromCodexCli 示例
- `examples/multi-account.ts` — 多账号管理示例

### Step 10: README + 最终验证 ✅

- `README.md` — 完整文档（安装、CLI 使用、Library API、架构、ToS 风险声明）
- 最终验证全部通过：
  - TypeScript 类型检查: PASS
  - 66 个测试（6 个测试文件）: ALL PASS
  - 构建（ESM + CJS + .d.ts + CLI）: PASS

---

## 待完成任务 (Roadmap)

### v0.2.0 — 扩展 Provider + 增强功能

#### Task R1: GitHub Copilot Provider (Device Code Flow)

- **优先级**: 高
- **描述**: 实现 GitHub Copilot 认证支持
- **工作内容**:
  - `src/core/oauth-device.ts` — Device Code 流程引擎
    - `requestDeviceCode()`: POST https://github.com/login/device/code
    - `pollForToken()`: 轮询 token 端点，处理 authorization_pending / slow_down / expired_token
  - `src/providers/github-copilot.ts` — GitHub Copilot provider
    - Device Code Flow（非 PKCE）
    - 两阶段 token 交换：GitHub OAuth token → Copilot session token（GET https://api.github.com/copilot_internal/v2/token）
    - Session token 内存缓存 + 过期刷新
    - Account ID 通过 GitHub User API 获取
  - 对应单元测试
- **风险**: 无公开 API 端点，完全依赖逆向工程，稳定性未知

#### Task R2: 代理 (Proxy) 支持

- **优先级**: 高
- **描述**: 国内用户需要代理配置
- **工作内容**:
  - 支持 `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` 环境变量
  - 在所有 `fetch()` 调用中注入代理配置
  - 可能需要引入 `undici` 或 `node-fetch` 的 ProxyAgent
  - CLI 增加 `--proxy` 选项

#### Task R3: 跨平台存储完善

- **优先级**: 中
- **描述**: 完善存储层的跨平台兼容性
- **工作内容**:
  - 测试 Linux 环境下 cross-keychain 的 libsecret 支持
  - 测试 Windows 环境下 Credential Manager 支持
  - 文件存储加密 key 派生策略改进（当前基于 hostname+username，考虑更安全方案）
  - 添加 `--store file` / `--store keychain` CLI 选项强制使用指定存储

#### Task R4: Token 导入/导出

- **优先级**: 中
- **描述**: 支持从其他工具导入和导出 token
- **工作内容**:
  - 从 Claude Code 凭证导入（~/.claude/.credentials.json）
  - 从 GitHub Copilot CLI 导入（~/.copilot/config.json）
  - `open-sub-auth export` CLI 命令（输出 JSON 到 stdout）
  - `open-sub-auth import` CLI 命令（从 JSON stdin 导入）
  - 环境变量支持：`CLAUDE_CODE_OAUTH_TOKEN`、`COPILOT_GITHUB_TOKEN`

### v0.3.0 — 可选高级 Client API

#### Task R5: Claude Client 封装

- **优先级**: 低
- **描述**: 提供 `@open-sub-auth/claude-client` 可选包
- **工作内容**:
  - 封装 `client.messages.create()` 等高级 API
  - 自动注入认证 headers
  - 支持流式响应
  - 基于 getAuthHeaders() 构建，不替代底层 API

#### Task R6: OpenAI Codex Client 封装

- **优先级**: 低
- **描述**: 提供 `@open-sub-auth/openai-client` 可选包
- **工作内容**:
  - 封装 chatgpt.com/backend-api/codex/responses 的请求/响应格式
  - SSE 流式响应解析
  - 模型列表查询

#### Task R7: 统一 OpenAI-Compatible Facade（可选）

- **优先级**: 低
- **描述**: PRD 中提到的可选扩展
- **工作内容**:
  - 将各 provider 的响应转换为 OpenAI-compatible 格式
  - 作为独立包提供，不影响核心库

### v1.0.0 — 生产就绪

#### Task R8: CI/CD 流水线

- **优先级**: 高
- **描述**: GitHub Actions 自动化
- **工作内容**:
  - PR 自动测试（lint + typecheck + test）
  - 自动发布到 npm（基于 git tag）
  - 多平台测试（macOS, Linux, Windows）
  - Dependabot 依赖更新

#### Task R9: 更多 Provider 扩展

- **优先级**: 中
- **描述**: 支持更多 AI 提供商
- **候选**:
  - Gemini（Google OAuth）
  - Cursor（如果有 OAuth 接口）
  - 其他支持订阅 OAuth 的 AI 服务
- **工作内容**: 每个 provider 需实现 Provider 接口 + 对应测试

#### Task R10: 完善文档和社区

- **优先级**: 中
- **描述**: 提升项目成熟度
- **工作内容**:
  - API 文档（TypeDoc 或 手写）
  - 贡献指南 CONTRIBUTING.md
  - CHANGELOG.md
  - 更多使用示例（与 Vercel AI SDK 集成、与 LangChain 集成等）
  - Logo 设计

#### Task R11: 安全审计

- **优先级**: 高
- **描述**: 安全性强化
- **工作内容**:
  - Token 从不出现在日志/错误消息中（审计所有 Error 构造）
  - 文件存储加密方案安全评审
  - PKCE 实现安全评审
  - 依赖安全扫描

---

## 技术调研备忘

### 各 Provider OAuth 端点速查

| Provider       | 授权端点                                | Token 端点                             | Client ID                              |
| -------------- | --------------------------------------- | -------------------------------------- | -------------------------------------- |
| Claude         | `claude.ai/oauth/authorize`             | `console.anthropic.com/v1/oauth/token` | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` |
| OpenAI Codex   | `auth.openai.com/oauth/authorize`       | `auth.openai.com/oauth/token`          | `app_EMoamEEZ73f0CkXaXp7hrann`         |
| GitHub Copilot | `github.com/login/device` (Device Code) | `github.com/login/oauth/access_token`  | `Iv1.b507a08c87ecfe98`                 |

### 各 Provider API 端点及认证方式

| Provider       | API 端点                                  | 认证 Header                             | 额外 Header                        |
| -------------- | ----------------------------------------- | --------------------------------------- | ---------------------------------- |
| Claude         | `api.anthropic.com/v1/messages`           | `x-api-key: <token>`                    | `anthropic-beta: oauth-2025-04-20` |
| OpenAI Codex   | `chatgpt.com/backend-api/codex/responses` | `Authorization: Bearer <token>`         | —                                  |
| GitHub Copilot | `api.githubcopilot.com` (逆向)            | `Authorization: Bearer <session_token>` | 需两阶段 token 交换                |

### 参考实现

| 项目                                                                                   | 语言 | 描述                            |
| -------------------------------------------------------------------------------------- | ---- | ------------------------------- |
| [anthropic-auth](https://github.com/querymt/anthropic-auth)                            | Rust | Claude OAuth，支持自动/手动模式 |
| [opencode-anthropic-auth](https://github.com/ex-machina-co/opencode-anthropic-auth)    | TS   | OpenCode 插件，Claude OAuth     |
| [openai-oauth](https://github.com/EvanZhouDev/openai-oauth)                            | TS   | OpenAI OAuth + localhost 代理   |
| [opencode-openai-codex-auth](https://github.com/numman-ali/opencode-openai-codex-auth) | TS   | OpenCode 插件，Codex OAuth      |
