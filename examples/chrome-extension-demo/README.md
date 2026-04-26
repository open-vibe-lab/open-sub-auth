# open-sub-auth Chrome extension demo

Minimal MV3 extension showing how to use `@open-vibe-lab/open-sub-auth/chrome-extension` to log in to Claude / OpenAI Codex / GitHub Copilot from a Chrome extension and call their APIs.

## Build

```bash
# from the repo root
pnpm -C examples/chrome-extension-demo install
pnpm -C examples/chrome-extension-demo build
```

Output lands in `examples/chrome-extension-demo/dist/`.

## Load unpacked

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `examples/chrome-extension-demo/dist/` directory

The extension's icon will appear in the toolbar. Click it to open the popup.

## Usage

The popup has Login / Logout / Test buttons per provider:

- **Claude**: Click *Login*. A new tab opens to `claude.ai/oauth/authorize`. After you authorize, Anthropic's console page shows an authorization code. Copy it (in `code#state` format), paste into the popup's input field, and click *Submit*. The service worker then exchanges it for tokens and stores them in `chrome.storage.local`.
- **OpenAI Codex**: Click *Login*. A new tab opens to `auth.openai.com`. After auth, the browser tries to redirect to `localhost:1455` and fails to load — but the extension intercepts the URL via `chrome.tabs.onUpdated` and extracts the code automatically. The tab is then closed.
- **GitHub Copilot**: Uses Device Code flow. The verification URL and user code are logged to the service worker console (open `chrome://extensions/` → "service worker" link to view). Authorize on github.com/login/device, then the service worker polls for the token.

The *Test* button (Claude only in this demo) makes an authenticated call to `api.anthropic.com/v1/messages` to verify the token works end-to-end.

## How it works

```
┌──────────────────┐   chrome.runtime.sendMessage   ┌────────────────────────┐
│  popup.ts (UI)   │ ────────────────────────────▶ │ service-worker.ts      │
│                  │                                │  - TokenManager        │
│  Login/Logout    │ ◀────────────────────────────  │  - ChromeStorageStore  │
│  Code paste form │      response                  │  - chromeAdapters      │
└──────────────────┘                                └────────────────────────┘
                                                             │
                                                             ▼
                                          chrome.tabs.create(authUrl)
                                          chrome.tabs.onUpdated → capture redirect
                                          fetch(token endpoint)
                                          chrome.storage.local.set(...)
```

The service worker runs the entire OAuth flow. The popup is just a remote control — all state survives popup close because it lives in the service worker / `chrome.storage.local`.

## Caveats

- **Claude UX is manual** in this demo. Auto-mode (intercepting `console.anthropic.com/oauth/code/callback` URL via tabs.onUpdated, like OpenAI) is possible but requires subclassing `ClaudeProvider` to disable its forced manual mode. Left as an exercise.
- **Service workers are evicted** when idle. Token refresh state (the in-memory mutex map) is lost across evictions, but `chrome.storage.local` keeps the tokens. Worst case, two refreshes might race once after a long idle — harmless.
- **Subscription token ToS**: same caveats as the main library. Anthropic restricts subscription OAuth tokens to official tooling; OpenAI's `chatgpt.com/backend-api/codex/responses` is private and undocumented. **Personal/learning use only — at your own risk.**
- **chrome.storage.local is unencrypted**. If your threat model includes co-resident extensions with broad permissions, wrap credentials in a Web Crypto AES-GCM layer with a key in `chrome.storage.session`.
