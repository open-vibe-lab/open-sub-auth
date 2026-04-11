import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	OpenAICodexProvider,
	importFromCodexCli,
} from "../../../src/providers/openai-codex.js";
import type { TokenSet } from "../../../src/types.js";

describe("OpenAICodexProvider", () => {
	const provider = new OpenAICodexProvider();

	describe("config", () => {
		it("has correct provider name", () => {
			expect(provider.config.name).toBe("openai-codex");
		});

		it("has correct authorization endpoint", () => {
			expect(provider.config.authorizationEndpoint).toBe(
				"https://auth.openai.com/oauth/authorize",
			);
		});

		it("has correct token endpoint", () => {
			expect(provider.config.tokenEndpoint).toBe(
				"https://auth.openai.com/oauth/token",
			);
		});

		it("has correct client ID", () => {
			expect(provider.config.clientId).toBe("app_EMoamEEZ73f0CkXaXp7hrann");
		});

		it("requests correct scopes", () => {
			expect(provider.config.scopes).toEqual([
				"openid",
				"profile",
				"email",
				"offline_access",
			]);
		});
	});

	describe("getAuthHeaders", () => {
		it("uses Authorization: Bearer header", () => {
			const headers = provider.getAuthHeaders("test-token");
			expect(headers.authorization).toBe("Bearer test-token");
		});

		it("includes content-type", () => {
			const headers = provider.getAuthHeaders("test-token");
			expect(headers["content-type"]).toBe("application/json");
		});
	});

	describe("getAccountId", () => {
		it("extracts sub from JWT id_token", () => {
			const payload = Buffer.from(JSON.stringify({ sub: "user-abc123" })).toString(
				"base64url",
			);
			const idToken = `header.${payload}.signature`;

			const tokenSet: TokenSet = {
				accessToken: "access",
				refreshToken: null,
				expiresAt: 0,
				idToken,
				tokenType: "bearer",
			};

			expect(provider.getAccountId(tokenSet)).toBe("user-abc123");
		});

		it("falls back to access token hash when no id_token", () => {
			const tokenSet: TokenSet = {
				accessToken: "access-token-value",
				refreshToken: null,
				expiresAt: 0,
				tokenType: "bearer",
			};

			const id = provider.getAccountId(tokenSet);
			expect(id).toHaveLength(16);
			expect(id).toMatch(/^[0-9a-f]+$/);
		});
	});

	describe("getAccountLabel", () => {
		it("extracts email from JWT id_token", () => {
			const payload = Buffer.from(
				JSON.stringify({ email: "user@example.com" }),
			).toString("base64url");
			const idToken = `header.${payload}.signature`;

			const tokenSet: TokenSet = {
				accessToken: "access",
				refreshToken: null,
				expiresAt: 0,
				idToken,
				tokenType: "bearer",
			};

			expect(provider.getAccountLabel(tokenSet)).toBe("user@example.com");
		});

		it("returns undefined when no id_token", () => {
			const tokenSet: TokenSet = {
				accessToken: "access",
				refreshToken: null,
				expiresAt: 0,
				tokenType: "bearer",
			};

			expect(provider.getAccountLabel(tokenSet)).toBeUndefined();
		});
	});
});

describe("importFromCodexCli", () => {
	let tmpDir: string;
	let origEnv: string | undefined;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "osa-codex-import-"));
		origEnv = process.env.CODEX_HOME;
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
		if (origEnv !== undefined) {
			process.env.CODEX_HOME = origEnv;
		} else {
			delete process.env.CODEX_HOME;
		}
	});

	it("imports tokens from CODEX_HOME/auth.json", () => {
		process.env.CODEX_HOME = tmpDir;
		writeFileSync(
			join(tmpDir, "auth.json"),
			JSON.stringify({
				auth_mode: "chatgpt",
				tokens: {
					access_token: "imported-access",
					refresh_token: "imported-refresh",
					id_token: "imported-id",
				},
			}),
		);

		const result = importFromCodexCli();
		expect(result).not.toBeNull();
		expect(result!.accessToken).toBe("imported-access");
		expect(result!.refreshToken).toBe("imported-refresh");
		expect(result!.idToken).toBe("imported-id");
	});

	it("returns null when no auth.json exists", () => {
		process.env.CODEX_HOME = join(tmpDir, "nonexistent");
		const result = importFromCodexCli();
		expect(result).toBeNull();
	});

	it("returns null on malformed JSON", () => {
		process.env.CODEX_HOME = tmpDir;
		writeFileSync(join(tmpDir, "auth.json"), "not-json");

		const result = importFromCodexCli();
		expect(result).toBeNull();
	});
});
