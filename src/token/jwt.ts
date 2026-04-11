/** Decoded JWT claims (no signature verification) */
export interface JWTClaims {
  sub?: string;
  email?: string;
  name?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Decode a JWT token's payload without verifying the signature.
 * Used to extract user info from id_tokens (e.g., OpenAI).
 */
export function decodeJWT(token: string): JWTClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format: expected 3 parts");
  }

  const payload = parts[1];
  if (!payload) {
    throw new Error("Invalid JWT: empty payload");
  }

  // Add padding if needed for base64url decoding
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Buffer.from(padded, "base64").toString("utf8");

  return JSON.parse(decoded) as JWTClaims;
}
