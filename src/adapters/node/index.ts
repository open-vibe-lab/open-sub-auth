import type { AuthFlowAdapters } from "@/core/abstractions/index.ts";
import { ClaudeProvider } from "@/core/providers/claude.ts";
import { GitHubCopilotProvider } from "@/core/providers/github-copilot.ts";
import { OpenAICodexProvider } from "@/core/providers/openai-codex.ts";
import { registerProvider } from "@/core/providers/registry.ts";
import { nodeBrowserLauncher } from "./browser-launcher.ts";
import { nodeCallbackReceiver } from "./callback-receiver.ts";
import { nodeCodePrompter } from "./code-prompter.ts";

// Re-export the entire pure-core surface so that `import * from ".../node"`
// gives consumers a self-contained surface (no need to also import from
// `.../core` to get TokenManager / errors / types — which would cross a
// bundle boundary and split module state under multi-entry packaging).
export * from "@/core/index.ts";

export { createNodeCallbackReceiver, nodeCallbackReceiver } from "./callback-receiver.ts";
export { nodeBrowserLauncher } from "./browser-launcher.ts";
export { nodeCodePrompter } from "./code-prompter.ts";
export { createTokenStore, FileStore, KeychainStore } from "./storage/index.ts";
export type { StoreType } from "./storage/index.ts";
export { initProxy } from "./proxy.ts";
export { startCallbackServer } from "./callback-server.ts";
export { parseCodeAndState, promptForCode } from "./manual-code-input.ts";
export { openBrowser } from "./browser.ts";
export {
  importClaudeTokenFromEnv,
  importCopilotTokenFromEnv,
  importFromCodexCli,
} from "./env-import/index.ts";

/** Default adapter bundle for Node.js environments (CLI, scripts, servers). */
export const nodeAdapters: AuthFlowAdapters = {
  browser: nodeBrowserLauncher,
  callback: nodeCallbackReceiver,
  codePrompt: nodeCodePrompter,
};

/**
 * Register the built-in providers (claude, openai-codex, github-copilot) bound
 * to the Node adapter bundle. Idempotent.
 */
export function registerNodeProviders(): void {
  registerProvider("claude", () => new ClaudeProvider(nodeAdapters));
  registerProvider("openai-codex", () => new OpenAICodexProvider(nodeAdapters));
  registerProvider("github-copilot", () => new GitHubCopilotProvider(nodeAdapters));
}

// Auto-register on import so `import "@open-vibe-lab/open-sub-auth"` works
// out of the box in Node environments (backward compatibility).
registerNodeProviders();
