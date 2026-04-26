import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { StoredCredential } from "@/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCredential(provider: string, accountId: string): StoredCredential {
  return {
    tokenSet: {
      accessToken: `at-${accountId}`,
      refreshToken: `rt-${accountId}`,
      expiresAt: Date.now() + 3600_000,
      tokenType: "bearer",
    },
    metadata: {
      provider,
      accountId,
      createdAt: Date.now(),
      lastRefreshedAt: Date.now(),
    },
  };
}

const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

vi.mock("@/adapters/node/storage/index.ts", () => ({
  createTokenStore: vi.fn(async () => mockStore),
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// exportCommand
// ---------------------------------------------------------------------------

describe("exportCommand", () => {
  it("writes all credentials as JSON to stdout", async () => {
    const creds = [makeCredential("claude", "acc1"), makeCredential("openai-codex", "acc2")];
    mockStore.list.mockResolvedValue(creds);

    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });

    const { exportCommand } = await import("@/adapters/node/cli/commands/export.ts");
    await exportCommand();

    process.stdout.write = origWrite;

    const output = written.join("");
    const parsed = JSON.parse(output) as StoredCredential[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.metadata.provider).toBe("claude");
    expect(parsed[1]!.metadata.provider).toBe("openai-codex");
  });

  it("writes empty array when no credentials are stored", async () => {
    mockStore.list.mockResolvedValue([]);

    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });

    const { exportCommand } = await import("@/adapters/node/cli/commands/export.ts");
    await exportCommand();

    const output = written.join("");
    expect(JSON.parse(output)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// importCommand
// ---------------------------------------------------------------------------

describe("importCommand", () => {
  const origStdin = process.stdin;

  function setStdinContent(content: string) {
    const readable = Readable.from([content]);
    Object.defineProperty(process, "stdin", { value: readable, writable: true });
  }

  afterEach(() => {
    Object.defineProperty(process, "stdin", { value: origStdin, writable: true });
  });

  it("imports valid credentials and calls store.set for each", async () => {
    const creds = [makeCredential("claude", "acc1")];
    setStdinContent(JSON.stringify(creds));
    mockStore.set.mockResolvedValue(undefined);

    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    const { importCommand } = await import("@/adapters/node/cli/commands/import.ts");
    await importCommand();

    expect(mockStore.set).toHaveBeenCalledOnce();
    expect(mockStore.set).toHaveBeenCalledWith("claude", "acc1", creds[0]);

    stderrWrite.mockRestore();
    consoleLog.mockRestore();
  });

  it("imports multiple credentials", async () => {
    const creds = [makeCredential("claude", "acc1"), makeCredential("github-copilot", "acc2")];
    setStdinContent(JSON.stringify(creds));
    mockStore.set.mockResolvedValue(undefined);

    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { importCommand } = await import("@/adapters/node/cli/commands/import.ts");
    await importCommand();

    expect(mockStore.set).toHaveBeenCalledTimes(2);
  });

  it("exits with error on invalid JSON", async () => {
    setStdinContent("not valid json {{");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const { importCommand } = await import("@/adapters/node/cli/commands/import.ts");
    await expect(importCommand()).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it("exits with error when input is not an array", async () => {
    setStdinContent(JSON.stringify({ provider: "claude" }));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const { importCommand } = await import("@/adapters/node/cli/commands/import.ts");
    await expect(importCommand()).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it("exits with error when credential is missing required fields", async () => {
    const invalid = [{ tokenSet: { accessToken: "tok" } }]; // no metadata
    setStdinContent(JSON.stringify(invalid));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const { importCommand } = await import("@/adapters/node/cli/commands/import.ts");
    await expect(importCommand()).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it("exits with error when stdin is empty", async () => {
    setStdinContent("");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error("process.exit called");
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const { importCommand } = await import("@/adapters/node/cli/commands/import.ts");
    await expect(importCommand()).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
