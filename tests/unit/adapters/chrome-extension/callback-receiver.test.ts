import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  createChromeBrowserLauncher,
  type ChromeBrowserLauncher,
} from "@/adapters/chrome-extension/browser-launcher.ts";
import { createChromeCallbackReceiver } from "@/adapters/chrome-extension/callback-receiver.ts";
import { installMockChrome, type MockChrome, uninstallMockChrome } from "./_mock-chrome.ts";

const REDIRECT = "https://console.anthropic.com/oauth/code/callback";

describe("createChromeCallbackReceiver", () => {
  let mock: MockChrome;
  let browser: ChromeBrowserLauncher;

  beforeEach(() => {
    mock = installMockChrome();
    browser = createChromeBrowserLauncher();
  });

  afterEach(() => {
    mock.reset();
    uninstallMockChrome();
  });

  it("returns the configured redirectUri", async () => {
    const receiver = createChromeCallbackReceiver({ redirectUri: REDIRECT });
    const handle = await receiver.listen({ expectedState: "S" });
    expect(handle.redirectUri).toBe(REDIRECT);
    handle.close();
  });

  it("resolves with code+state on matching tab URL update", async () => {
    const receiver = createChromeCallbackReceiver({ redirectUri: REDIRECT, browser });
    await browser.open("https://auth.start/");
    const tabId = browser.getLastTabId()!;

    const handle = await receiver.listen({ expectedState: "the-state" });

    mock.fireTabUpdate(tabId, {
      url: `${REDIRECT}?code=auth-code&state=the-state`,
    });

    const result = await handle.result;
    expect(result.code).toBe("auth-code");
    expect(result.state).toBe("the-state");
  });

  it("rejects on state mismatch", async () => {
    const receiver = createChromeCallbackReceiver({ redirectUri: REDIRECT, browser });
    await browser.open("https://auth.start/");
    const tabId = browser.getLastTabId()!;

    const handle = await receiver.listen({ expectedState: "expected" });
    const captured = handle.result.catch((e) => e);

    mock.fireTabUpdate(tabId, {
      url: `${REDIRECT}?code=c&state=different`,
    });

    const err = await captured;
    expect((err as Error).message).toContain("State mismatch");
  });

  it("rejects on OAuth error param in redirect", async () => {
    const receiver = createChromeCallbackReceiver({ redirectUri: REDIRECT, browser });
    await browser.open("https://auth.start/");
    const tabId = browser.getLastTabId()!;

    const handle = await receiver.listen({ expectedState: "S" });
    const captured = handle.result.catch((e) => e);

    mock.fireTabUpdate(tabId, {
      url: `${REDIRECT}?error=access_denied&error_description=User+denied`,
    });

    const err = await captured;
    expect((err as Error).message).toContain("User denied");
  });

  it("ignores tab updates for OTHER tabs when browser is supplied", async () => {
    const receiver = createChromeCallbackReceiver({ redirectUri: REDIRECT, browser });
    await browser.open("https://auth.start/");
    const ourTabId = browser.getLastTabId()!;
    const otherTabId = ourTabId + 999;

    const handle = await receiver.listen({ expectedState: "S" });

    let resolved = false;
    handle.result.then(
      () => {
        resolved = true;
      },
      () => {
        resolved = true;
      },
    );

    // Spurious update on a different tab — should NOT settle
    mock.fireTabUpdate(otherTabId, {
      url: `${REDIRECT}?code=spurious&state=S`,
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    // Real update on our tab → resolves
    mock.fireTabUpdate(ourTabId, {
      url: `${REDIRECT}?code=real&state=S`,
    });
    const result = await handle.result;
    expect(result.code).toBe("real");
  });

  it("ignores URL changes that do not match redirectUri pathname", async () => {
    const receiver = createChromeCallbackReceiver({ redirectUri: REDIRECT, browser });
    await browser.open("https://auth.start/");
    const tabId = browser.getLastTabId()!;

    const handle = await receiver.listen({ expectedState: "S" });
    let resolved = false;
    handle.result.then(
      () => {
        resolved = true;
      },
      () => {
        resolved = true;
      },
    );

    // Intermediate redirect during auth — irrelevant
    mock.fireTabUpdate(tabId, { url: "https://claude.ai/oauth/authorize?step=2" });
    mock.fireTabUpdate(tabId, { url: "https://console.anthropic.com/login" });

    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    // The actual redirect
    mock.fireTabUpdate(tabId, {
      url: `${REDIRECT}?code=c&state=S`,
    });
    const result = await handle.result;
    expect(result.code).toBe("c");
  });

  it("times out when no matching update arrives", async () => {
    const receiver = createChromeCallbackReceiver({ redirectUri: REDIRECT, browser });
    const handle = await receiver.listen({ expectedState: "S", timeout: 30 });
    await expect(handle.result).rejects.toThrow(/timed out/i);
  });

  it("closes the auth tab after success when closeTabOnSuccess is true (default)", async () => {
    const receiver = createChromeCallbackReceiver({ redirectUri: REDIRECT, browser });
    await browser.open("https://auth.start/");
    const tabId = browser.getLastTabId()!;
    const handle = await receiver.listen({ expectedState: "S" });

    mock.fireTabUpdate(tabId, { url: `${REDIRECT}?code=c&state=S` });
    await handle.result;
    // Tab close is async; allow microtasks to run
    await new Promise((r) => setTimeout(r, 5));
    expect(mock.removedTabIds).toContain(tabId);
  });

  it("does NOT close the tab when closeTabOnSuccess is false", async () => {
    const receiver = createChromeCallbackReceiver({
      redirectUri: REDIRECT,
      browser,
      closeTabOnSuccess: false,
    });
    await browser.open("https://auth.start/");
    const tabId = browser.getLastTabId()!;
    const handle = await receiver.listen({ expectedState: "S" });

    mock.fireTabUpdate(tabId, { url: `${REDIRECT}?code=c&state=S` });
    await handle.result;
    await new Promise((r) => setTimeout(r, 5));
    expect(mock.removedTabIds).not.toContain(tabId);
  });
});
