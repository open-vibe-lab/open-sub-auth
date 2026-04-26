import { describe, expect, it, vi } from "vite-plus/test";
import { AuthenticationError } from "@/errors.ts";
import { FileStore } from "@/adapters/node/storage/file-store.ts";
import { KeychainStore } from "@/adapters/node/storage/keychain-store.ts";
import { createTokenStore } from "@/adapters/node/storage/index.ts";

vi.mock("@/adapters/node/storage/keychain-store.ts", () => {
  return {
    KeychainStore: vi.fn(function MockKeychainStore(this: Record<string, unknown>) {
      this.get = vi.fn();
    }),
  };
});

describe("createTokenStore", () => {
  it("returns FileStore when storeType is 'file'", async () => {
    const store = await createTokenStore("file");
    expect(store).toBeInstanceOf(FileStore);
  });

  it("returns KeychainStore when keychain probe succeeds", async () => {
    const MockKeychain = vi.mocked(KeychainStore);
    MockKeychain.mockImplementation(function MockImpl(this: Record<string, unknown>) {
      this.get = vi.fn().mockResolvedValue(null);
    } as unknown as typeof KeychainStore);

    const store = await createTokenStore("keychain");
    expect(store).toBeInstanceOf(KeychainStore);
  });

  it("throws AuthenticationError when storeType is 'keychain' and keychain is unavailable", async () => {
    const MockKeychain = vi.mocked(KeychainStore);
    MockKeychain.mockImplementation(function MockImpl(this: Record<string, unknown>) {
      this.get = vi.fn().mockRejectedValue(new Error("Keychain locked"));
    } as unknown as typeof KeychainStore);

    await expect(createTokenStore("keychain")).rejects.toThrow(AuthenticationError);
    await expect(createTokenStore("keychain")).rejects.toThrow(
      "OS keychain is not available on this system",
    );
  });

  it("falls back to FileStore when storeType is 'auto' and keychain is unavailable", async () => {
    const MockKeychain = vi.mocked(KeychainStore);
    MockKeychain.mockImplementation(function MockImpl(this: Record<string, unknown>) {
      this.get = vi.fn().mockRejectedValue(new Error("Keychain not available"));
    } as unknown as typeof KeychainStore);

    const store = await createTokenStore("auto");
    expect(store).toBeInstanceOf(FileStore);
  });

  it("defaults to auto behavior (tries keychain first)", async () => {
    const MockKeychain = vi.mocked(KeychainStore);
    MockKeychain.mockImplementation(function MockImpl(this: Record<string, unknown>) {
      this.get = vi.fn().mockResolvedValue(null);
    } as unknown as typeof KeychainStore);

    const store = await createTokenStore();
    expect(store).toBeInstanceOf(KeychainStore);
  });
});
