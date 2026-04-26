import type { PKCEParams } from "@/types.ts";

/** Encode bytes as base64url (RFC 4648 §5, no padding). */
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  // btoa is available in Node ≥ 16 and all browsers/workers
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Encode bytes as lowercase hex. */
function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Generate a cryptographically random PKCE code verifier (43 chars, base64url). */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** Generate a PKCE code challenge from a verifier using S256 method. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(digest));
}

/** Generate both PKCE code verifier and challenge. */
export async function generatePKCE(): Promise<PKCEParams> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

/** Generate a random state parameter for CSRF protection. */
export function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** Compute SHA-256 of a UTF-8 string and return lowercase hex. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}
