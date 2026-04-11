/**
 * Example: Login to Claude and call the Anthropic API
 *
 * Usage:
 *   npx tsx examples/basic-claude.ts
 *
 * ⚠️ WARNING: Using subscription OAuth tokens in third-party tools
 * may violate provider Terms of Service. Use at your own risk.
 */
import { TokenManager, createTokenStore } from "@/index.ts";

async function main() {
  const store = await createTokenStore();
  const manager = new TokenManager(store);

  // Login (opens browser for OAuth authorization)
  console.log("Starting Claude OAuth login...");
  const credential = await manager.login("claude");
  console.log(`Logged in! Account: ${credential.metadata.accountId}`);

  // Get authenticated headers
  const headers = await manager.getAuthHeaders("claude");

  // Call the Anthropic Messages API
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Hello! Say hi in one sentence." }],
    }),
  });

  if (!response.ok) {
    console.error(`API error: ${response.status} ${await response.text()}`);
    return;
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  console.log("Claude says:", data.content[0]?.text);
}

main().catch(console.error);
