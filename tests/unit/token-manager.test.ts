import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { NoCredentialError } from "@/errors.ts";
import { registerProvider } from "@/providers/registry.ts";
import { FileStore } from "@/storage/file-store.ts";
import { TokenManager } from "@/token/manager.ts";
import { decodeJWT } from "@/token/jwt.ts";
import type {
  AuthHeaders,
  LoginOptions,
  Provider,
  ProviderConfig,
  StoredCredential,
  TokenSet,
} from "@/types.ts";

// Create a mock provider for testing
const MOCK_CONFIG: ProviderConfig = {
  name: "mock",
  displayName: "Mock Provider",
  authorizationEndpoint: "https://mock.example.com/auth",
  tokenEndpoint: "https://mock.example.com/token",
  clientId: "mock-client",
  grantType: "authorization_code",
};

class MockProvider implements Provider {
  readonly config = MOCK_CONFIG;
  refreshCallCount = 0;

  async login(_options?: LoginOptions): Promise<TokenSet> {
    return {
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresAt: Date.now() + 3600_000,
      tokenType: "bearer",
    };
  }

  async refresh(_refreshToken: string): Promise<TokenSet> {
    this.refreshCallCount++;
    return {
      accessToken: "refreshed-access-token",
      refreshToken: "refreshed-refresh-token",
      expiresAt: Date.now() + 3600_000,
      tokenType: "bearer",
    };
  }

  getAuthHeaders(accessToken: string): AuthHeaders {
    return { authorization: `Bearer ${accessToken}` };
  }

  getAccountId(_tokenSet: TokenSet): string {
    return "mock-account-id";
  }

  getAccountLabel(_tokenSet: TokenSet): string | undefined {
    return "mock@example.com";
  }
}

describe("TokenManager", () => {
  let tmpDir: string;
  let store: FileStore;
  let manager: TokenManager;
  let mockProvider: MockProvider;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "osa-tm-test-"));
    store = new FileStore(join(tmpDir, "creds.json"));
    manager = new TokenManager(store);
    mockProvider = new MockProvider();
    registerProvider("mock", () => mockProvider);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("login", () => {
    it("stores credential after successful login", async () => {
      const cred = await manager.login("mock");
      expect(cred.tokenSet.accessToken).toBe("mock-access-token");
      expect(cred.metadata.provider).toBe("mock");
      expect(cred.metadata.accountId).toBe("mock-account-id");
      expect(cred.metadata.accountLabel).toBe("mock@example.com");
    });

    it("credential is retrievable after login", async () => {
      await manager.login("mock");
      const token = await manager.getToken("mock");
      expect(token).toBe("mock-access-token");
    });
  });

  describe("getToken", () => {
    it("returns valid token without refresh", async () => {
      await manager.login("mock");
      const token = await manager.getToken("mock");
      expect(token).toBe("mock-access-token");
      expect(mockProvider.refreshCallCount).toBe(0);
    });

    it("refreshes near-expiry token", async () => {
      // Store a credential that expires in 2 minutes (within 5-minute buffer)
      const cred: StoredCredential = {
        tokenSet: {
          accessToken: "old-access",
          refreshToken: "old-refresh",
          expiresAt: Date.now() + 2 * 60 * 1000,
          tokenType: "bearer",
        },
        metadata: {
          provider: "mock",
          accountId: "mock-account-id",
          createdAt: Date.now(),
          lastRefreshedAt: Date.now(),
        },
      };
      await store.set("mock", "mock-account-id", cred);

      const token = await manager.getToken("mock");
      expect(token).toBe("refreshed-access-token");
      expect(mockProvider.refreshCallCount).toBe(1);
    });

    it("throws NoCredentialError when no credential exists", async () => {
      await expect(manager.getToken("mock")).rejects.toThrow(NoCredentialError);
    });
  });

  describe("getAuthHeaders", () => {
    it("returns provider-specific headers", async () => {
      await manager.login("mock");
      const headers = await manager.getAuthHeaders("mock");
      expect(headers.authorization).toBe("Bearer mock-access-token");
    });
  });

  describe("logout", () => {
    it("removes stored credential", async () => {
      await manager.login("mock");
      await manager.logout("mock");
      await expect(manager.getToken("mock")).rejects.toThrow(NoCredentialError);
    });
  });

  describe("status", () => {
    it("returns status for all credentials", async () => {
      await manager.login("mock");
      const statuses = await manager.status();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.provider).toBe("mock");
      expect(statuses[0]!.isExpired).toBe(false);
      expect(statuses[0]!.hasRefreshToken).toBe(true);
    });

    it("returns empty array when no credentials", async () => {
      const statuses = await manager.status();
      expect(statuses).toHaveLength(0);
    });
  });
});

describe("decodeJWT", () => {
  it("decodes a valid JWT payload", () => {
    // Create a test JWT: header.payload.signature
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        email: "test@example.com",
        exp: 1700000000,
      }),
    ).toString("base64url");
    const signature = "fake-signature";

    const token = `${header}.${payload}.${signature}`;
    const claims = decodeJWT(token);

    expect(claims.sub).toBe("user-123");
    expect(claims.email).toBe("test@example.com");
    expect(claims.exp).toBe(1700000000);
  });

  it("throws on invalid JWT format", () => {
    expect(() => decodeJWT("not-a-jwt")).toThrow("Invalid JWT format");
  });
});
