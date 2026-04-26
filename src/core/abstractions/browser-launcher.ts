/**
 * Opens an authorization URL in the user's browser.
 *
 * Implementations:
 * - Node CLI: spawns `open` / `xdg-open` / `cmd start`
 * - Chrome extension: `chrome.tabs.create({ url })`
 * - Test/headless: a no-op or a logger
 */
export interface BrowserLauncher {
  open(url: string): void | Promise<void>;
}
