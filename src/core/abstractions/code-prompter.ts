import type { AuthorizationResult } from "@/types.ts";

/**
 * Prompts the user to paste an authorization code (manual / headless / CI mode,
 * or any environment that cannot intercept a redirect).
 *
 * Implementations:
 * - Node CLI: readline on stdin
 * - Chrome extension: a popup form sending a message to the service worker
 */
export interface CodePrompter {
  promptForCode(expectedState: string): Promise<AuthorizationResult>;
}
