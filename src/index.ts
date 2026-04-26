/**
 * Default package entry — Node.js, backward-compatible.
 *
 * Re-exports the Node adapter bundle (which itself re-exports all of `core`),
 * so legacy imports like
 *
 *   import { TokenManager, createTokenStore } from "@open-vibe-lab/open-sub-auth";
 *
 * keep working unchanged. Node providers are auto-registered as a side effect.
 *
 * For pure runtime-agnostic use (Chrome extension, Workers, custom adapters),
 * use the `/core` subpath:
 *
 *   import { TokenManager, ClaudeProvider } from "@open-vibe-lab/open-sub-auth/core";
 */
export * from "@/adapters/node/index.ts";
