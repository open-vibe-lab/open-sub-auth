import {
  ChromeStorageStore,
  registerChromeProviders,
  TokenManager,
} from "@open-vibe-lab/open-sub-auth/chrome-extension";

const bundle = registerChromeProviders();
const store = new ChromeStorageStore();
const manager = new TokenManager(store);

type Msg =
  | { type: "login"; provider: string }
  | { type: "logout"; provider: string }
  | { type: "status" }
  | { type: "submit-code"; input: string }
  | { type: "cancel-code" }
  | { type: "test-call"; provider: string };

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  void handle(msg).then(
    (result) => sendResponse({ ok: true, result }),
    (err) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
  );
  return true; // keep channel open for async response
});

async function handle(msg: Msg): Promise<unknown> {
  switch (msg.type) {
    case "login": {
      const cred = await manager.login(msg.provider);
      return { account: cred.metadata.accountLabel ?? cred.metadata.accountId };
    }
    case "logout":
      await manager.logout(msg.provider);
      return null;
    case "status":
      return manager.status();
    case "submit-code":
      bundle.codePrompt.submitCode(msg.input);
      return null;
    case "cancel-code":
      bundle.codePrompt.cancel("Cancelled from popup");
      return null;
    case "test-call":
      return testApiCall(msg.provider);
    default: {
      const _exhaustive: never = msg;
      throw new Error(`Unknown message type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

async function testApiCall(provider: string): Promise<unknown> {
  const headers = await manager.getAuthHeaders(provider);
  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 64,
        messages: [{ role: "user", content: "Reply with one word." }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API HTTP ${res.status}`);
    return res.json();
  }
  if (provider === "openai-codex") {
    // Public-friendly probe — list models or echo
    return { note: "test-call not wired for openai-codex in this demo" };
  }
  if (provider === "github-copilot") {
    return { note: "test-call not wired for github-copilot in this demo" };
  }
  throw new Error(`Unknown provider: ${provider}`);
}
