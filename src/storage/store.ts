import type { TokenStore } from "@/types.ts";
import { FileStore } from "@/storage/file-store.ts";
import { KeychainStore } from "@/storage/keychain-store.ts";

/**
 * Create a token store, preferring the OS keychain with encrypted file fallback.
 * @param preferKeychain - If true (default), try keychain first
 */
export async function createTokenStore(preferKeychain = true): Promise<TokenStore> {
  if (preferKeychain) {
    try {
      const store = new KeychainStore();
      // Probe if keychain is accessible
      await store.get("__probe__", "__probe__");
      return store;
    } catch {
      // Keychain not available, fall through to file store
    }
  }
  return new FileStore();
}

export { FileStore, KeychainStore };
