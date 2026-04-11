import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname, userInfo } from "node:os";
import { dirname, join } from "node:path";
import type { StoredCredential, TokenStore } from "@/types.ts";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;
const AUTH_TAG_LENGTH = 16;

interface EncryptedEntry {
  data: string; // base64 encoded ciphertext + auth tag
  iv: string; // base64
  salt: string; // base64
}

interface FileStoreData {
  version: 1;
  credentials: Record<string, EncryptedEntry>;
}

/** Token store backed by an encrypted JSON file */
export class FileStore implements TokenStore {
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath =
      filePath ??
      join(process.env.OPEN_SUB_AUTH_HOME ?? join(homedir(), ".open-sub-auth"), "credentials.json");
  }

  async get(provider: string, accountId: string): Promise<StoredCredential | null> {
    const data = this.readFile();
    const key = `${provider}::${accountId}`;
    const entry = data.credentials[key];
    if (!entry) return null;

    try {
      const decrypted = this.decrypt(entry);
      return JSON.parse(decrypted) as StoredCredential;
    } catch {
      return null;
    }
  }

  async set(provider: string, accountId: string, credential: StoredCredential): Promise<void> {
    const data = this.readFile();
    const key = `${provider}::${accountId}`;
    data.credentials[key] = this.encrypt(JSON.stringify(credential));
    this.writeFile(data);
  }

  async delete(provider: string, accountId: string): Promise<void> {
    const data = this.readFile();
    const key = `${provider}::${accountId}`;
    delete data.credentials[key];
    this.writeFile(data);
  }

  async list(provider?: string): Promise<StoredCredential[]> {
    const data = this.readFile();
    const results: StoredCredential[] = [];

    for (const [key, entry] of Object.entries(data.credentials)) {
      const [keyProvider] = key.split("::");
      if (provider && keyProvider !== provider) continue;

      try {
        const decrypted = this.decrypt(entry);
        results.push(JSON.parse(decrypted) as StoredCredential);
      } catch {
        // Skip corrupted entries
      }
    }

    return results;
  }

  private deriveKey(salt: Buffer): Buffer {
    const machineId = `${hostname()}:${userInfo().username}`;
    return pbkdf2Sync(machineId, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
  }

  private encrypt(plaintext: string): EncryptedEntry {
    const salt = randomBytes(SALT_LENGTH);
    const key = this.deriveKey(salt);
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    return {
      data: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
    };
  }

  private decrypt(entry: EncryptedEntry): string {
    const salt = Buffer.from(entry.salt, "base64");
    const key = this.deriveKey(salt);
    const iv = Buffer.from(entry.iv, "base64");
    const raw = Buffer.from(entry.data, "base64");

    const authTag = raw.subarray(raw.length - AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(0, raw.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    return decipher.update(ciphertext) + decipher.final("utf8");
  }

  private readFile(): FileStoreData {
    try {
      const content = readFileSync(this.filePath, "utf8");
      return JSON.parse(content) as FileStoreData;
    } catch {
      return { version: 1, credentials: {} };
    }
  }

  private writeFile(data: FileStoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true, mode: 0o700 });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }
}

function homedir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
}
