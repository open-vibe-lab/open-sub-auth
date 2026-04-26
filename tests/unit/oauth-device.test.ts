import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { OAuthCallbackError, OAuthTimeoutError } from "@/errors.ts";
import { pollForToken, requestDeviceCode } from "@/core/device-flow.ts";
import type { ProviderConfig } from "@/types.ts";

const TEST_CONFIG: ProviderConfig = {
  name: "test-device",
  displayName: "Test Device Provider",
  tokenEndpoint: "https://auth.example.com/oauth/token",
  deviceCodeEndpoint: "https://auth.example.com/device/code",
  clientId: "test-client-id",
  scopes: ["read", "write"],
  grantType: "device_code",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestDeviceCode", () => {
  it("returns device code info on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          device_code: "dev-code-abc",
          user_code: "ABCD-EFGH",
          verification_uri: "https://auth.example.com/activate",
          verification_uri_complete: "https://auth.example.com/activate?code=ABCD-EFGH",
          expires_in: 900,
          interval: 5,
        }),
      }),
    );

    const result = await requestDeviceCode(TEST_CONFIG);

    expect(result.deviceCode).toBe("dev-code-abc");
    expect(result.userCode).toBe("ABCD-EFGH");
    expect(result.verificationUri).toBe("https://auth.example.com/activate");
    expect(result.verificationUriComplete).toBe("https://auth.example.com/activate?code=ABCD-EFGH");
    expect(result.expiresIn).toBe(900);
    expect(result.interval).toBe(5);
  });

  it("sends scope parameter when scopes are configured", async () => {
    let capturedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementationOnce(async (_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return {
          ok: true,
          json: async () => ({
            device_code: "dev",
            user_code: "CODE",
            verification_uri: "https://example.com",
            expires_in: 900,
            interval: 5,
          }),
        };
      }),
    );

    await requestDeviceCode(TEST_CONFIG);
    expect(capturedBody).toContain("scope=read+write");
  });

  it("throws when deviceCodeEndpoint is missing", async () => {
    const configNoEndpoint: ProviderConfig = { ...TEST_CONFIG, deviceCodeEndpoint: undefined };
    await expect(requestDeviceCode(configNoEndpoint)).rejects.toThrow(OAuthCallbackError);
    await expect(requestDeviceCode(configNoEndpoint)).rejects.toThrow(
      "has no device code endpoint",
    );
  });

  it("throws on HTTP error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      }),
    );

    await expect(requestDeviceCode(TEST_CONFIG)).rejects.toThrow(
      "Device code request failed (HTTP 400)",
    );
  });

  it("throws when response is missing required fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ device_code: "dev" }), // missing user_code and verification_uri
      }),
    );

    await expect(requestDeviceCode(TEST_CONFIG)).rejects.toThrow("missing required fields");
  });
});

describe("pollForToken", () => {
  it("returns token set when authorization succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "gho_test_token",
          token_type: "bearer",
          scope: "gist",
        }),
      }),
    );

    const result = await pollForToken(TEST_CONFIG, "dev-code", 0, 900);

    expect(result.accessToken).toBe("gho_test_token");
    expect(result.tokenType).toBe("bearer");
    expect(result.refreshToken).toBeNull();
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it("retries on authorization_pending then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "authorization_pending" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "gho_final_token",
          token_type: "bearer",
          scope: "gist",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await pollForToken(TEST_CONFIG, "dev-code", 0, 900);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.accessToken).toBe("gho_final_token");
  });

  it("increases interval on slow_down error", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "slow_down" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "gho_token",
          token_type: "bearer",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    // Run the polling loop, advancing fake timers past each sleep
    const pollPromise = pollForToken(TEST_CONFIG, "dev-code", 0, 900);
    // Advance past slow_down sleep (0ms initial, but after slow_down it's 5000ms)
    await vi.runAllTimersAsync();
    const result = await pollPromise;

    expect(result.accessToken).toBe("gho_token");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("throws OAuthTimeoutError on expired_token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "expired_token" }),
      }),
    );

    await expect(pollForToken(TEST_CONFIG, "dev-code", 0, 900)).rejects.toThrow(OAuthTimeoutError);
  });

  it("throws OAuthCallbackError on access_denied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "access_denied" }),
      }),
    );

    await expect(pollForToken(TEST_CONFIG, "dev-code", 0, 900)).rejects.toThrow(
      "User denied device authorization",
    );
  });

  it("throws OAuthCallbackError on unknown error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: "some_unknown_error" }),
      }),
    );

    await expect(pollForToken(TEST_CONFIG, "dev-code", 0, 900)).rejects.toThrow(OAuthCallbackError);
  });

  it("includes refresh_token when present in response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "gho_token",
          refresh_token: "ghr_refresh",
          token_type: "bearer",
          expires_in: 28800,
        }),
      }),
    );

    const result = await pollForToken(TEST_CONFIG, "dev-code", 0, 900);

    expect(result.accessToken).toBe("gho_token");
    expect(result.refreshToken).toBe("ghr_refresh");
    expect(result.expiresAt).toBeGreaterThan(Date.now() + 28799 * 1000);
  });

  it("parses comma-separated scopes from GitHub response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "gho_token",
          token_type: "bearer",
          scope: "gist,user",
        }),
      }),
    );

    const result = await pollForToken(TEST_CONFIG, "dev-code", 0, 900);
    expect(result.scopes).toEqual(["gist", "user"]);
  });
});
