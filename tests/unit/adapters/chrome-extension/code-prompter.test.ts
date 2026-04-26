import { describe, expect, it } from "vite-plus/test";
import { createChromeCodePrompter } from "@/adapters/chrome-extension/code-prompter.ts";

describe("createChromeCodePrompter", () => {
  it("resolves on submitCode with plain code (state assumed)", async () => {
    const p = createChromeCodePrompter();
    const pending = p.promptForCode("the-state");
    p.submitCode("just-the-code");
    const result = await pending;
    expect(result.code).toBe("just-the-code");
    expect(result.state).toBe("the-state");
  });

  it("resolves with code#state format", async () => {
    const p = createChromeCodePrompter();
    const pending = p.promptForCode("S");
    p.submitCode("c#S");
    const result = await pending;
    expect(result.code).toBe("c");
    expect(result.state).toBe("S");
  });

  it("rejects when state in input mismatches expected", async () => {
    const p = createChromeCodePrompter();
    const pending = p.promptForCode("expected");
    p.submitCode("c#wrong");
    await expect(pending).rejects.toThrow(/state parameter mismatch/);
  });

  it("rejects on empty input", async () => {
    const p = createChromeCodePrompter();
    const pending = p.promptForCode("S");
    p.submitCode("   ");
    await expect(pending).rejects.toThrow(/Empty authorization code/);
  });

  it("trims whitespace", async () => {
    const p = createChromeCodePrompter();
    const pending = p.promptForCode("S");
    p.submitCode("  c#S  ");
    const result = await pending;
    expect(result.code).toBe("c");
  });

  it("supersedes a pending prompt with a new one", async () => {
    const p = createChromeCodePrompter();
    const first = p.promptForCode("first").catch((e) => e);
    const second = p.promptForCode("second");
    p.submitCode("c#second");

    const firstErr = await first;
    expect((firstErr as Error).message).toContain("Superseded");
    const secondResult = await second;
    expect(secondResult.code).toBe("c");
  });

  it("cancel() rejects pending prompt", async () => {
    const p = createChromeCodePrompter();
    const pending = p.promptForCode("S").catch((e) => e);
    p.cancel("user closed popup");
    const err = await pending;
    expect((err as Error).message).toContain("user closed popup");
  });

  it("submitCode with no pending prompt is a no-op", () => {
    const p = createChromeCodePrompter();
    expect(() => p.submitCode("anything")).not.toThrow();
  });
});
