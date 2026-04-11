import { afterEach, describe, expect, it } from "vite-plus/test";
import { importClaudeTokenFromEnv } from "@/providers/claude.ts";
import { importCopilotTokenFromEnv } from "@/providers/github-copilot.ts";

afterEach(() => {
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  delete process.env.COPILOT_GITHUB_TOKEN;
});

describe("importClaudeTokenFromEnv", () => {
  it("returns null when CLAUDE_CODE_OAUTH_TOKEN is not set", () => {
    expect(importClaudeTokenFromEnv()).toBeNull();
  });

  it("returns a TokenSet when CLAUDE_CODE_OAUTH_TOKEN is set", () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "sk-ant-oauth-token";
    const tokenSet = importClaudeTokenFromEnv();
    expect(tokenSet).not.toBeNull();
    expect(tokenSet!.accessToken).toBe("sk-ant-oauth-token");
    expect(tokenSet!.refreshToken).toBeNull();
    expect(tokenSet!.tokenType).toBe("bearer");
    expect(tokenSet!.expiresAt).toBeGreaterThan(Date.now());
  });

  it("uses the token directly as the access token", () => {
    const myToken = "sk-ant-ocp-test-12345";
    process.env.CLAUDE_CODE_OAUTH_TOKEN = myToken;
    const tokenSet = importClaudeTokenFromEnv();
    expect(tokenSet!.accessToken).toBe(myToken);
  });
});

describe("importCopilotTokenFromEnv", () => {
  it("returns null when COPILOT_GITHUB_TOKEN is not set", () => {
    expect(importCopilotTokenFromEnv()).toBeNull();
  });

  it("returns a TokenSet when COPILOT_GITHUB_TOKEN is set", () => {
    process.env.COPILOT_GITHUB_TOKEN = "gho_github_token_abc";
    const tokenSet = importCopilotTokenFromEnv();
    expect(tokenSet).not.toBeNull();
    expect(tokenSet!.refreshToken).toBe("gho_github_token_abc");
    expect(tokenSet!.tokenType).toBe("bearer");
  });

  it("sets expiresAt to 0 to force immediate refresh", () => {
    process.env.COPILOT_GITHUB_TOKEN = "gho_test";
    const tokenSet = importCopilotTokenFromEnv();
    expect(tokenSet!.expiresAt).toBe(0);
  });

  it("stores the GitHub OAuth token as the refresh token", () => {
    const githubToken = "gho_some_github_oauth_token";
    process.env.COPILOT_GITHUB_TOKEN = githubToken;
    const tokenSet = importCopilotTokenFromEnv();
    expect(tokenSet!.refreshToken).toBe(githubToken);
  });
});
