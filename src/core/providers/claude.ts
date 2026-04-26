import type { AuthFlowAdapters } from "@/core/abstractions/index.ts";
import { sha256Hex } from "@/core/crypto.ts";
import { executePKCEFlow, refreshAccessToken } from "@/core/pkce-flow.ts";
import type { AuthHeaders, LoginOptions, Provider, ProviderConfig, TokenSet } from "@/types.ts";

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
  constructor(private readonly adapters: AuthFlowAdapters) {}

  async login(options?: LoginOptions): Promise<TokenSet> {
    // Claude only allows console.anthropic.com/oauth/code/callback as redirect URI.
    // Local callback server is not supported, so always use manual (code-paste) mode.
    return executePKCEFlow({
      config: this.config,
      adapters: this.adapters,
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

  async getAccountId(tokenSet: TokenSet): Promise<string> {
    // Claude doesn't provide a profile endpoint, so derive ID from refresh token hash
    const source = tokenSet.refreshToken ?? tokenSet.accessToken;
    return (await sha256Hex(source)).slice(0, 16);
  }

  getAccountLabel(_tokenSet: TokenSet): string | undefined {
    // Claude tokens don't carry user identity info
    return undefined;
  }
}
