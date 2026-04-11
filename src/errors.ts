export class OpenSubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenSubAuthError";
  }
}

export class AuthenticationError extends OpenSubAuthError {
  constructor(
    message: string,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class TokenExpiredError extends OpenSubAuthError {
  constructor(public readonly provider: string) {
    super(
      `Access token for "${provider}" has expired and no refresh token is available. Please login again.`,
    );
    this.name = "TokenExpiredError";
  }
}

export class TokenRefreshError extends OpenSubAuthError {
  constructor(
    public readonly provider: string,
    public readonly cause_: unknown,
  ) {
    super(
      `Failed to refresh token for "${provider}": ${cause_ instanceof Error ? cause_.message : String(cause_)}`,
    );
    this.name = "TokenRefreshError";
  }
}

export class ProviderNotFoundError extends OpenSubAuthError {
  constructor(public readonly providerName: string) {
    super(
      `Provider "${providerName}" is not registered. Available providers can be listed with listProviders().`,
    );
    this.name = "ProviderNotFoundError";
  }
}

export class NoCredentialError extends OpenSubAuthError {
  constructor(
    public readonly provider: string,
    public readonly accountId?: string,
  ) {
    const msg = accountId
      ? `No stored credential for "${provider}" account "${accountId}". Please login first.`
      : `No stored credential for "${provider}". Please login first.`;
    super(msg);
    this.name = "NoCredentialError";
  }
}

export class OAuthCallbackError extends OpenSubAuthError {
  constructor(message: string) {
    super(message);
    this.name = "OAuthCallbackError";
  }
}

export class OAuthTimeoutError extends OpenSubAuthError {
  constructor(public readonly timeoutMs: number) {
    super(`OAuth login timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`);
    this.name = "OAuthTimeoutError";
  }
}

export class StateMismatchError extends OpenSubAuthError {
  constructor() {
    super("OAuth state parameter mismatch — possible CSRF attack. Please try again.");
    this.name = "StateMismatchError";
  }
}
