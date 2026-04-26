import { AuthenticationError } from "@/errors.ts";
import type { TokenStore } from "@/types.ts";
import { FileStore } from "@/adapters/node/storage/file-store.ts";
import { KeychainStore } from "@/adapters/node/storage/keychain-store.ts";

export type StoreType = "auto" | "keychain" | "file";

/**
 * Create a token store.
 *
 * @param storeType
 *   - `"auto"` (default): try OS keychain first, fall back to encrypted file store
 *   - `"keychain"`: force OS keychain; throws AuthenticationError if unavailable
 *   - `"file"`: always use the encrypted file store (~/.open-sub-auth/credentials.json)
 */
export async function createTokenStore(storeType: StoreType = "auto"): Promise<TokenStore> {
  if (storeType === "file") {
    return new FileStore();
  }

  try {
    const store = new KeychainStore();
    // Probe if keychain is accessible
    await store.get("__probe__", "__probe__");
    return store;
  } catch (err) {
    if (storeType === "keychain") {
      throw new AuthenticationError(
        `OS keychain is not available on this system: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    // "auto" mode: fall back silently
    return new FileStore();
  }
}

export { FileStore, KeychainStore };
