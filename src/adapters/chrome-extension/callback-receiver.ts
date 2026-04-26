import type { CallbackReceiver, CallbackReceiverHandle } from "@/core/abstractions/index.ts";
import { OAuthCallbackError, OAuthTimeoutError } from "@/errors.ts";
import type { ChromeBrowserLauncher } from "./browser-launcher.ts";
import { getChromeAPI, type TabUpdatedListener } from "./chrome-api.ts";

export interface ChromeCallbackReceiverOptions {
  /**
   * The URL the OAuth provider will redirect to after authorization.
   * Must match the redirect_uri whitelisted at the auth server. The
   * receiver matches by `pathname` so query/hash do not affect matching.
   *
   * For Claude this is `https://console.anthropic.com/oauth/code/callback`.
   * For OpenAI Codex this is `http://localhost:1455/auth/callback` — the
   * navigation will fail to load (ERR_CONNECTION_REFUSED) but the URL is
   * still observable via `tabs.onUpdated` before the failure event.
   */
  redirectUri: string;
  /**
   * The browser launcher whose `getLastTabId()` will be consulted to
   * filter URL change events to the auth tab only. If omitted, the
   * receiver matches on ANY tab — less safe (concurrent browsing on
   * the same domain could trigger a spurious match) but useful for
   * non-tab-aware bootstraps.
   */
  browser?: ChromeBrowserLauncher;
  /**
   * Whether to close the auth tab once the redirect has been captured.
   * Default: true.
   */
  closeTabOnSuccess?: boolean;
}

/**
 * Listens for the OAuth redirect via `chrome.tabs.onUpdated`. Returns
 * `redirectUri` unchanged from options (the auth server has it
 * hardcoded; we do not negotiate it).
 */
export function createChromeCallbackReceiver(
  options: ChromeCallbackReceiverOptions,
): CallbackReceiver {
  const { redirectUri, browser, closeTabOnSuccess = true } = options;
  const expectedUrl = new URL(redirectUri);

  return {
    async listen({ expectedState, timeout = 120_000 }) {
      const chrome = getChromeAPI();

      let listener: TabUpdatedListener | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let observedTabId: number | undefined;
      let settled = false;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (listener) chrome.tabs.onUpdated.removeListener(listener);
      };

      const result = new Promise<{ code: string; state: string }>((resolve, reject) => {
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          cleanup();
          fn();
        };

        timer = setTimeout(() => {
          settle(() => reject(new OAuthTimeoutError(timeout)));
        }, timeout);

        listener = (tabId, info) => {
          if (!info.url) return;

          // Restrict to the tab we opened, if known
          const expectedTabId = browser?.getLastTabId();
          if (expectedTabId !== undefined && tabId !== expectedTabId) return;

          let url: URL;
          try {
            url = new URL(info.url);
          } catch {
            return;
          }

          // Match on origin + pathname; ignore search/hash for matching
          if (url.origin !== expectedUrl.origin || url.pathname !== expectedUrl.pathname) {
            return;
          }

          observedTabId = tabId;

          const error = url.searchParams.get("error");
          if (error) {
            const desc = url.searchParams.get("error_description") ?? error;
            settle(() => reject(new OAuthCallbackError(`OAuth error: ${desc}`)));
            return;
          }

          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          if (!code) {
            settle(() => reject(new OAuthCallbackError("No authorization code in redirect URL")));
            return;
          }
          if (state && state !== expectedState) {
            settle(() =>
              reject(
                new OAuthCallbackError("State mismatch — possible CSRF attack. Please try again."),
              ),
            );
            return;
          }
          settle(() => resolve({ code, state: state ?? expectedState }));
        };

        chrome.tabs.onUpdated.addListener(listener);
      });

      // Best-effort: close the tab once the result settles, regardless of
      // outcome. We do this here (not inline in cleanup) so callers can
      // still inspect the URL during debugging if they hook in.
      if (closeTabOnSuccess) {
        result
          .finally(() => {
            if (observedTabId !== undefined) {
              chrome.tabs.remove(observedTabId).catch(() => {
                // Tab may already be closed by user — ignore
              });
            }
          })
          .catch(() => {
            // Already handled by the consumer
          });
      }

      const handle: CallbackReceiverHandle = {
        redirectUri,
        result,
        close: () => {
          if (!settled) {
            settled = true;
            cleanup();
          }
        },
      };
      return handle;
    },
  };
}
