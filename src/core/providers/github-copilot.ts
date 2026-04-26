import type { AuthFlowAdapters } from "@/core/abstractions/index.ts";
import { sha256Hex } from "@/core/crypto.ts";
import { executeDeviceCodeFlow } from "@/core/device-flow.ts";
import { OAuthCallbackError } from "@/errors.ts";
import type { AuthHeaders, LoginOptions, Provider, ProviderConfig, TokenSet } from "@/types.ts";

const GITHUB_COPILOT_CONFIG: ProviderConfig = {
  name: "github-copilot",
  displayName: "GitHub Copilot",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
  deviceCodeEndpoint: "https://github.com/login/device/code",
  // Public client ID used by several Copilot-compatible tools
  clientId: "Iv1.b507a08c87ecfe98",
  scopes: ["gist"],
  grantType: "device_code",
};

/** Copilot session token endpoint (internal GitHub API) */
const COPILOT_SESSION_ENDPOINT = "https://api.github.com/copilot_internal/v2/token";

/** Fetch a short-lived Copilot session token using a GitHub OAuth access token */
async function fetchCopilotSessionToken(
  githubToken: string,
): Promise<{ token: string; expiresAt: number }> {
  const response = await fetch(COPILOT_SESSION_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new OAuthCallbackError(`Copilot session token request failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const token = data.token as string | undefined;

  if (!token) {
    throw new OAuthCallbackError("No token in Copilot session token response");
  }

  // expires_at is a Unix timestamp in seconds
  const expiresAt =
    typeof data.expires_at === "number" ? data.expires_at * 1000 : Date.now() + 30 * 60 * 1000; // 30 minutes default

  return { token, expiresAt };
}

/** Fetch the authenticated GitHub user info for account labelling */
async function fetchGitHubUser(
  githubToken: string,
): Promise<{ login: string; name?: string; email?: string }> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${githubToken}` },
    });
    if (!response.ok) return { login: "unknown" };
    return (await response.json()) as { login: string; name?: string; email?: string };
  } catch {
    return { login: "unknown" };
  }
}

export class GitHubCopilotProvider implements Provider {
  readonly config = GITHUB_COPILOT_CONFIG;
  constructor(private readonly adapters: AuthFlowAdapters) {}

  async login(options?: LoginOptions): Promise<TokenSet> {
    // Step 1: Device Code Flow → GitHub OAuth access token
    const githubTokenSet = await executeDeviceCodeFlow({
      config: this.config,
      adapters: this.adapters,
      loginOptions: options,
    });

    const githubToken = githubTokenSet.accessToken;

    // Step 2: Exchange for a short-lived Copilot session token
    const session = await fetchCopilotSessionToken(githubToken);

    // Step 3: Fetch user info for account identity (best-effort)
    const user = await fetchGitHubUser(githubToken);

    return {
      // The access token exposed to callers is the Copilot session token (~30 min)
      accessToken: session.token,
      // The refresh token is the GitHub OAuth token, used to get new session tokens
      refreshToken: githubToken,
      expiresAt: session.expiresAt,
      tokenType: "bearer",
      scopes: githubTokenSet.scopes,
      raw: {
        githubToken,
        githubRefreshToken: githubTokenSet.refreshToken,
        login: user.login,
        name: user.name,
        email: user.email,
      },
    };
  }

  /** Refresh by exchanging the stored GitHub OAuth token for a new Copilot session token */
  async refresh(refreshToken: string): Promise<TokenSet> {
    // refreshToken here is the GitHub OAuth access token (set during login)
    const session = await fetchCopilotSessionToken(refreshToken);

    return {
      accessToken: session.token,
      refreshToken, // Preserve the GitHub OAuth token for the next refresh
      expiresAt: session.expiresAt,
      tokenType: "bearer",
    };
  }

  getAuthHeaders(accessToken: string): AuthHeaders {
    return {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    };
  }

  async getAccountId(tokenSet: TokenSet): Promise<string> {
    // Prefer GitHub login name (set during login in raw)
    if (
      tokenSet.raw?.login &&
      typeof tokenSet.raw.login === "string" &&
      tokenSet.raw.login !== "unknown"
    ) {
      return tokenSet.raw.login;
    }
    // Fall back to hash of the GitHub OAuth token (refreshToken)
    const source = tokenSet.refreshToken ?? tokenSet.accessToken;
    return (await sha256Hex(source)).slice(0, 16);
  }

  getAccountLabel(tokenSet: TokenSet): string | undefined {
    if (tokenSet.raw?.name && typeof tokenSet.raw.name === "string") {
      return tokenSet.raw.name;
    }
    if (
      tokenSet.raw?.login &&
      typeof tokenSet.raw.login === "string" &&
      tokenSet.raw.login !== "unknown"
    ) {
      return tokenSet.raw.login;
    }
    return undefined;
  }
}
