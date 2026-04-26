import { NoCredentialError, TokenExpiredError, TokenRefreshError } from "@/errors.ts";
import { getProvider } from "@/core/providers/registry.ts";
import type {
  AuthHeaders,
  CredentialStatus,
  LoginOptions,
  StoredCredential,
  TokenStore,
} from "@/types.ts";

/** Buffer time before expiry to trigger refresh (5 minutes) */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Central token lifecycle manager */
export class TokenManager {
  private readonly store: TokenStore;
  /** Per-provider+account mutex to prevent concurrent refreshes */
  private readonly refreshLocks = new Map<string, Promise<void>>();

  constructor(store: TokenStore) {
    this.store = store;
  }

  /** Run the interactive login flow for a provider, store the tokens */
  async login(providerName: string, options?: LoginOptions): Promise<StoredCredential> {
    const provider = getProvider(providerName);
    const tokenSet = await provider.login(options);

    const accountId = await provider.getAccountId(tokenSet);
    const accountLabel = provider.getAccountLabel?.(tokenSet);
    const now = Date.now();

    const credential: StoredCredential = {
      tokenSet,
      metadata: {
        provider: providerName,
        accountId,
        accountLabel,
        createdAt: now,
        lastRefreshedAt: now,
      },
    };

    await this.store.set(providerName, accountId, credential);
    return credential;
  }

  /** Get a valid access token, refreshing if needed */
  async getToken(providerName: string, accountId?: string): Promise<string> {
    const credential = await this.resolveCredential(providerName, accountId);
    const { tokenSet } = credential;

    if (this.isTokenValid(tokenSet.expiresAt)) {
      return tokenSet.accessToken;
    }

    // Token expired or near-expiry — try to refresh
    if (!tokenSet.refreshToken) {
      throw new TokenExpiredError(providerName);
    }

    await this.refreshWithLock(providerName, credential);

    // Re-read from store after refresh
    const refreshed = await this.store.get(providerName, credential.metadata.accountId);
    if (!refreshed) {
      throw new TokenExpiredError(providerName);
    }
    return refreshed.tokenSet.accessToken;
  }

  /** Get authenticated headers for API calls */
  async getAuthHeaders(providerName: string, accountId?: string): Promise<AuthHeaders> {
    const token = await this.getToken(providerName, accountId);
    const provider = getProvider(providerName);
    return provider.getAuthHeaders(token);
  }

  /** Remove stored tokens for a provider */
  async logout(providerName: string, accountId?: string): Promise<void> {
    if (accountId) {
      await this.store.delete(providerName, accountId);
    } else {
      const credentials = await this.store.list(providerName);
      for (const cred of credentials) {
        await this.store.delete(providerName, cred.metadata.accountId);
      }
    }
  }

  /** Get status of all stored credentials */
  async status(): Promise<CredentialStatus[]> {
    const credentials = await this.store.list();
    return credentials.map((cred) => {
      let displayName = cred.metadata.provider;
      try {
        const provider = getProvider(cred.metadata.provider);
        displayName = provider.config.displayName;
      } catch {
        // Unknown provider, use raw name
      }

      return {
        provider: cred.metadata.provider,
        displayName,
        accountId: cred.metadata.accountId,
        accountLabel: cred.metadata.accountLabel,
        isExpired: !this.isTokenValid(cred.tokenSet.expiresAt),
        expiresAt: cred.tokenSet.expiresAt,
        hasRefreshToken: cred.tokenSet.refreshToken !== null,
      };
    });
  }

  private isTokenValid(expiresAt: number): boolean {
    return Date.now() + REFRESH_BUFFER_MS < expiresAt;
  }

  private async resolveCredential(
    providerName: string,
    accountId?: string,
  ): Promise<StoredCredential> {
    if (accountId) {
      const credential = await this.store.get(providerName, accountId);
      if (!credential) {
        throw new NoCredentialError(providerName, accountId);
      }
      return credential;
    }

    // No account specified — find the most recently refreshed one
    const credentials = await this.store.list(providerName);
    if (credentials.length === 0) {
      throw new NoCredentialError(providerName);
    }

    return credentials.sort((a, b) => b.metadata.lastRefreshedAt - a.metadata.lastRefreshedAt)[0]!;
  }

  private async refreshWithLock(providerName: string, credential: StoredCredential): Promise<void> {
    const lockKey = `${providerName}::${credential.metadata.accountId}`;

    // If a refresh is already in progress for this account, wait for it
    const existingLock = this.refreshLocks.get(lockKey);
    if (existingLock) {
      await existingLock;
      return;
    }

    const refreshPromise = this.doRefresh(providerName, credential);
    this.refreshLocks.set(lockKey, refreshPromise);

    try {
      await refreshPromise;
    } finally {
      this.refreshLocks.delete(lockKey);
    }
  }

  private async doRefresh(providerName: string, credential: StoredCredential): Promise<void> {
    const provider = getProvider(providerName);
    const { refreshToken } = credential.tokenSet;

    if (!refreshToken) {
      throw new TokenExpiredError(providerName);
    }

    let newTokenSet;
    try {
      newTokenSet = await provider.refresh(refreshToken);
    } catch (err) {
      throw new TokenRefreshError(providerName, err);
    }

    // Preserve the refresh token if the new response doesn't include one
    if (!newTokenSet.refreshToken && refreshToken) {
      newTokenSet.refreshToken = refreshToken;
    }

    const updatedCredential: StoredCredential = {
      tokenSet: newTokenSet,
      metadata: {
        ...credential.metadata,
        lastRefreshedAt: Date.now(),
      },
    };

    await this.store.set(providerName, credential.metadata.accountId, updatedCredential);
  }
}
