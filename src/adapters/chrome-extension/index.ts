/**
 * Chrome extension adapter entry. Provides:
 *  - BrowserLauncher backed by `chrome.tabs.create`
 *  - CallbackReceiver backed by `chrome.tabs.onUpdated` URL interception
 *  - CodePrompter via popup ↔ service-worker message bridge
 *  - TokenStore backed by `chrome.storage.local`
 *  - `registerChromeProviders()` to bind built-in providers to chrome adapters
 *
 * This module re-exports the entire pure-core surface so consumers can
 * import everything they need from one place:
 *
 *     import {
 *       TokenManager,
 *       registerChromeProviders,
 *       ChromeStorageStore,
 *     } from "@open-vibe-lab/open-sub-auth/chrome-extension";
 */

import type { AuthFlowAdapters } from "@/core/abstractions/index.ts";
import { ClaudeProvider } from "@/core/providers/claude.ts";
import { GitHubCopilotProvider } from "@/core/providers/github-copilot.ts";
import { OpenAICodexProvider } from "@/core/providers/openai-codex.ts";
import { registerProvider } from "@/core/providers/registry.ts";
import { type ChromeBrowserLauncher, createChromeBrowserLauncher } from "./browser-launcher.ts";
import { createChromeCallbackReceiver } from "./callback-receiver.ts";
import { type ChromeCodePrompter, createChromeCodePrompter } from "./code-prompter.ts";
import { ChromeStorageStore } from "./storage/chrome-storage-store.ts";

// Re-export the entire core surface
export * from "@/core/index.ts";

// Chrome-specific public surface
export type { ChromeAPI } from "./chrome-api.ts";
export type { ChromeBrowserLauncher } from "./browser-launcher.ts";
export type { ChromeCallbackReceiverOptions } from "./callback-receiver.ts";
export type { ChromeCodePrompter } from "./code-prompter.ts";
export {
  createChromeBrowserLauncher,
  createChromeCallbackReceiver,
  createChromeCodePrompter,
  ChromeStorageStore,
};

/**
 * Per-provider redirect URIs whitelisted at the auth servers. The Chrome
 * receiver matches on these to capture the redirect from `chrome.tabs.onUpdated`.
 *
 * - Claude: console.anthropic.com is a real loadable page that displays the
 *   code (so even without interception, manual paste still works).
 * - OpenAI Codex: localhost:1455 fails to load (ERR_CONNECTION_REFUSED) but
 *   the URL is observable on the tab BEFORE the load error fires.
 */
const REDIRECT_URIS = {
  claude: "https://console.anthropic.com/oauth/code/callback",
  "openai-codex": "http://localhost:1455/auth/callback",
} as const;

export interface ChromeAdaptersBundle {
  browser: ChromeBrowserLauncher;
  codePrompt: ChromeCodePrompter;
  /** Build adapters tailored to a given provider's redirect URI. */
  forProvider(provider: keyof typeof REDIRECT_URIS): AuthFlowAdapters;
  /** Adapters with no callback (device-code flow, e.g. github-copilot). */
  forDeviceFlow(): AuthFlowAdapters;
}

/**
 * Build a chrome adapters bundle. The same `browser` and `codePrompt`
 * instances are reused across providers; only the callback receiver is
 * specialized per redirect URI.
 */
export function createChromeAdapters(): ChromeAdaptersBundle {
  const browser = createChromeBrowserLauncher();
  const codePrompt = createChromeCodePrompter();

  return {
    browser,
    codePrompt,
    forProvider(provider) {
      const redirectUri = REDIRECT_URIS[provider];
      const callback = createChromeCallbackReceiver({ redirectUri, browser });
      return { browser, callback, codePrompt };
    },
    forDeviceFlow() {
      return { browser, codePrompt };
    },
  };
}

/**
 * Register all built-in providers (claude, openai-codex, github-copilot)
 * bound to a single chrome adapters bundle. Returns the bundle so callers
 * can reach the `codePrompt` instance for popup wiring.
 *
 * Notes on per-provider flow choice:
 * - Claude uses manual mode + `codePrompt`: the user copies the code from
 *   console.anthropic.com (which loads as a real page) and pastes it into
 *   the popup. Automatic-mode interception of the same URL is possible by
 *   subclassing ClaudeProvider with `manual: false`; left as a follow-up.
 * - OpenAI Codex uses automatic mode + tab URL interception (the
 *   localhost:1455 load fails but the URL is captured first).
 * - GitHub Copilot uses device-code flow — no callback receiver needed.
 */
export function registerChromeProviders(): ChromeAdaptersBundle {
  const bundle = createChromeAdapters();

  registerProvider("claude", () => new ClaudeProvider(bundle.forProvider("claude")));
  registerProvider(
    "openai-codex",
    () => new OpenAICodexProvider(bundle.forProvider("openai-codex")),
  );
  registerProvider("github-copilot", () => new GitHubCopilotProvider(bundle.forDeviceFlow()));

  return bundle;
}
