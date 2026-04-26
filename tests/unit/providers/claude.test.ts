import { describe, expect, it } from "vite-plus/test";
import { ClaudeProvider } from "@/core/providers/claude.ts";
import type { TokenSet } from "@/types.ts";
import { stubAdapters } from "../_stub-adapters.ts";

describe("ClaudeProvider", () => {
  const provider = new ClaudeProvider(stubAdapters);

  describe("config", () => {
    it("has correct provider name", () => {
      expect(provider.config.name).toBe("claude");
    });

    it("has correct authorization endpoint", () => {
      expect(provider.config.authorizationEndpoint).toBe("https://claude.ai/oauth/authorize");
    });

    it("has correct token endpoint", () => {
      expect(provider.config.tokenEndpoint).toBe("https://console.anthropic.com/v1/oauth/token");
    });

    it("has correct client ID", () => {
      expect(provider.config.clientId).toBe("9d1c250a-e61b-44d9-88ed-5944d1962f5e");
    });

    it("uses authorization_code grant type", () => {
      expect(provider.config.grantType).toBe("authorization_code");
    });
  });

  describe("getAuthHeaders", () => {
    it("uses Authorization Bearer header (not x-api-key)", () => {
      const headers = provider.getAuthHeaders("sk-ant-oat01-test-token");
      expect(headers["authorization"]).toBe("Bearer sk-ant-oat01-test-token");
      expect(headers["x-api-key"]).toBeUndefined();
    });

    it("includes required anthropic headers", () => {
      const headers = provider.getAuthHeaders("test-token");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
      expect(headers["anthropic-beta"]).toBe("oauth-2025-04-20");
      expect(headers["content-type"]).toBe("application/json");
    });
  });

  describe("getAccountId", () => {
    it("derives account ID from refresh token hash", async () => {
      const tokenSet: TokenSet = {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        expiresAt: Date.now() + 3600_000,
        tokenType: "api-key",
      };
      const id = await provider.getAccountId(tokenSet);
      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]+$/);
    });

    it("falls back to access token when no refresh token", async () => {
      const tokenSet: TokenSet = {
        accessToken: "access-1",
        refreshToken: null,
        expiresAt: Date.now() + 3600_000,
        tokenType: "api-key",
      };
      const id = await provider.getAccountId(tokenSet);
      expect(id).toHaveLength(16);
    });

    it("returns same ID for same refresh token", async () => {
      const tokenSet1: TokenSet = {
        accessToken: "access-different-1",
        refreshToken: "same-refresh",
        expiresAt: Date.now(),
        tokenType: "api-key",
      };
      const tokenSet2: TokenSet = {
        accessToken: "access-different-2",
        refreshToken: "same-refresh",
        expiresAt: Date.now(),
        tokenType: "api-key",
      };
      expect(await provider.getAccountId(tokenSet1)).toBe(await provider.getAccountId(tokenSet2));
    });

    it("returns different IDs for different refresh tokens", async () => {
      const ts1: TokenSet = {
        accessToken: "a",
        refreshToken: "refresh-a",
        expiresAt: 0,
        tokenType: "api-key",
      };
      const ts2: TokenSet = {
        accessToken: "a",
        refreshToken: "refresh-b",
        expiresAt: 0,
        tokenType: "api-key",
      };
      expect(await provider.getAccountId(ts1)).not.toBe(await provider.getAccountId(ts2));
    });
  });

  describe("getAccountLabel", () => {
    it("returns undefined (Claude has no profile endpoint)", () => {
      const tokenSet: TokenSet = {
        accessToken: "test",
        refreshToken: null,
        expiresAt: 0,
        tokenType: "api-key",
      };
      expect(provider.getAccountLabel(tokenSet)).toBeUndefined();
    });
  });
});
