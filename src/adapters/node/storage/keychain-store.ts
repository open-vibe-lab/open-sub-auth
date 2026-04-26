import type { StoredCredential, TokenStore } from "@/types.ts";

const SERVICE_NAME = "open-sub-auth";
const INDEX_ACCOUNT = "__index__";

/** Token store backed by the OS keychain via cross-keychain */
export class KeychainStore implements TokenStore {
  private keychain: typeof import("cross-keychain") | null = null;

  private async getKeychain() {
    if (!this.keychain) {
      this.keychain = await import("cross-keychain");
    }
    return this.keychain;
  }

  private makeKey(provider: string, accountId: string): string {
    return `${provider}__${accountId}`;
  }

  async get(provider: string, accountId: string): Promise<StoredCredential | null> {
    const kc = await this.getKeychain();
    try {
      const value = await kc.getPassword(SERVICE_NAME, this.makeKey(provider, accountId));
      if (!value) return null;
      return JSON.parse(value) as StoredCredential;
    } catch {
      return null;
    }
  }

  async set(provider: string, accountId: string, credential: StoredCredential): Promise<void> {
    const kc = await this.getKeychain();
    const key = this.makeKey(provider, accountId);
    const value = JSON.stringify(credential);

    try {
      await kc.deletePassword(SERVICE_NAME, key);
    } catch {
      // Ignore if it doesn't exist
    }
    await kc.setPassword(SERVICE_NAME, key, value);
    await this.addToIndex(key);
  }

  async delete(provider: string, accountId: string): Promise<void> {
    const kc = await this.getKeychain();
    const key = this.makeKey(provider, accountId);
    try {
      await kc.deletePassword(SERVICE_NAME, key);
    } catch {
      // Ignore if it doesn't exist
    }
    await this.removeFromIndex(key);
  }

  async list(provider?: string): Promise<StoredCredential[]> {
    const index = await this.getIndex();
    const results: StoredCredential[] = [];

    for (const key of index) {
      const [keyProvider, keyAccountId] = key.split("__");
      if (provider && keyProvider !== provider) continue;
      if (!keyProvider || !keyAccountId) continue;

      const credential = await this.get(keyProvider, keyAccountId);
      if (credential) {
        results.push(credential);
      }
    }

    return results;
  }

  private async getIndex(): Promise<string[]> {
    const kc = await this.getKeychain();
    try {
      const value = await kc.getPassword(SERVICE_NAME, INDEX_ACCOUNT);
      if (!value) return [];
      return JSON.parse(value) as string[];
    } catch {
      return [];
    }
  }

  private async setIndex(index: string[]): Promise<void> {
    const kc = await this.getKeychain();
    try {
      await kc.deletePassword(SERVICE_NAME, INDEX_ACCOUNT);
    } catch {
      // Ignore
    }
    await kc.setPassword(SERVICE_NAME, INDEX_ACCOUNT, JSON.stringify(index));
  }

  private async addToIndex(key: string): Promise<void> {
    const index = await this.getIndex();
    if (!index.includes(key)) {
      index.push(key);
      await this.setIndex(index);
    }
  }

  private async removeFromIndex(key: string): Promise<void> {
    const index = await this.getIndex();
    const filtered = index.filter((k) => k !== key);
    await this.setIndex(filtered);
  }
}
