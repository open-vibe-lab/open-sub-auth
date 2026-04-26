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

  // base64url → base64, then pad to a multiple of 4
  let b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);

  // atob produces a binary string; decode as UTF-8 via TextDecoder for non-ASCII safety
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const decoded = new TextDecoder().decode(bytes);

  return JSON.parse(decoded) as JWTClaims;
}
