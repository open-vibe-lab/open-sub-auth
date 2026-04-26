import type { AuthFlowAdapters } from "@/core/abstractions/index.ts";
import { generatePKCE, generateState } from "@/core/crypto.ts";
import { OAuthCallbackError } from "@/errors.ts";
import type { AuthorizationResult, LoginOptions, ProviderConfig, TokenSet } from "@/types.ts";

/** Build the full OAuth authorization URL with PKCE and state params */
export function buildAuthorizationUrl(
  config: ProviderConfig,
  codeChallenge: string,
  state: string,
  redirectUri: string,
): string {
  if (!config.authorizationEndpoint) {
    throw new OAuthCallbackError(`Provider "${config.name}" has no authorization endpoint`);
  }

  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);

  if (config.scopes?.length) {
    url.searchParams.set("scope", config.scopes.join(" "));
  }

  return url.toString();
}

/** Exchange an authorization code for tokens */
export async function exchangeCode(
  config: ProviderConfig,
  code: string,
  codeVerifier: string,
  redirectUri: string,
  state?: string,
): Promise<TokenSet> {
  const useJson = config.tokenBodyFormat === "json";

  const params: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    client_id: config.clientId,
    redirect_uri: redirectUri,
  };
  if (state !== undefined) {
    params.state = state;
  }

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": useJson ? "application/json" : "application/x-www-form-urlencoded" },
    body: useJson ? JSON.stringify(params) : new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    // Do not include the raw response body — it may contain sensitive OAuth debug info.
    // Consumers that need details should inspect the HTTP response directly.
    throw new OAuthCallbackError(`Token exchange failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return parseTokenResponse(data);
}

/** Refresh an access token using a refresh token */
export async function refreshAccessToken(
  config: ProviderConfig,
  refreshToken: string,
): Promise<TokenSet> {
  const useJson = config.tokenBodyFormat === "json";

  const params: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  };

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": useJson ? "application/json" : "application/x-www-form-urlencoded" },
    body: useJson ? JSON.stringify(params) : new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    throw new OAuthCallbackError(`Token refresh failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return parseTokenResponse(data);
}

export interface PKCEFlowOptions {
  config: ProviderConfig;
  /** Platform adapters for browser launching + callback/code handling */
  adapters: AuthFlowAdapters;
  loginOptions?: LoginOptions;
  /**
   * Manual mode redirect URI (used when manual=true).
   * If not provided, manual mode is not available.
   */
  manualRedirectUri?: string;
}

/** Execute the full PKCE flow: generate params, open browser, wait for callback, exchange code */
export async function executePKCEFlow(options: PKCEFlowOptions): Promise<TokenSet> {
  const { config, adapters, loginOptions } = options;
  const { codeVerifier, codeChallenge } = await generatePKCE();
  // Some providers (e.g. Claude) require state === verifier for their token exchange
  const state = config.stateIsVerifier ? codeVerifier : generateState();
  const manual = loginOptions?.manual ?? false;

  let authResult: AuthorizationResult;
  let redirectUri: string;

  if (manual && options.manualRedirectUri) {
    if (!adapters.codePrompt) {
      throw new OAuthCallbackError("Manual mode requires a CodePrompter adapter");
    }
    // Manual mode: redirect to provider's callback page, user copies code
    redirectUri = options.manualRedirectUri;
    const authUrl = buildAuthorizationUrl(config, codeChallenge, state, redirectUri);

    if (loginOptions?.onOpenBrowser) {
      loginOptions.onOpenBrowser(authUrl);
    } else {
      await adapters.browser.open(authUrl);
    }

    authResult = await adapters.codePrompt.promptForCode(state);
  } else {
    if (!adapters.callback) {
      throw new OAuthCallbackError("Automatic mode requires a CallbackReceiver adapter");
    }
    // Automatic mode: platform-specific callback receiver (local server, tab listener, etc.)
    const timeout = loginOptions?.timeout ?? 120_000;
    const handle = await adapters.callback.listen({
      expectedState: state,
      timeout,
      port: loginOptions?.port,
    });
    redirectUri = handle.redirectUri;
    const authUrl = buildAuthorizationUrl(config, codeChallenge, state, redirectUri);

    if (loginOptions?.onOpenBrowser) {
      loginOptions.onOpenBrowser(authUrl);
    } else {
      await adapters.browser.open(authUrl);
    }

    try {
      authResult = await handle.result;
    } catch (err) {
      handle.close();
      throw err;
    }
  }

  // Pass state to exchange when provider uses JSON body format (e.g. Claude)
  const exchangeState = config.tokenBodyFormat === "json" ? authResult.state : undefined;
  return exchangeCode(config, authResult.code, codeVerifier, redirectUri, exchangeState);
}

function parseTokenResponse(data: Record<string, unknown>): TokenSet {
  const accessToken = data.access_token as string | undefined;
  if (!accessToken) {
    throw new OAuthCallbackError("No access_token in token response");
  }

  const expiresIn = (data.expires_in as number | undefined) ?? 3600;
  const expiresAt = Date.now() + expiresIn * 1000;

  return {
    accessToken,
    refreshToken: (data.refresh_token as string | undefined) ?? null,
    expiresAt,
    idToken: data.id_token as string | undefined,
    tokenType: ((data.token_type as string | undefined) ?? "bearer").toLowerCase() as
      | "bearer"
      | "api-key",
    scopes: data.scope ? (data.scope as string).split(" ") : undefined,
    raw: data,
  };
}
