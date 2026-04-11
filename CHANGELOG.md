# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `--store auto|keychain|file` CLI option to force storage backend selection
- `createTokenStore(storeType)` API — `'keychain'` throws `AuthenticationError` when unavailable, `'file'` bypasses keychain probe
- `StoreType` type exported from the public API
- `open-sub-auth export` command — outputs all stored credentials as JSON to stdout
- `open-sub-auth import` command — reads a `StoredCredential[]` JSON array from stdin
- `importClaudeTokenFromEnv()` — reads `CLAUDE_CODE_OAUTH_TOKEN` env var and returns a ready-to-use `TokenSet`
- `importCopilotTokenFromEnv()` — reads `COPILOT_GITHUB_TOKEN` (GitHub OAuth token), stores it as the refresh token, and forces immediate Copilot session token exchange on first use

### Security
- HTTP error response bodies are no longer propagated in thrown error messages (prevents token/credential leakage via log aggregation)

## [0.1.0] — Initial Release

### Added
- **Claude Pro/Max provider** — PKCE Authorization Code flow via `console.anthropic.com` manual callback
- **OpenAI Codex provider** — PKCE Authorization Code flow with local callback server on port 1455; `importFromCodexCli()` to import from `~/.codex/auth.json`
- **GitHub Copilot provider** — Device Code Flow (RFC 8628), two-stage token exchange: GitHub OAuth token → Copilot session token
- **HTTP proxy support** — `initProxy()` / `--proxy <url>` option wires `node:undici` `EnvHttpProxyAgent` for all `fetch()` calls; respects `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY`
- **OS keychain storage** (`KeychainStore`) — backed by `cross-keychain`; supports macOS Keychain, Linux libsecret, Windows Credential Manager
- **Encrypted file storage** (`FileStore`) — AES-256-GCM + PBKDF2, stored at `~/.open-sub-auth/credentials.json` (mode 0600)
- **`TokenManager`** — `login()`, `getToken()` (auto-refresh 5 min before expiry with per-account mutex), `getAuthHeaders()`, `logout()`, `status()`
- **CLI** — `login`, `logout`, `status`, `token`, `providers` commands; `--manual` flag for headless/CI
- **GitHub Actions CI** — lint + typecheck + test matrix (ubuntu/macOS/Windows × Node 18/20/22) + build verification; release workflow for `v*` tags with `npm publish --access public`
- **Dependabot** — weekly updates for npm and GitHub Actions ecosystems
- 127 unit tests across 12 test files

[Unreleased]: https://github.com/open-vibe-lab/open-sub-auth/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/open-vibe-lab/open-sub-auth/releases/tag/v0.1.0
