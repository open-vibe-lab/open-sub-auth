import type { BrowserLauncher } from "@/core/abstractions/index.ts";
import { getChromeAPI } from "./chrome-api.ts";

/**
 * Opens the OAuth authorization URL in a new Chrome tab. The tab id is
 * recorded so the callback receiver can both observe URL changes and
 * close the tab once the redirect has been intercepted.
 *
 * Tab lifecycle is tracked here (not in the receiver) because Chrome's
 * `tabs.onUpdated` listener fires for ALL tabs — we want to filter to
 * just the tab we opened, otherwise a parallel browse on the same domain
 * could spuriously satisfy the redirect match.
 */
export interface ChromeBrowserLauncher extends BrowserLauncher {
  /** Returns the tab id of the most recently opened auth tab, if any. */
  getLastTabId(): number | undefined;
}

export function createChromeBrowserLauncher(): ChromeBrowserLauncher {
  let lastTabId: number | undefined;
  return {
    async open(url) {
      const tab = await getChromeAPI().tabs.create({ url, active: true });
      lastTabId = tab.id;
    },
    getLastTabId() {
      return lastTabId;
    },
  };
}
