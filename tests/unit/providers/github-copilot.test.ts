import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { GitHubCopilotProvider } from "@/providers/github-copilot.ts";
import type { TokenSet } from "@/types.ts";

describe("GitHubCopilotProvider", () => {
  const provider = new GitHubCopilotProvider();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("config", () => {
    it("has correct provider name", () => {
      expect(provider.config.name).toBe("github-copilot");
    });

    it("has correct device code endpoint", () => {
      expect(provider.config.deviceCodeEndpoint).toBe("https://github.com/login/device/code");
    });

    it("has correct token endpoint", () => {
      expect(provider.config.tokenEndpoint).toBe("https://github.com/login/oauth/access_token");
    });

    it("has correct client ID", () => {
      expect(provider.config.clientId).toBe("Iv1.b507a08c87ecfe98");
    });

    it("uses device_code grant type", () => {
      expect(provider.config.grantType).toBe("device_code");
    });

    it("requests gist scope", () => {
      expect(provider.config.scopes).toEqual(["gist"]);
    });
  });

  describe("getAuthHeaders", () => {
    it("uses Authorization: Bearer header", () => {
      const headers = provider.getAuthHeaders("copilot-session-token");
      expect(headers.authorization).toBe("Bearer copilot-session-token");
    });

    it("includes content-type", () => {
      const headers = provider.getAuthHeaders("token");
      expect(headers["content-type"]).toBe("application/json");
    });
  });

  describe("getAccountId", () => {
    it("uses GitHub login from raw field when available", () => {
      const tokenSet: TokenSet = {
        accessToken: "session-token",
        refreshToken: "gho_github_token",
        expiresAt: Date.now() + 3600_000,
        tokenType: "bearer",
        raw: { login: "octocat" },
      };
      expect(provider.getAccountId(tokenSet)).toBe("octocat");
    });

    it("falls back to refresh token hash when login is unknown", () => {
      const tokenSet: TokenSet = {
        accessToken: "session-token",
        refreshToken: "gho_github_token",
        expiresAt: Date.now() + 3600_000,
        tokenType: "bearer",
        raw: { login: "unknown" },
      };
      const id = provider.getAccountId(tokenSet);
      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]+$/);
    });

    it("falls back to refresh token hash when no raw field", () => {
      const tokenSet: TokenSet = {
        accessToken: "session-token",
        refreshToken: "gho_github_token",
        expiresAt: 0,
        tokenType: "bearer",
      };
      const id = provider.getAccountId(tokenSet);
      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]+$/);
    });

    it("falls back to access token hash when no refresh token", () => {
      const tokenSet: TokenSet = {
        accessToken: "session-token",
        refreshToken: null,
        expiresAt: 0,
        tokenType: "bearer",
      };
      const id = provider.getAccountId(tokenSet);
      expect(id).toHaveLength(16);
    });

    it("returns same ID for same GitHub login", () => {
      const ts1: TokenSet = {
        accessToken: "session-a",
        refreshToken: "github-a",
        expiresAt: 0,
        tokenType: "bearer",
        raw: { login: "octocat" },
      };
      const ts2: TokenSet = {
        accessToken: "session-b",
        refreshToken: "github-b",
        expiresAt: 0,
        tokenType: "bearer",
        raw: { login: "octocat" },
      };
      expect(provider.getAccountId(ts1)).toBe(provider.getAccountId(ts2));
    });
  });

  describe("getAccountLabel", () => {
    it("returns name from raw field when available", () => {
      const tokenSet: TokenSet = {
        accessToken: "token",
        refreshToken: null,
        expiresAt: 0,
        tokenType: "bearer",
        raw: { login: "octocat", name: "The Octocat" },
      };
      expect(provider.getAccountLabel(tokenSet)).toBe("The Octocat");
    });

    it("falls back to login when no name", () => {
      const tokenSet: TokenSet = {
        accessToken: "token",
        refreshToken: null,
        expiresAt: 0,
        tokenType: "bearer",
        raw: { login: "octocat" },
      };
      expect(provider.getAccountLabel(tokenSet)).toBe("octocat");
    });

    it("returns undefined when no raw or unknown login", () => {
      const tokenSet: TokenSet = {
        accessToken: "token",
        refreshToken: null,
        expiresAt: 0,
        tokenType: "bearer",
        raw: { login: "unknown" },
      };
      expect(provider.getAccountLabel(tokenSet)).toBeUndefined();
    });

    it("returns undefined when no raw field", () => {
      const tokenSet: TokenSet = {
        accessToken: "token",
        refreshToken: null,
        expiresAt: 0,
        tokenType: "bearer",
      };
      expect(provider.getAccountLabel(tokenSet)).toBeUndefined();
    });
  });

  describe("refresh", () => {
    it("fetches a new Copilot session token using the GitHub OAuth token", async () => {
      const mockSessionToken = "tid=abc123;exp=...";
      const futureExpiry = Math.floor(Date.now() / 1000) + 1800;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: mockSessionToken, expires_at: futureExpiry }),
        }),
      );

      const result = await provider.refresh("gho_github_token");

      expect(result.accessToken).toBe(mockSessionToken);
      expect(result.refreshToken).toBe("gho_github_token");
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.tokenType).toBe("bearer");
    });

    it("throws when Copilot session token fetch fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => "Unauthorized",
        }),
      );

      await expect(provider.refresh("invalid-token")).rejects.toThrow(
        "Copilot session token request failed (401)",
      );
    });
  });
});
