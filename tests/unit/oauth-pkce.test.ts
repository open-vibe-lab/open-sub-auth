import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { startCallbackServer } from "@/core/callback-server.ts";
import { parseCodeAndState } from "@/core/manual-code-input.ts";
import { buildAuthorizationUrl, exchangeCode, refreshAccessToken } from "@/core/oauth-pkce.ts";
import type { ProviderConfig } from "@/types.ts";

const TEST_CONFIG: ProviderConfig = {
  name: "test",
  displayName: "Test Provider",
  authorizationEndpoint: "https://auth.example.com/authorize",
  tokenEndpoint: "https://auth.example.com/token",
  clientId: "test-client-id",
  redirectUri: "http://localhost:3000/callback",
  scopes: ["openid", "profile"],
  grantType: "authorization_code",
};

describe("buildAuthorizationUrl", () => {
  it("includes all required parameters", () => {
    const url = buildAuthorizationUrl(
      TEST_CONFIG,
      "test-challenge",
      "test-state",
      "http://localhost:3000/callback",
    );
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://auth.example.com");
    expect(parsed.pathname).toBe("/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:3000/callback");
    expect(parsed.searchParams.get("code_challenge")).toBe("test-challenge");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe("test-state");
    expect(parsed.searchParams.get("scope")).toBe("openid profile");
  });

  it("omits scope when no scopes configured", () => {
    const configNoScopes = { ...TEST_CONFIG, scopes: undefined };
    const url = buildAuthorizationUrl(configNoScopes, "challenge", "state", "http://localhost/cb");
    const parsed = new URL(url);
    expect(parsed.searchParams.has("scope")).toBe(false);
  });
});

describe("parseCodeAndState", () => {
  it("parses code#state format correctly", () => {
    const result = parseCodeAndState("mycode123#mystate456", "mystate456");
    expect(result.code).toBe("mycode123");
    expect(result.state).toBe("mystate456");
  });

  it("accepts plain code when no # is present", () => {
    const result = parseCodeAndState("mycode123", "expected-state");
    expect(result.code).toBe("mycode123");
    expect(result.state).toBe("expected-state");
  });

  it("trims whitespace from input", () => {
    const result = parseCodeAndState("  mycode#mystate  ", "mystate");
    expect(result.code).toBe("mycode");
    expect(result.state).toBe("mystate");
  });

  it("throws on empty input", () => {
    expect(() => parseCodeAndState("", "state")).toThrow("Empty authorization code");
  });

  it("throws on state mismatch", () => {
    expect(() => parseCodeAndState("code#wrong-state", "expected-state")).toThrow(
      "state parameter mismatch",
    );
  });

  it("throws when code is empty before #", () => {
    expect(() => parseCodeAndState("#state", "state")).toThrow("Empty authorization code");
  });
});

const JSON_CONFIG: ProviderConfig = {
  ...TEST_CONFIG,
  tokenBodyFormat: "json",
  stateIsVerifier: true,
};

const MOCK_TOKEN_RESPONSE = {
  access_token: "new-access-token",
  refresh_token: "new-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
};

describe("refreshAccessToken", () => {
  afterEach(() => vi.unstubAllGlobals());

  function mockFetch() {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return new Response(JSON.stringify(MOCK_TOKEN_RESPONSE), { status: 200 });
      }),
    );
    return {
      get url() {
        return capturedUrl;
      },
      get init() {
        return capturedInit;
      },
    };
  }

  it("sends form-encoded body by default", async () => {
    const captured = mockFetch();
    await refreshAccessToken(TEST_CONFIG, "test-refresh-token");

    const params = new URLSearchParams(captured.init!.body as string);
    const headers = captured.init!.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("test-refresh-token");
    expect(params.get("client_id")).toBe("test-client-id");
  });

  it("sends JSON body when tokenBodyFormat is json", async () => {
    const captured = mockFetch();
    await refreshAccessToken(JSON_CONFIG, "test-refresh-token");

    const body = JSON.parse(captured.init!.body as string);
    const headers = captured.init!.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(body.grant_type).toBe("refresh_token");
    expect(body.refresh_token).toBe("test-refresh-token");
    expect(body.client_id).toBe("test-client-id");
  });
});

describe("exchangeCode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends JSON body with state when tokenBodyFormat is json", async () => {
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedInit = init;
        return new Response(JSON.stringify(MOCK_TOKEN_RESPONSE), { status: 200 });
      }),
    );

    await exchangeCode(
      JSON_CONFIG,
      "auth-code",
      "code-verifier",
      "https://console.anthropic.com/oauth/code/callback",
      "the-state",
    );

    const body = JSON.parse(capturedInit!.body as string);
    const headers = capturedInit!.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(body.grant_type).toBe("authorization_code");
    expect(body.code).toBe("auth-code");
    expect(body.code_verifier).toBe("code-verifier");
    expect(body.state).toBe("the-state");
  });
});

describe("startCallbackServer", () => {
  it("captures authorization code from GET request", async () => {
    const server = await startCallbackServer({
      expectedState: "test-state",
      port: 0,
    });

    // Make a request to the callback
    const url = `http://127.0.0.1:${server.port}/callback?code=test-code&state=test-state`;
    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const result = await server.result;
    expect(result.code).toBe("test-code");
    expect(result.state).toBe("test-state");
  });

  it("rejects on state mismatch", async () => {
    const server = await startCallbackServer({
      expectedState: "expected",
      port: 0,
    });

    // Attach catch handler early to prevent unhandled rejection
    const resultPromise = server.result.catch((e) => e);

    const url = `http://127.0.0.1:${server.port}/callback?code=test-code&state=wrong`;
    await fetch(url);

    const error = await resultPromise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("State mismatch");
  });

  it("rejects on OAuth error response", async () => {
    const server = await startCallbackServer({
      expectedState: "state",
      port: 0,
    });

    const resultPromise = server.result.catch((e) => e);

    const url = `http://127.0.0.1:${server.port}/callback?error=access_denied&error_description=User+denied`;
    await fetch(url);

    const error = await resultPromise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("User denied");
  });

  it("returns 404 for non-callback paths", async () => {
    const server = await startCallbackServer({
      expectedState: "state",
      port: 0,
    });

    const response = await fetch(`http://127.0.0.1:${server.port}/other`);
    expect(response.status).toBe(404);
    server.close();
  });

  it("rejects on missing code", async () => {
    const server = await startCallbackServer({
      expectedState: "state",
      port: 0,
    });

    const resultPromise = server.result.catch((e) => e);

    const url = `http://127.0.0.1:${server.port}/callback?state=state`;
    await fetch(url);

    const error = await resultPromise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("No authorization code");
  });
});
