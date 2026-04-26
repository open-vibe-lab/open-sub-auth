import type { TokenSet } from "@/types.ts";

/**
 * Import a GitHub OAuth token from the COPILOT_GITHUB_TOKEN environment variable.
 * The GitHub OAuth token becomes the refresh token; the expired access token forces an
 * immediate Copilot session token fetch on the first call to getToken().
 */
export function importCopilotTokenFromEnv(): TokenSet | null {
  const token = process.env.COPILOT_GITHUB_TOKEN;
  if (!token) return null;
  return {
    accessToken: "", // Expired — getToken() will call refresh() to obtain a session token
    refreshToken: token, // GitHub OAuth token used to obtain Copilot session tokens
    expiresAt: 0,
    tokenType: "bearer",
  };
}
