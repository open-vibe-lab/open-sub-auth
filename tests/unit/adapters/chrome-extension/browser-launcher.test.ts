import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createChromeBrowserLauncher } from "@/adapters/chrome-extension/browser-launcher.ts";
import { installMockChrome, type MockChrome, uninstallMockChrome } from "./_mock-chrome.ts";

describe("createChromeBrowserLauncher", () => {
  let mock: MockChrome;

  beforeEach(() => {
    mock = installMockChrome();
  });

  afterEach(() => {
    mock.reset();
    uninstallMockChrome();
  });

  it("opens a tab via chrome.tabs.create and remembers the id", async () => {
    const launcher = createChromeBrowserLauncher();
    expect(launcher.getLastTabId()).toBeUndefined();

    await launcher.open("https://auth.example/authorize?foo=bar");

    expect(mock.openedTabs).toHaveLength(1);
    expect(mock.openedTabs[0]!.url).toBe("https://auth.example/authorize?foo=bar");
    expect(launcher.getLastTabId()).toBe(mock.openedTabs[0]!.id);
  });

  it("updates lastTabId across multiple opens", async () => {
    const launcher = createChromeBrowserLauncher();
    await launcher.open("https://a/");
    const firstId = launcher.getLastTabId();
    await launcher.open("https://b/");
    expect(launcher.getLastTabId()).not.toBe(firstId);
  });
});
