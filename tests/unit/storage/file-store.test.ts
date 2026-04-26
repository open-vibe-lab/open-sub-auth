import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { FileStore } from "@/adapters/node/storage/file-store.ts";
import type { StoredCredential } from "@/types.ts";

const makeCredential = (provider: string, accountId: string): StoredCredential => ({
  tokenSet: {
    accessToken: `access-${provider}-${accountId}`,
    refreshToken: `refresh-${provider}-${accountId}`,
    expiresAt: Date.now() + 3600_000,
    tokenType: "bearer",
  },
  metadata: {
    provider,
    accountId,
    createdAt: Date.now(),
    lastRefreshedAt: Date.now(),
  },
});

describe("FileStore", () => {
  let tmpDir: string;
  let store: FileStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "osa-test-"));
    store = new FileStore(join(tmpDir, "credentials.json"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for non-existent credential", async () => {
    const result = await store.get("claude", "unknown");
    expect(result).toBeNull();
  });

  it("stores and retrieves a credential", async () => {
    const cred = makeCredential("claude", "acc1");
    await store.set("claude", "acc1", cred);

    const result = await store.get("claude", "acc1");
    expect(result).not.toBeNull();
    expect(result?.tokenSet.accessToken).toBe("access-claude-acc1");
    expect(result?.metadata.provider).toBe("claude");
  });

  it("overwrites existing credential", async () => {
    const cred1 = makeCredential("claude", "acc1");
    await store.set("claude", "acc1", cred1);

    const cred2 = makeCredential("claude", "acc1");
    cred2.tokenSet.accessToken = "updated-access";
    await store.set("claude", "acc1", cred2);

    const result = await store.get("claude", "acc1");
    expect(result?.tokenSet.accessToken).toBe("updated-access");
  });

  it("deletes a credential", async () => {
    await store.set("claude", "acc1", makeCredential("claude", "acc1"));
    await store.delete("claude", "acc1");

    const result = await store.get("claude", "acc1");
    expect(result).toBeNull();
  });

  it("lists all credentials", async () => {
    await store.set("claude", "acc1", makeCredential("claude", "acc1"));
    await store.set("openai-codex", "acc2", makeCredential("openai-codex", "acc2"));

    const results = await store.list();
    expect(results).toHaveLength(2);
  });

  it("lists credentials filtered by provider", async () => {
    await store.set("claude", "acc1", makeCredential("claude", "acc1"));
    await store.set("openai-codex", "acc2", makeCredential("openai-codex", "acc2"));
    await store.set("claude", "acc3", makeCredential("claude", "acc3"));

    const claudeResults = await store.list("claude");
    expect(claudeResults).toHaveLength(2);

    const openaiResults = await store.list("openai-codex");
    expect(openaiResults).toHaveLength(1);
  });

  it("handles empty store gracefully", async () => {
    const results = await store.list();
    expect(results).toHaveLength(0);
  });

  it("isolates credentials by provider and account", async () => {
    await store.set("claude", "acc1", makeCredential("claude", "acc1"));
    await store.set("claude", "acc2", makeCredential("claude", "acc2"));

    const result1 = await store.get("claude", "acc1");
    const result2 = await store.get("claude", "acc2");

    expect(result1?.tokenSet.accessToken).toBe("access-claude-acc1");
    expect(result2?.tokenSet.accessToken).toBe("access-claude-acc2");
  });

  it("encrypts data on disk (not plaintext)", async () => {
    const { readFileSync } = await import("node:fs");
    await store.set("claude", "acc1", makeCredential("claude", "acc1"));

    const raw = readFileSync(join(tmpDir, "credentials.json"), "utf8");
    // The file should NOT contain the plaintext access token
    expect(raw).not.toContain("access-claude-acc1");
    // But should be valid JSON with encrypted entries
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.credentials["claude::acc1"]).toBeDefined();
    expect(parsed.credentials["claude::acc1"].iv).toBeDefined();
    expect(parsed.credentials["claude::acc1"].salt).toBeDefined();
  });
});
