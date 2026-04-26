import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { ChromeStorageStore } from "@/adapters/chrome-extension/storage/chrome-storage-store.ts";
import type { StoredCredential } from "@/types.ts";
import { installMockChrome, type MockChrome, uninstallMockChrome } from "./_mock-chrome.ts";

const SAMPLE: StoredCredential = {
  tokenSet: {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresAt: 1_000_000,
    tokenType: "bearer",
  },
  metadata: {
    provider: "claude",
    accountId: "acc-1",
    createdAt: 1,
    lastRefreshedAt: 1,
  },
};

describe("ChromeStorageStore", () => {
  let mock: MockChrome;
  let store: ChromeStorageStore;

  beforeEach(() => {
    mock = installMockChrome();
    store = new ChromeStorageStore();
  });

  afterEach(() => {
    mock.reset();
    uninstallMockChrome();
  });

  it("set + get roundtrip", async () => {
    await store.set("claude", "acc-1", SAMPLE);
    const got = await store.get("claude", "acc-1");
    expect(got).toEqual(SAMPLE);
  });

  it("get returns null for unknown key", async () => {
    expect(await store.get("claude", "nope")).toBeNull();
  });

  it("delete removes the entry", async () => {
    await store.set("claude", "acc-1", SAMPLE);
    await store.delete("claude", "acc-1");
    expect(await store.get("claude", "acc-1")).toBeNull();
  });

  it("list filters by provider prefix", async () => {
    await store.set("claude", "acc-1", SAMPLE);
    await store.set("openai-codex", "acc-2", {
      ...SAMPLE,
      metadata: { ...SAMPLE.metadata, provider: "openai-codex", accountId: "acc-2" },
    });
    await store.set("claude", "acc-3", {
      ...SAMPLE,
      metadata: { ...SAMPLE.metadata, accountId: "acc-3" },
    });

    const claudeOnly = await store.list("claude");
    expect(claudeOnly).toHaveLength(2);
    expect(claudeOnly.every((c) => c.metadata.provider === "claude")).toBe(true);

    const all = await store.list();
    expect(all).toHaveLength(3);
  });

  it("list ignores keys that do not match the osa:: prefix", async () => {
    // Pre-populate something unrelated
    await mock.storage.local.set({ "unrelated-key": "value" });
    await store.set("claude", "acc-1", SAMPLE);
    const all = await store.list();
    expect(all).toHaveLength(1);
  });
});
