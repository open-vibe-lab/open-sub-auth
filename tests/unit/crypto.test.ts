import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	generateCodeChallenge,
	generateCodeVerifier,
	generatePKCE,
	generateState,
} from "../../src/core/crypto.js";

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
	it("produces correct S256 challenge from verifier", () => {
		const verifier = "test-verifier-value";
		const expected = createHash("sha256").update(verifier).digest("base64url");
		expect(generateCodeChallenge(verifier)).toBe(expected);
	});

	it("produces different challenges for different verifiers", () => {
		const c1 = generateCodeChallenge("verifier-1");
		const c2 = generateCodeChallenge("verifier-2");
		expect(c1).not.toBe(c2);
	});
});

describe("generatePKCE", () => {
	it("returns matching verifier and challenge pair", () => {
		const { codeVerifier, codeChallenge } = generatePKCE();
		const expectedChallenge = createHash("sha256")
			.update(codeVerifier)
			.digest("base64url");
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
