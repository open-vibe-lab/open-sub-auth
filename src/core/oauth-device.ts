import { OAuthCallbackError, OAuthTimeoutError } from "@/errors.ts";
import { openBrowser } from "@/core/browser.ts";
import type { DeviceCodeInfo, LoginOptions, ProviderConfig, TokenSet } from "@/types.ts";

export interface DeviceCodeFlowOptions {
  config: ProviderConfig;
  loginOptions?: LoginOptions;
}

/** Request a device code from the provider's device code endpoint */
export async function requestDeviceCode(config: ProviderConfig): Promise<{
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}> {
  if (!config.deviceCodeEndpoint) {
    throw new OAuthCallbackError(`Provider "${config.name}" has no device code endpoint`);
  }

  const params: Record<string, string> = {
    client_id: config.clientId,
  };
  if (config.scopes?.length) {
    params.scope = config.scopes.join(" ");
  }

  const useJson = config.tokenBodyFormat === "json";

  const response = await fetch(config.deviceCodeEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": useJson ? "application/json" : "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: useJson ? JSON.stringify(params) : new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new OAuthCallbackError(`Device code request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;

  const deviceCode = data.device_code as string | undefined;
  const userCode = data.user_code as string | undefined;
  const verificationUri = (data.verification_uri ?? data.verification_url) as string | undefined;

  if (!deviceCode || !userCode || !verificationUri) {
    throw new OAuthCallbackError("Invalid device code response: missing required fields");
  }

  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete: (data.verification_uri_complete ?? data.verification_url_complete) as
      | string
      | undefined,
    expiresIn: (data.expires_in as number | undefined) ?? 900,
    interval: (data.interval as number | undefined) ?? 5,
  };
}

/**
 * Poll the token endpoint until authorization is granted, denied, or times out.
 * Handles authorization_pending / slow_down / expired_token error codes per RFC 8628.
 */
export async function pollForToken(
  config: ProviderConfig,
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<TokenSet> {
  const params: Record<string, string> = {
    client_id: config.clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  };

  const useJson = config.tokenBodyFormat === "json";
  const deadline = Date.now() + expiresIn * 1000;
  let pollIntervalMs = interval * 1000;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    const response = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": useJson ? "application/json" : "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: useJson ? JSON.stringify(params) : new URLSearchParams(params).toString(),
    });

    // GitHub returns 200 even on "pending" errors, parse JSON regardless of status
    const data = (await response.json()) as Record<string, unknown>;

    if (data.access_token) {
      return parseDeviceTokenResponse(data);
    }

    const error = data.error as string | undefined;

    if (error === "authorization_pending") {
      continue;
    }
    if (error === "slow_down") {
      // Per RFC 8628: increase interval by 5 seconds and continue
      pollIntervalMs += 5000;
      continue;
    }
    if (error === "expired_token") {
      throw new OAuthTimeoutError(expiresIn * 1000);
    }
    if (error === "access_denied") {
      throw new OAuthCallbackError("User denied device authorization");
    }

    throw new OAuthCallbackError(`Device code token polling failed: ${error ?? "unknown error"}`);
  }

  throw new OAuthTimeoutError(expiresIn * 1000);
}

/** Execute the full device code flow: request code, display to user, poll for token */
export async function executeDeviceCodeFlow(options: DeviceCodeFlowOptions): Promise<TokenSet> {
  const { config, loginOptions } = options;

  const deviceCode = await requestDeviceCode(config);

  const displayInfo: DeviceCodeInfo = {
    userCode: deviceCode.userCode,
    verificationUri: deviceCode.verificationUri,
    expiresIn: deviceCode.expiresIn,
    interval: deviceCode.interval,
  };

  if (loginOptions?.onDeviceCode) {
    loginOptions.onDeviceCode(displayInfo);
  } else {
    // Open browser to the verification page and print instructions to stderr
    openBrowser(deviceCode.verificationUriComplete ?? deviceCode.verificationUri);
    process.stderr.write(
      `\nVisit: ${deviceCode.verificationUri}\nEnter code: ${deviceCode.userCode}\n\nWaiting for authorization...\n`,
    );
  }

  return pollForToken(config, deviceCode.deviceCode, deviceCode.interval, deviceCode.expiresIn);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse device code token response.
 * Note: GitHub uses comma-separated scopes (unlike space-separated in PKCE flow).
 */
function parseDeviceTokenResponse(data: Record<string, unknown>): TokenSet {
  const accessToken = data.access_token as string | undefined;
  if (!accessToken) {
    throw new OAuthCallbackError("No access_token in device code token response");
  }

  // GitHub OAuth App tokens may not include expires_in (they don't expire by default)
  const expiresIn = data.expires_in as number | undefined;
  const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : Date.now() + 8 * 3600 * 1000;

  // GitHub uses comma-separated scopes in device code responses
  const rawScope = data.scope as string | undefined;
  const scopes = rawScope ? rawScope.split(/[, ]+/).filter(Boolean) : undefined;

  return {
    accessToken,
    refreshToken: (data.refresh_token as string | undefined) ?? null,
    expiresAt,
    tokenType: ((data.token_type as string | undefined) ?? "bearer").toLowerCase() as
      | "bearer"
      | "api-key",
    scopes,
    raw: data,
  };
}
