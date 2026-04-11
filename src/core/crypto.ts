import { createHash, randomBytes } from "node:crypto";
import type { PKCEParams } from "@/types.ts";

/** Generate a cryptographically random PKCE code verifier (43-128 chars, base64url) */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** Generate a PKCE code challenge from a verifier using S256 method */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Generate both PKCE code verifier and challenge */
export function generatePKCE(): PKCEParams {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

/** Generate a random state parameter for CSRF protection */
export function generateState(): string {
  return randomBytes(32).toString("base64url");
}
