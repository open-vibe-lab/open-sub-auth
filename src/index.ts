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
} from "./types.js";

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
} from "./errors.js";

// Token Manager
export { TokenManager } from "./token/manager.js";

// Storage
export { createTokenStore, FileStore, KeychainStore } from "./storage/store.js";

// Provider registry
export { getProvider, listProviders, registerProvider } from "./providers/registry.js";

// Built-in providers
export { ClaudeProvider } from "./providers/claude.js";
export { OpenAICodexProvider, importFromCodexCli } from "./providers/openai-codex.js";

// Core utilities (for advanced users / custom providers)
export { generateCodeChallenge, generateCodeVerifier, generatePKCE, generateState } from "./core/crypto.js";
export { buildAuthorizationUrl, exchangeCode, executePKCEFlow, refreshAccessToken } from "./core/oauth-pkce.js";
export { startCallbackServer } from "./core/callback-server.js";
export { parseCodeAndState, promptForCode } from "./core/manual-code-input.js";
export { openBrowser } from "./core/browser.js";
export { decodeJWT } from "./token/jwt.js";
