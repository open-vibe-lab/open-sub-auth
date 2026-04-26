import type { AuthFlowAdapters } from "@/core/abstractions/index.ts";
import { sha256Hex } from "@/core/crypto.ts";
import { decodeJWT } from "@/core/jwt.ts";
import { executePKCEFlow, refreshAccessToken } from "@/core/pkce-flow.ts";
import type { AuthHeaders, LoginOptions, Provider, ProviderConfig, TokenSet } from "@/types.ts";

const OPENAI_CODEX_CONFIG: ProviderConfig = {
  name: "openai-codex",
  displayName: "OpenAI ChatGPT Plus/Pro",
  authorizationEndpoint: "https://auth.openai.com/oauth/authorize",
  tokenEndpoint: "https://auth.openai.com/oauth/token",
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  redirectUri: "http://localhost:1455/auth/callback",
  scopes: ["openid", "profile", "email", "offline_access"],
  grantType: "authorization_code",
};

/**
 * OpenAI's authorization server has `http://localhost:1455/auth/callback` whitelisted.
 * Node receivers must bind to this exact port; Chrome-extension receivers ignore it
 * and rely on tab URL interception instead.
 */
const OPENAI_FIXED_PORT = 1455;

export class OpenAICodexProvider implements Provider {
  readonly config = OPENAI_CODEX_CONFIG;
  constructor(private readonly adapters: AuthFlowAdapters) {}

  async login(options?: LoginOptions): Promise<TokenSet> {
    return executePKCEFlow({
      config: this.config,
      adapters: this.adapters,
      loginOptions: {
        ...options,
        port: options?.port ?? OPENAI_FIXED_PORT,
      },
    });
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    return refreshAccessToken(this.config, refreshToken);
  }

  getAuthHeaders(accessToken: string): AuthHeaders {
    return {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    };
  }

  async getAccountId(tokenSet: TokenSet): Promise<string> {
    if (tokenSet.idToken) {
      try {
        const claims = decodeJWT(tokenSet.idToken);
        if (claims.sub) return claims.sub;
      } catch {
        // Fall through
      }
    }
    return (await sha256Hex(tokenSet.accessToken)).slice(0, 16);
  }

  getAccountLabel(tokenSet: TokenSet): string | undefined {
    if (tokenSet.idToken) {
      try {
        const claims = decodeJWT(tokenSet.idToken);
        if (claims.email) return claims.email as string;
      } catch {
        // Fall through
      }
    }
    return undefined;
  }
}
