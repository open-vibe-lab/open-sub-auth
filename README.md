# open-sub-auth

**Open Source Subscription OAuth Authentication Library for AI Providers**

> Login once with your subscription. Call native APIs directly.

A lightweight, open-source TypeScript library that handles OAuth login for AI subscription plans (Claude Pro/Max, ChatGPT Plus/Pro) and provides authenticated headers to call each provider's native API directly.

## Features

- **OAuth 2.0 + PKCE** — Secure authorization code flow with PKCE for Claude and OpenAI Codex
- **Automatic & Manual modes** — Browser-based auto-callback or manual code paste for headless/CI environments
- **Secure token storage** — OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) with encrypted file fallback
- **Auto token refresh** — Transparent refresh with concurrency-safe mutex
- **Multi-provider, multi-account** — Manage credentials for multiple providers and accounts
- **Minimal dependencies** — Only 1 runtime dependency (`cross-keychain`)
- **Full TypeScript** — Complete type safety throughout
- **CLI included** — `open-sub-auth login claude` and you're done

## Supported Providers

| Provider                        | Auth Method | Status  |
| ------------------------------- | ----------- | ------- |
| Claude Pro/Max                  | OAuth PKCE  | MVP     |
| OpenAI ChatGPT Plus/Pro (Codex) | OAuth PKCE  | MVP     |
| GitHub Copilot                  | Device Code | MVP     |

| Runtime          | Status                                                          |
| ---------------- | --------------------------------------------------------------- |
| Node.js (CLI)    | MVP                                                             |
| Chrome extension | MVP — see [`examples/chrome-extension-demo`](./examples/chrome-extension-demo) |
| Other browsers / Workers / Deno | bring your own adapter — see [`docs/writing-an-adapter.md`](./docs/writing-an-adapter.md) |

## Installation

```bash
npm install @open-vibe-lab/open-sub-auth
```

## Quick Start

### CLI

```bash
# Login to Claude
npx open-sub-auth login claude

# Login to OpenAI Codex
npx open-sub-auth login openai-codex

# Check status
npx open-sub-auth status

# Get a token for piping
npx open-sub-auth token claude | pbcopy

# Headless/CI mode (manual code paste)
npx open-sub-auth login claude --manual
```

### Library

```typescript
import { TokenManager, createTokenStore } from "@open-vibe-lab/open-sub-auth";

// Initialize
const store = await createTokenStore();
const manager = new TokenManager(store);

// Login (opens browser)
await manager.login("claude");

// Get authenticated headers for API calls
const headers = await manager.getAuthHeaders("claude");

// Call the API directly with fetch
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers, // Includes Authorization: Bearer + anthropic-beta header automatically
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello!" }],
  }),
});
```

### OpenAI Codex

```typescript
await manager.login("openai-codex");
const headers = await manager.getAuthHeaders("openai-codex");

const response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
  method: "POST",
  headers, // Includes Authorization: Bearer automatically
  body: JSON.stringify({
    model: "gpt-5-codex-mini",
    input: [{ role: "user", type: "message", content: "Hello!" }],
    stream: false,
  }),
});
```

### Import Existing Codex CLI Tokens

If you've already authenticated with OpenAI's Codex CLI, you can import those tokens:

```typescript
import { importFromCodexCli } from "@open-vibe-lab/open-sub-auth";

const tokens = importFromCodexCli(); // Reads ~/.codex/auth.json
if (tokens) {
  console.log("Found existing tokens!");
}
```

## API Reference

### `TokenManager`

The central class for managing OAuth tokens.

```typescript
const manager = new TokenManager(store: TokenStore);

// Interactive login
await manager.login(provider: string, options?: LoginOptions): Promise<StoredCredential>;

// Get a valid access token (auto-refreshes if needed)
await manager.getToken(provider: string, accountId?: string): Promise<string>;

// Get authenticated headers for API calls
await manager.getAuthHeaders(provider: string, accountId?: string): Promise<AuthHeaders>;

// Remove stored tokens
await manager.logout(provider: string, accountId?: string): Promise<void>;

// Check status of all credentials
await manager.status(): Promise<CredentialStatus[]>;
```

### `createTokenStore()`

Creates a token store with OS keychain preferred, encrypted file fallback.

```typescript
const store = await createTokenStore(preferKeychain?: boolean): Promise<TokenStore>;
```

