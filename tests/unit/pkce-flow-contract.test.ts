/**
 * Contract test: executePKCEFlow must work with ANY AuthFlowAdapters bundle,
 * not just the Node implementation. This proves the core layer is truly
 * runtime-agnostic — a Chrome extension / Worker / Deno adapter that satisfies
 * the same interfaces will compose without changes to core.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AuthFlowAdapters } from "@/core/abstractions/index.ts";
import { executePKCEFlow } from "@/core/pkce-flow.ts";
import type { ProviderConfig } from "@/types.ts";

const TEST_CONFIG: ProviderConfig = {
  name: "test",
  displayName: "Test Provider",
  authorizationEndpoint: "https://auth.example.com/authorize",
  tokenEndpoint: "https://auth.example.com/token",
  clientId: "test-client",
  scopes: ["openid"],
  grantType: "authorization_code",
};

const MOCK_TOKEN_RESPONSE = {
  access_token: "the-access-token",
  refresh_token: "the-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
};

afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(MOCK_TOKEN_RESPONSE), { status: 200 })),
  );
}

describe("executePKCEFlow with custom adapters (contract)", () => {
  it("automatic mode: uses CallbackReceiver, opens browser, exchanges code", async () => {
    stubFetch();
    const opened: string[] = [];
    let observedExpectedState = "";

    const adapters: AuthFlowAdapters = {
      browser: {
        open(url) {
          opened.push(url);
        },
      },
      callback: {
        async listen({ expectedState }) {
          observedExpectedState = expectedState;
          return {
            redirectUri: "https://my-platform/callback",
            result: Promise.resolve({ code: "auth-code-from-platform", state: expectedState }),
            close() {},
          };
        },
      },
    };

    const tokens = await executePKCEFlow({ config: TEST_CONFIG, adapters });

    expect(tokens.accessToken).toBe("the-access-token");
    expect(tokens.refreshToken).toBe("the-refresh-token");
    expect(opened).toHaveLength(1);
    const authUrl = new URL(opened[0]!);
    expect(authUrl.searchParams.get("redirect_uri")).toBe("https://my-platform/callback");
    expect(authUrl.searchParams.get("state")).toBe(observedExpectedState);
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("manual mode: uses CodePrompter, opens browser, exchanges code", async () => {
    stubFetch();
    const opened: string[] = [];

    const adapters: AuthFlowAdapters = {
      browser: {
        open(url) {
          opened.push(url);
        },
      },
      codePrompt: {
        async promptForCode(expectedState) {
          return { code: "manually-pasted-code", state: expectedState };
        },
      },
    };

    const tokens = await executePKCEFlow({
      config: TEST_CONFIG,
      adapters,
      loginOptions: { manual: true },
      manualRedirectUri: "https://provider.example/callback",
    });

    expect(tokens.accessToken).toBe("the-access-token");
    const authUrl = new URL(opened[0]!);
    expect(authUrl.searchParams.get("redirect_uri")).toBe("https://provider.example/callback");
  });

  it("automatic mode without callback adapter throws", async () => {
    const adapters: AuthFlowAdapters = {
      browser: { open() {} },
      // intentionally no callback
    };

    await expect(executePKCEFlow({ config: TEST_CONFIG, adapters })).rejects.toThrow(
      /Automatic mode requires a CallbackReceiver/,
    );
  });

  it("manual mode without codePrompt adapter throws", async () => {
    const adapters: AuthFlowAdapters = {
      browser: { open() {} },
      // intentionally no codePrompt
    };

    await expect(
      executePKCEFlow({
        config: TEST_CONFIG,
        adapters,
        loginOptions: { manual: true },
        manualRedirectUri: "https://provider/cb",
      }),
    ).rejects.toThrow(/Manual mode requires a CodePrompter/);
  });

  it("propagates loginOptions.port to CallbackReceiver as a hint", async () => {
    stubFetch();
    let observedPort: number | undefined;

    const adapters: AuthFlowAdapters = {
      browser: { open() {} },
      callback: {
        async listen({ expectedState, port }) {
          observedPort = port;
          return {
            redirectUri: `http://127.0.0.1:${port ?? 0}/callback`,
            result: Promise.resolve({ code: "c", state: expectedState }),
            close() {},
          };
        },
      },
    };

    await executePKCEFlow({
      config: TEST_CONFIG,
      adapters,
      loginOptions: { port: 1455 },
    });

    expect(observedPort).toBe(1455);
  });

  it("loginOptions.onOpenBrowser overrides adapter's browser.open", async () => {
    stubFetch();
    const adapterCalls: string[] = [];
    const onOpenCalls: string[] = [];

    const adapters: AuthFlowAdapters = {
      browser: {
        open(url) {
          adapterCalls.push(url);
        },
      },
      callback: {
        async listen({ expectedState }) {
          return {
            redirectUri: "https://cb",
            result: Promise.resolve({ code: "c", state: expectedState }),
            close() {},
          };
        },
      },
    };

    await executePKCEFlow({
      config: TEST_CONFIG,
      adapters,
      loginOptions: {
        onOpenBrowser(url) {
          onOpenCalls.push(url);
        },
      },
    });

    expect(adapterCalls).toHaveLength(0);
    expect(onOpenCalls).toHaveLength(1);
  });
});
