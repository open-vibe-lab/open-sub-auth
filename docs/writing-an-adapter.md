# Writing an Adapter

`@open-vibe-lab/open-sub-auth/core` is platform-agnostic. To use it on a new
runtime (Chrome extension, Deno, Workers, headless test rig, …), implement
the three abstractions in `core/abstractions/` and provide a `TokenStore`.

## The contract

```ts
import type {
  AuthFlowAdapters,
  BrowserLauncher,
  CallbackReceiver,
  CodePrompter,
  TokenStore,
} from "@open-vibe-lab/open-sub-auth/core";

interface BrowserLauncher {
  open(url: string): void | Promise<void>;
}

interface CallbackReceiver {
  listen(opts: { expectedState: string; timeout?: number; port?: number }): Promise<{
    redirectUri: string;
    result: Promise<{ code: string; state: string }>;
    close(): void;
  }>;
}

interface CodePrompter {
  promptForCode(expectedState: string): Promise<{ code: string; state: string }>;
}
```

`AuthFlowAdapters` is `{ browser, callback?, codePrompt? }`. Provide `callback`
for the automatic flow, `codePrompt` for the manual flow. Most platforms only
need one.

## Example: Chrome extension (MV3)

Chrome extensions can't run a local HTTP server, but they can intercept tab
URL changes — perfect for the `CallbackReceiver` interface.

```ts
// chrome-adapter.ts
import type { AuthFlowAdapters, CallbackReceiver, BrowserLauncher } from "@open-vibe-lab/open-sub-auth/core";

const browser: BrowserLauncher = {
  async open(url) {
    await chrome.tabs.create({ url, active: true });
  },
};

const callback: CallbackReceiver = {
  async listen({ expectedState, timeout = 120_000 }) {
    // Open an empty placeholder tab; the user is sent there from the auth page.
    // For Claude, redirect goes to console.anthropic.com — readable.
    // For OpenAI, redirect to localhost:1455 fails to load, but the URL is
    // still observable on the tab before the load error fires.
    const redirectUri = "https://console.anthropic.com/oauth/code/callback";

    return {
      redirectUri,
      close: () => {},
      result: new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          reject(new Error("OAuth timeout"));
        }, timeout);

        const listener = (
          _tabId: number,
          info: chrome.tabs.TabChangeInfo,
          _tab: chrome.tabs.Tab,
        ) => {
          if (!info.url) return;
          const url = new URL(info.url);
          if (!url.pathname.endsWith("/oauth/code/callback")) return;

          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          if (!code || !state) return;
          if (state !== expectedState) {
            clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error("State mismatch"));
            return;
          }
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve({ code, state });
        };

        chrome.tabs.onUpdated.addListener(listener);
      }),
    };
  },
};

export const chromeAdapters: AuthFlowAdapters = { browser, callback };
```

A `TokenStore` for `chrome.storage.local`:

```ts
import type { StoredCredential, TokenStore } from "@open-vibe-lab/open-sub-auth/core";

export class ChromeStorageStore implements TokenStore {
  private key(provider: string, accountId: string) {
    return `osa::${provider}::${accountId}`;
  }
  async get(p: string, id: string) {
    const k = this.key(p, id);
    const v = await chrome.storage.local.get(k);
    return (v[k] as StoredCredential | undefined) ?? null;
  }
  async set(p: string, id: string, c: StoredCredential) {
    await chrome.storage.local.set({ [this.key(p, id)]: c });
  }
  async delete(p: string, id: string) {
    await chrome.storage.local.remove(this.key(p, id));
  }
  async list(provider?: string): Promise<StoredCredential[]> {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all)
      .filter(([k]) => k.startsWith("osa::") && (!provider || k.startsWith(`osa::${provider}::`)))
      .map(([, v]) => v as StoredCredential);
  }
}
```

Wiring it together:

```ts
import {
  ClaudeProvider,
  TokenManager,
  registerProvider,
} from "@open-vibe-lab/open-sub-auth/core";
import { chromeAdapters } from "./chrome-adapter.ts";
import { ChromeStorageStore } from "./chrome-storage-store.ts";

registerProvider("claude", () => new ClaudeProvider(chromeAdapters));

const manager = new TokenManager(new ChromeStorageStore());

// In a popup button handler:
async function login() {
  await manager.login("claude");
}
```

## Caveats for Chrome extensions

- **Redirect URI mismatch is unavoidable.** Claude requires
  `https://console.anthropic.com/oauth/code/callback`; OpenAI requires
  `http://localhost:1455/auth/callback`. The auth servers won't accept your
  extension's `chromiumapp.org` URI. The tab-URL-interception pattern above
  is the workaround. For OpenAI, the localhost URL fails to load, but
  `chrome.tabs.onUpdated` fires *before* the load error.
- **`host_permissions`** in `manifest.json` must include the auth and API
  endpoints (`https://claude.ai/*`, `https://console.anthropic.com/*`,
  `https://api.anthropic.com/*`, etc.).
- **Service-worker termination** wipes in-memory state (e.g. the
  `TokenManager` refresh-lock map). This is OK because the locks only matter
  during a single token-refresh window.
- **Token security**: `chrome.storage.local` has no isolation guarantees
  comparable to OS keychain. Encrypt sensitive values with Web Crypto AES-GCM
  if your threat model needs it.

## Testing your adapter

The contract is verified by `tests/unit/pkce-flow-contract.test.ts` — copy
its style with mock fetch + your adapter to confirm the flow composes
correctly.
