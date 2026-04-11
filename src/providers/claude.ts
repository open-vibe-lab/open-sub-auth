import { createHash } from "node:crypto";
import { executePKCEFlow, refreshAccessToken } from "@/core/oauth-pkce.ts";
import type { AuthHeaders, LoginOptions, Provider, ProviderConfig, TokenSet } from "@/types.ts";
import { registerProvider } from "@/providers/registry.ts";

const CLAUDE_CONFIG: ProviderConfig = {
  name: "claude",
  displayName: "Claude Pro/Max",
  authorizationEndpoint: "https://claude.ai/oauth/authorize",
  tokenEndpoint: "https://console.anthropic.com/v1/oauth/token",
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  scopes: ["org:create_api_key", "user:profile", "user:inference"],
  grantType: "authorization_code",
  // Claude only supports console.anthropic.com redirect URI (no localhost),
  // and its token endpoint requires JSON body with state field
  tokenBodyFormat: "json",
  stateIsVerifier: true,
};

/** Redirect URI used in manual/headless mode (user copies code from browser) */
const MANUAL_REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";

export class ClaudeProvider implements Provider {
  readonly config = CLAUDE_CONFIG;

  async login(options?: LoginOptions): Promise<TokenSet> {
    // Claude only allows console.anthropic.com/oauth/code/callback as redirect URI.
    // Local callback server is not supported, so always use manual (code-paste) mode.
    return executePKCEFlow({
      config: this.config,
      loginOptions: { ...options, manual: true },
      manualRedirectUri: MANUAL_REDIRECT_URI,
    });
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    return refreshAccessToken(this.config, refreshToken);
  }

  getAuthHeaders(accessToken: string): AuthHeaders {
    return {
      authorization: `Bearer ${accessToken}`,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "oauth-2025-04-20",
      "content-type": "application/json",
    };
  }

  getAccountId(tokenSet: TokenSet): string {
    // Claude doesn't provide a profile endpoint, so derive ID from refresh token hash
    const source = tokenSet.refreshToken ?? tokenSet.accessToken;
    return createHash("sha256").update(source).digest("hex").slice(0, 16);
  }

  getAccountLabel(_tokenSet: TokenSet): string | undefined {
    // Claude tokens don't carry user identity info
    return undefined;
  }
}

/**
 * Import a Claude OAuth token from the CLAUDE_CODE_OAUTH_TOKEN environment variable.
 * This token is used directly as the access token for API calls.
 */
export function importClaudeTokenFromEnv(): TokenSet | null {
  const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!token) return null;
  return {
    accessToken: token,
    refreshToken: null,
    expiresAt: Date.now() + 3600_000, // Assume 1 hour; will refresh as needed
    tokenType: "bearer",
  };
}

// Auto-register
registerProvider("claude", () => new ClaudeProvider());
