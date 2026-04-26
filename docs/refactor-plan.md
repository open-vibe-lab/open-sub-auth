# Refactor Plan: core (abstractions) + adapters (implementations)

> Goal: split runtime-agnostic logic (core/) from platform-specific implementations
> (adapters/), so we can plug in Chrome Extension, Deno, Bun etc. without rewriting
> the OAuth/token logic.

## Target structure

```
src/
├── core/                             # 100% runtime-agnostic
│   ├── types.ts
│   ├── errors.ts
│   ├── crypto.ts                     # Web Crypto API (isomorphic)
│   ├── jwt.ts
│   ├── pkce-flow.ts                  # was oauth-pkce.ts; takes adapters as param
│   ├── device-flow.ts                # was oauth-device.ts
│   ├── token-manager.ts              # was token/manager.ts
│   ├── abstractions/
│   │   ├── browser-launcher.ts
│   │   ├── callback-receiver.ts
│   │   ├── code-prompter.ts
│   │   └── index.ts                  # AuthFlowAdapters
│   └── providers/
│       ├── registry.ts
│       ├── claude.ts
│       ├── openai-codex.ts
│       └── github-copilot.ts
├── adapters/
│   ├── node/
│   │   ├── index.ts                  # createNodeAdapters() + auto-register
│   │   ├── browser-launcher.ts
│   │   ├── callback-receiver.ts
│   │   ├── code-prompter.ts
│   │   ├── proxy.ts
│   │   ├── storage/
│   │   │   ├── index.ts              # createTokenStore()
│   │   │   ├── file-store.ts
│   │   │   └── keychain-store.ts
│   │   ├── env-import/
│   │   │   ├── claude.ts             # importClaudeTokenFromEnv
│   │   │   ├── codex.ts              # importFromCodexCli
│   │   │   └── copilot.ts            # importCopilotTokenFromEnv
│   │   └── cli/
│   └── chrome-extension/             # phase 7 (placeholder)
└── index.ts                          # default Node entry (BC)
```

## Abstraction interfaces

```ts
export interface BrowserLauncher {
  open(url: string): void | Promise<void>;
}

export interface CallbackReceiver {
  listen(opts: {
    expectedState: string;
    timeout?: number;
  }): Promise<{
    redirectUri: string;
    result: Promise<AuthorizationResult>;
    close: () => void;
  }>;
}

export interface CodePrompter {
  promptForCode(expectedState: string): Promise<AuthorizationResult>;
}

export interface AuthFlowAdapters {
  browser: BrowserLauncher;
  callback?: CallbackReceiver;
  codePrompt?: CodePrompter;
}
```

`executePKCEFlow` new signature:

```ts
executePKCEFlow({ config, adapters, loginOptions, manualRedirectUri })
```

## Phases

### Phase 0 — Setup (no code changes)
- Create `src/core/abstractions/`, `src/adapters/node/`
- Record baseline: `pnpm test` (125/127 passing — 2 unrelated failures in `importFromCodexCli` due to local fs leak)
- Record baseline: `pnpm typecheck` ✅

### Phase 1 — Make `core/crypto.ts` isomorphic
- Replace `node:crypto` with Web Crypto API (`crypto.getRandomValues` + `crypto.subtle.digest`)
- `generateCodeChallenge` → async; `generatePKCE` → async
- Update callers (`pkce-flow.ts`, providers' `getAccountId`)
- Add a test: same verifier produces same challenge as the old node:crypto path
- Verify: `pnpm typecheck && pnpm test`

### Phase 2 — Define abstractions + refactor pkce-flow
- Create `core/abstractions/{browser-launcher,callback-receiver,code-prompter,index}.ts`
- Rename `core/oauth-pkce.ts` → `core/pkce-flow.ts`
- Remove imports of `core/{browser,callback-server,manual-code-input}` from pkce-flow
- Accept `adapters: AuthFlowAdapters` param
- Verify: `core/pkce-flow.ts` has zero `node:*` imports

### Phase 3 — Move Node-specific files
- `core/browser.ts` → `adapters/node/browser-launcher.ts` (+ implements BrowserLauncher)
- `core/callback-server.ts` → `adapters/node/callback-receiver.ts` (+ implements CallbackReceiver)
- `core/manual-code-input.ts` → `adapters/node/code-prompter.ts` (+ implements CodePrompter)
- `core/proxy.ts` → `adapters/node/proxy.ts`
- `storage/file-store.ts` → `adapters/node/storage/file-store.ts`
- `storage/keychain-store.ts` → `adapters/node/storage/keychain-store.ts`
- `storage/store.ts` → `adapters/node/storage/index.ts`
- Verify: `grep -r "node:" src/core` returns zero hits

### Phase 4 — Refactor providers
- Move `providers/{claude,openai-codex,github-copilot}.ts` → `core/providers/`
- Constructor takes adapters: `new ClaudeProvider(adapters)`
- Move env-import functions to `adapters/node/env-import/`
- Move auto-registration from provider modules to `adapters/node/index.ts` (`registerNodeProviders()`)

### Phase 5 — Update CLI + entry points
- `src/cli/` → `src/adapters/node/cli/`
- Update `package.json` `bin`: `./dist/adapters/node/cli/index.mjs`
- Rewrite `src/index.ts` (BC default Node entry, side-effect imports `adapters/node/index.ts`)
- Add subpath exports: `./core` (pure abstractions), `./node` (explicit Node), reserve `./chrome` for later
- Verify CLI end-to-end: `login`, `status`, `token`, `logout`

### Phase 6 — Tests + docs
- Update test imports for moved files
- New: MockAdapters contract test for `executePKCEFlow`
- README: add "Architecture: Core + Adapters" section
- New: `docs/writing-an-adapter.md` (Chrome extension example sketch)

### Phase 7 — Chrome Extension Adapter (separate milestone)
Out of this refactor's scope. Placeholder only.

## Acceptance

- [ ] `grep -rn "node:\|cross-keychain\|process\." src/core` returns zero
- [ ] All current public API still importable from main entry (BC)
- [ ] `pnpm test && pnpm typecheck && pnpm lint` green
- [ ] CLI works end-to-end on macOS
- [ ] One mock-adapter contract test verifies abstraction boundary

## Breaking changes (note for CHANGELOG → 0.2.0)

- `generatePKCE()` and `generateCodeChallenge()` become **async**
- `Provider.getAccountId()` becomes **async** (uses Web Crypto SHA-256)
- `executePKCEFlow()` requires explicit `adapters` param (the default Node entry
  re-exports a Node-bound version for BC, so `import "@open-vibe-lab/open-sub-auth"`
  callers don't need to change)

## Known baseline issues

- ✅ Fixed in Phase 4: `importFromCodexCli` test failures — now respects `CODEX_HOME` exclusively when set.
- ⏳ Out of scope: `src/adapters/node/proxy.ts` imports `node:undici` which was removed as a built-in in Node 24. Engines field declares ≥ 22.13, where it still works. Replacement (use `undici` package directly) is a separate fix.
