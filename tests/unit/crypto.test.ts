import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generatePKCE,
  generateState,
  sha256Hex,
} from "@/core/crypto.ts";

describe("generateCodeVerifier", () => {
  it("returns a base64url string of correct length", () => {
    const verifier = generateCodeVerifier();
    // 32 random bytes → 43 base64url chars
    expect(verifier).toHaveLength(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique values", () => {
    const verifiers = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(100);
  });
});

describe("generateCodeChallenge", () => {
  it("produces correct S256 challenge from verifier (matches node:crypto)", async () => {
    const verifier = "test-verifier-value";
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(await generateCodeChallenge(verifier)).toBe(expected);
  });

  it("produces different challenges for different verifiers", async () => {
    const c1 = await generateCodeChallenge("verifier-1");
    const c2 = await generateCodeChallenge("verifier-2");
    expect(c1).not.toBe(c2);
  });
});

describe("generatePKCE", () => {
  it("returns matching verifier and challenge pair", async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const expectedChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    expect(codeChallenge).toBe(expectedChallenge);
  });
});

describe("generateState", () => {
  it("returns a base64url string", () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 random bytes → 43 base64url chars
    expect(state).toHaveLength(43);
  });

  it("generates unique values", () => {
    const states = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(states.size).toBe(100);
  });
});

describe("sha256Hex", () => {
  it("matches node:crypto SHA-256 hex output", async () => {
    const input = "the quick brown fox";
    const expected = createHash("sha256").update(input).digest("hex");
    expect(await sha256Hex(input)).toBe(expected);
  });
});
