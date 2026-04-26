import type { StoredCredential, TokenStore } from "@/types.ts";
import { getChromeAPI } from "../chrome-api.ts";

const KEY_PREFIX = "osa::";

function makeKey(provider: string, accountId: string): string {
  return `${KEY_PREFIX}${provider}::${accountId}`;
}

/**
 * TokenStore backed by `chrome.storage.local`.
 *
 * Security note: `chrome.storage.local` is per-extension but unencrypted.
 * It is roughly comparable to a profile-scoped JSON file. If your threat
 * model includes other extensions with broad permissions OR malicious
 * page scripts that gain access to the storage area, wrap the credential
 * payload in an additional Web Crypto AES-GCM layer with a key in
 * `chrome.storage.session` (cleared on browser restart). Out of scope for
 * this default implementation.
 */
export class ChromeStorageStore implements TokenStore {
  async get(provider: string, accountId: string): Promise<StoredCredential | null> {
    const key = makeKey(provider, accountId);
    const result = await getChromeAPI().storage.local.get(key);
    return (result[key] as StoredCredential | undefined) ?? null;
  }

  async set(provider: string, accountId: string, credential: StoredCredential): Promise<void> {
    await getChromeAPI().storage.local.set({ [makeKey(provider, accountId)]: credential });
  }

  async delete(provider: string, accountId: string): Promise<void> {
    await getChromeAPI().storage.local.remove(makeKey(provider, accountId));
  }

  async list(provider?: string): Promise<StoredCredential[]> {
    const all = await getChromeAPI().storage.local.get(null);
    const filterPrefix = provider ? `${KEY_PREFIX}${provider}::` : KEY_PREFIX;
    return Object.entries(all)
      .filter(([k]) => k.startsWith(filterPrefix))
      .map(([, v]) => v as StoredCredential);
  }
}
