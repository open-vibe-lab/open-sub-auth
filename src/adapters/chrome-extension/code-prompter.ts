import type { CodePrompter } from "@/core/abstractions/index.ts";
import { OAuthCallbackError, StateMismatchError } from "@/errors.ts";

/**
 * Bridge for manual code-paste flows (e.g. Claude's hosted callback page).
 *
 * The service worker calls `promptForCode(state)` and gets a Promise. The
 * popup UI then calls `submitCode(input)` (typically wired to a form's
 * submit handler) which resolves the pending Promise.
 *
 * One outstanding prompt at a time — calling `promptForCode` while another
 * is unresolved rejects the previous one.
 */
export interface ChromeCodePrompter extends CodePrompter {
  /**
   * Submit the code pasted by the user. Accepts either:
   *   - a plain code (in which case `state` is assumed to match)
   *   - the `code#state` format used by some providers (Claude)
   */
  submitCode(input: string): void;
  /** Cancel any pending prompt with an OAuthCallbackError. */
  cancel(reason?: string): void;
}

export function createChromeCodePrompter(): ChromeCodePrompter {
  let pending:
    | {
        expectedState: string;
        resolve: (result: { code: string; state: string }) => void;
        reject: (err: Error) => void;
      }
    | undefined;

  function rejectPending(reason: string): void {
    if (pending) {
      pending.reject(new OAuthCallbackError(reason));
      pending = undefined;
    }
  }

  return {
    async promptForCode(expectedState) {
      rejectPending("Superseded by a new code prompt");
      return new Promise((resolve, reject) => {
        pending = { expectedState, resolve, reject };
      });
    },
    submitCode(input) {
      if (!pending) {
        // No active prompt — either user submitted at the wrong time, or
        // the prompt was cancelled. Silently drop rather than throw, so
        // popup code doesn't have to track promise state.
        return;
      }
      const { expectedState, resolve, reject } = pending;
      pending = undefined;

      const trimmed = input.trim();
      if (!trimmed) {
        reject(new OAuthCallbackError("Empty authorization code"));
        return;
      }

      // Support `code#state` (Claude) or plain `code`
      const hashIdx = trimmed.indexOf("#");
      let code: string;
      let state: string;
      if (hashIdx >= 0) {
        code = trimmed.slice(0, hashIdx);
        state = trimmed.slice(hashIdx + 1);
        if (!code) {
          reject(new OAuthCallbackError("Empty authorization code"));
          return;
        }
        if (state !== expectedState) {
          reject(new StateMismatchError());
          return;
        }
      } else {
        code = trimmed;
        state = expectedState;
      }
      resolve({ code, state });
    },
    cancel(reason = "Code prompt cancelled by user") {
      rejectPending(reason);
    },
  };
}
