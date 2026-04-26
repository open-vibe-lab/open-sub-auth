import type { AuthorizationResult } from "@/types.ts";

export interface CallbackReceiverHandle {
  /** The redirect URI the auth server should send the user back to. */
  redirectUri: string;
  /** Resolves with the parsed authorization result, or rejects on error/timeout. */
  result: Promise<AuthorizationResult>;
  /** Tear down the receiver early (e.g. on outer error). Idempotent. */
  close(): void;
}

/**
 * Receives the OAuth redirect after the user authorizes in the browser.
 *
 * Implementations:
 * - Node CLI: starts a local HTTP server on 127.0.0.1
 * - Chrome extension: listens via `chrome.tabs.onUpdated` for the redirect URL
 * - chrome.identity.launchWebAuthFlow wrapper: also fits this contract
 */
export interface CallbackReceiver {
  listen(opts: {
    /** Expected `state` parameter for CSRF validation. */
    expectedState: string;
    /** Timeout in ms for the whole flow. */
    timeout?: number;
    /**
     * Optional port hint. Used by Node local-server receivers when the OAuth
     * provider has a fixed redirect URI (e.g. OpenAI requires localhost:1455).
     * Receivers without a meaningful port concept (Chrome extension etc.) MAY ignore it.
     */
    port?: number;
  }): Promise<CallbackReceiverHandle>;
}
