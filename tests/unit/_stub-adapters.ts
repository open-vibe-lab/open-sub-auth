import type { AuthFlowAdapters } from "@/core/abstractions/index.ts";

/**
 * Stub adapters for unit tests that exercise pure provider methods (config,
 * getAuthHeaders, getAccountId, getAccountLabel) without invoking the OAuth flow.
 */
export const stubAdapters: AuthFlowAdapters = {
  browser: {
    open() {
      throw new Error("stubAdapters.browser.open should not be called in unit tests");
    },
  },
};
