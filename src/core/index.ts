/**
 * Pure core entry point: zero Node-specific dependencies, zero auto-registration.
 *
 * Use this entry from environments that bring their own adapters (Chrome
 * extension, Deno, Bun, Workers, browsers, custom embedders). For Node.js
 * scripts and CLI use, import from the package root or `./node` instead.
 */

// Types
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

// Adapter abstractions
export type {
  AuthFlowAdapters,
  BrowserLauncher,
  CallbackReceiver,
  CallbackReceiverHandle,
  CodePrompter,
} from "@/core/abstractions/index.ts";

// Token manager + JWT
export { TokenManager } from "@/core/token-manager.ts";
export { decodeJWT } from "@/core/jwt.ts";

// Provider registry + built-in provider classes (must be registered explicitly
// in pure-core consumers — no side-effect registration happens here).
export { getProvider, listProviders, registerProvider } from "@/core/providers/registry.ts";
export { ClaudeProvider } from "@/core/providers/claude.ts";
export { OpenAICodexProvider } from "@/core/providers/openai-codex.ts";
export { GitHubCopilotProvider } from "@/core/providers/github-copilot.ts";

// OAuth flow primitives (advanced)
export {
  generateCodeChallenge,
  generateCodeVerifier,
  generatePKCE,
  generateState,
  sha256Hex,
} from "@/core/crypto.ts";
export {
  buildAuthorizationUrl,
  exchangeCode,
  executePKCEFlow,
  refreshAccessToken,
} from "@/core/pkce-flow.ts";
export { executeDeviceCodeFlow, pollForToken, requestDeviceCode } from "@/core/device-flow.ts";
