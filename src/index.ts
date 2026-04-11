// Core types
export type {
  AuthHeaders,
  AuthorizationResult,
  CredentialStatus,
  DeviceCodeInfo,
  LoginOptions,
  PKCEParams,
  Provider,
  ProviderConfig,
  StoredCredential,
  TokenMetadata,
  TokenSet,
  TokenStore,
} from "@/types.ts";

// Errors
export {
  AuthenticationError,
  NoCredentialError,
  OAuthCallbackError,
  OAuthTimeoutError,
  OpenSubAuthError,
  ProviderNotFoundError,
  StateMismatchError,
  TokenExpiredError,
  TokenRefreshError,
} from "@/errors.ts";

// Token Manager
export { TokenManager } from "@/token/manager.ts";

// Storage
export { createTokenStore, FileStore, KeychainStore } from "@/storage/store.ts";
export type { StoreType } from "@/storage/store.ts";

// Provider registry
export { getProvider, listProviders, registerProvider } from "@/providers/registry.ts";

// Built-in providers
export { ClaudeProvider, importClaudeTokenFromEnv } from "@/providers/claude.ts";
export { OpenAICodexProvider, importFromCodexCli } from "@/providers/openai-codex.ts";
export { GitHubCopilotProvider, importCopilotTokenFromEnv } from "@/providers/github-copilot.ts";

// Core utilities (for advanced users / custom providers)
export {
  generateCodeChallenge,
  generateCodeVerifier,
  generatePKCE,
  generateState,
} from "@/core/crypto.ts";
export {
  buildAuthorizationUrl,
  exchangeCode,
  executePKCEFlow,
  refreshAccessToken,
} from "@/core/oauth-pkce.ts";
export { executeDeviceCodeFlow, pollForToken, requestDeviceCode } from "@/core/oauth-device.ts";
export { startCallbackServer } from "@/core/callback-server.ts";
export { parseCodeAndState, promptForCode } from "@/core/manual-code-input.ts";
export { openBrowser } from "@/core/browser.ts";
export { initProxy } from "@/core/proxy.ts";
export { decodeJWT } from "@/token/jwt.ts";
