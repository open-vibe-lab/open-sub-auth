import type { BrowserLauncher } from "./browser-launcher.ts";
import type { CallbackReceiver } from "./callback-receiver.ts";
import type { CodePrompter } from "./code-prompter.ts";

export type { BrowserLauncher } from "./browser-launcher.ts";
export type { CallbackReceiver, CallbackReceiverHandle } from "./callback-receiver.ts";
export type { CodePrompter } from "./code-prompter.ts";

/**
 * The set of platform adapters required by the OAuth PKCE flow.
 *
 * - `browser` is always required (to navigate the user to the authorization URL)
 * - `callback` is required for the automatic redirect-listening flow
 * - `codePrompt` is required for the manual code-paste flow
 *
 * A given adapter bundle may provide one or both of `callback`/`codePrompt`,
 * depending on what the platform can support.
 */
export interface AuthFlowAdapters {
  browser: BrowserLauncher;
  callback?: CallbackReceiver;
  codePrompt?: CodePrompter;
}
