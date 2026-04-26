/** OAuth token set returned after successful authentication */
export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  /** Unix timestamp in milliseconds when the access token expires */
  expiresAt: number;
  /** JWT id_token (present for OpenAI, contains email/plan info) */
  idToken?: string;
  tokenType: "bearer" | "api-key";
  scopes?: string[];
  /** Raw response from the token endpoint for extensibility */
  raw?: Record<string, unknown>;
}

/** Configuration for an OAuth provider */
export interface ProviderConfig {
  /** Unique identifier: "claude", "openai-codex", "github-copilot" */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Authorization endpoint URL (for PKCE flow) */
  authorizationEndpoint?: string;
  /** Token exchange endpoint URL */
  tokenEndpoint: string;
  /** OAuth client ID */
  clientId: string;
  /** Redirect URI for callback (for PKCE flow) */
  redirectUri?: string;
  /** OAuth scopes to request */
  scopes?: string[];
  /** Device code endpoint URL (for device code flow) */
  deviceCodeEndpoint?: string;
  /** OAuth grant type */
  grantType: "authorization_code" | "device_code";
  /** Token exchange request body format (default: "form") */
  tokenBodyFormat?: "form" | "json";
  /** Use PKCE verifier as state parameter (non-standard, required by some providers) */
  stateIsVerifier?: boolean;
}

/** Provider interface that all providers must implement */
export interface Provider {
  readonly config: ProviderConfig;
  /** Run the full interactive login flow */
  login(options?: LoginOptions): Promise<TokenSet>;
  /** Refresh an expired access token */
  refresh(refreshToken: string): Promise<TokenSet>;
  /** Build auth headers for making API calls */
  getAuthHeaders(accessToken: string): AuthHeaders;
  /** Extract a stable account identifier from tokens */
  getAccountId(tokenSet: TokenSet): Promise<string>;
  /** Optional: human-readable account label (e.g., email) */
  getAccountLabel?(tokenSet: TokenSet): string | undefined;
}

/** Options for the login flow */
export interface LoginOptions {
  /** Override port for the local callback server */
  port?: number;
  /** Timeout in ms for the entire login flow (default: 120000) */
  timeout?: number;
  /** Use manual code input mode instead of local callback server */
  manual?: boolean;
  /** Callback when the browser should be opened */
  onOpenBrowser?: (url: string) => void;
  /** Callback for device code flow: display code to user */
  onDeviceCode?: (code: DeviceCodeInfo) => void;
}

/** Device code information displayed to the user */
export interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

/** HTTP headers for authenticated API calls */
export type AuthHeaders = Record<string, string>;

/** Stored credential with metadata */
export interface StoredCredential {
  tokenSet: TokenSet;
  metadata: TokenMetadata;
}

/** Metadata about a stored credential */
export interface TokenMetadata {
  provider: string;
  accountId: string;
  accountLabel?: string;
  createdAt: number;
  lastRefreshedAt: number;
}

/** Token storage interface */
export interface TokenStore {
  get(provider: string, accountId: string): Promise<StoredCredential | null>;
  set(provider: string, accountId: string, credential: StoredCredential): Promise<void>;
  delete(provider: string, accountId: string): Promise<void>;
  list(provider?: string): Promise<StoredCredential[]>;
}

/** Status of a stored credential */
export interface CredentialStatus {
  provider: string;
  displayName: string;
  accountId: string;
  accountLabel?: string;
  isExpired: boolean;
  expiresAt: number;
  hasRefreshToken: boolean;
}

/** PKCE parameters for OAuth flow */
export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
}

/** Result from the callback server or manual code input */
export interface AuthorizationResult {
  code: string;
  state: string;
}