### `LoginOptions`

```typescript
interface LoginOptions {
  port?: number; // Override callback server port
  timeout?: number; // Login timeout in ms (default: 120000)
  manual?: boolean; // Use manual code paste mode
}
```

## Architecture

```
open-sub-auth/
├── src/
│   ├── core/                    # 100% runtime-agnostic
│   │   ├── abstractions/        # BrowserLauncher / CallbackReceiver / CodePrompter
│   │   ├── providers/           # Pure provider classes (config + protocol)
│   │   ├── crypto.ts            # Web Crypto API (works in Node + browser + Worker)
│   │   ├── jwt.ts
│   │   ├── pkce-flow.ts         # OAuth PKCE flow, takes adapters as a param
│   │   ├── device-flow.ts       # OAuth Device Code flow
│   │   └── token-manager.ts
│   └── adapters/
│       ├── node/                # Node.js implementation
│       │   ├── browser-launcher.ts    # spawns `open` / `xdg-open` / `cmd start`
│       │   ├── callback-receiver.ts   # local HTTP server on 127.0.0.1
│       │   ├── code-prompter.ts       # readline / stdin
│       │   ├── storage/               # OS keychain + encrypted file
│       │   ├── env-import/            # process.env / fs token importers
│       │   └── cli/                   # CLI tool
│       └── chrome-extension/    # (future — see docs/writing-an-adapter.md)
```

### Three import surfaces

| Entry | Use when | Pulls in Node deps? |
|---|---|---|
| `@open-vibe-lab/open-sub-auth`                   | Node.js script / CLI consumer (default) | yes — auto-registers Node providers |
| `@open-vibe-lab/open-sub-auth/node`              | Same as above, just explicit            | yes |
| `@open-vibe-lab/open-sub-auth/chrome-extension`  | Chrome extension (MV3)                  | **no** — uses `chrome.tabs` / `chrome.storage.local` |
| `@open-vibe-lab/open-sub-auth/core`              | Worker / Deno / custom embedder         | **no** — pure abstractions, bring your own adapters |

The `/core` entry exports the same `TokenManager`, `Provider` classes, and OAuth primitives, but **does not** auto-register or pull in `node:fs` / `cross-keychain` / local-server code. Bring your own `AuthFlowAdapters` and call `registerProvider(...)` yourself.

### Design Decisions

- **`getAuthHeaders()` instead of high-level Client API** — Each provider's API surface is completely different (Claude uses `x-api-key`, OpenAI Codex uses a private endpoint with non-standard format). A unified client would be a leaky abstraction. Instead, we provide authenticated headers and let you use `fetch` directly.

- **Core / Adapter split** — All platform-specific I/O (HTTP server, browser launching, code prompts, file/keychain storage) is behind interfaces in `core/abstractions/`. The OAuth protocol logic in `core/` works on any runtime that has `fetch` + Web Crypto. See `docs/writing-an-adapter.md` for how to write a new adapter (e.g. for a Chrome extension).

- **OS keychain with encrypted file fallback** — Tokens are stored in the system keychain by default. On systems without keychain access, an AES-256-GCM encrypted file is used. (Node adapter only; pure-core consumers provide their own `TokenStore`.)

- **Concurrent refresh protection** — A per-account mutex prevents multiple simultaneous token refresh requests.

## Important Warnings

### Terms of Service

Using subscription OAuth tokens in third-party tools may violate provider Terms of Service:

- **Claude**: Anthropic restricts subscription OAuth tokens to official tooling. Third-party use may result in account restrictions.
- **OpenAI Codex**: The `chatgpt.com/backend-api/codex/responses` endpoint is private and undocumented. It may change or be restricted at any time.

**This library is provided for personal learning and local use only. Use at your own risk.**

### API Endpoint Stability

The API endpoints used by subscription tokens are not the same as the standard public APIs:

| Provider     | Endpoint                                  | Notes                                                            |
| ------------ | ----------------------------------------- | ---------------------------------------------------------------- |
| Claude       | `api.anthropic.com/v1/messages`           | Requires `Authorization: Bearer` header + `anthropic-beta: oauth-2025-04-20` |
| OpenAI Codex | `chatgpt.com/backend-api/codex/responses` | Private endpoint, non-standard request format                    |

These endpoints may change without notice.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build

# Lint
npm run lint
```

## License

MIT
