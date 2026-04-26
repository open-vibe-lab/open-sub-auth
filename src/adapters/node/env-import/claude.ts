import type { TokenSet } from "@/types.ts";

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
