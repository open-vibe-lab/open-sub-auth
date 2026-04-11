/**
 * Example: Test token auto-refresh
 *
 * Usage:
 *   npx tsx examples/test-refresh.ts
 *
 * Requires an existing login session. Run `npx tsx examples/basic-claude.ts` first.
 */
import { TokenManager, createTokenStore } from "@/index.ts";

async function main() {
  const store = await createTokenStore();
  const manager = new TokenManager(store);

  const creds = await store.list("claude");
  if (creds.length === 0) {
    console.error("No credentials found. Run examples/basic-claude.ts first.");
    process.exit(1);
  }

  const cred = creds[0]!;
  const originalToken = cred.tokenSet.accessToken;

  console.log(`Account:        ${cred.metadata.accountId}`);
  console.log(`Token prefix:   ${originalToken.slice(0, 20)}...`);
  console.log(`Expires at:     ${new Date(cred.tokenSet.expiresAt).toISOString()}`);

  // Force expiry so getToken() is forced to refresh
  cred.tokenSet.expiresAt = Date.now() - 1000;
  await store.set("claude", cred.metadata.accountId, cred);
  console.log("\nForced token expiry. Calling getToken()...");

  const newToken = await manager.getToken("claude");

  const refreshed = (await store.list("claude")).find(
    (c) => c.metadata.accountId === cred.metadata.accountId,
  )!;

  console.log(`New token prefix: ${newToken.slice(0, 20)}...`);
  console.log(`New expires at:   ${new Date(refreshed.tokenSet.expiresAt).toISOString()}`);
  console.log(`Token changed:    ${originalToken !== newToken}`);

  // Verify the refreshed token works against the real API
  console.log("\nVerifying refreshed token with API call...");
  const headers = await manager.getAuthHeaders("claude");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 32,
      messages: [{ role: "user", content: "Reply with just the word OK." }],
    }),
  });

  if (!response.ok) {
    console.error(`API error: ${response.status} ${await response.text()}`);
    process.exit(1);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  console.log(`API response:     ${data.content[0]?.text}`);
  console.log("\nToken refresh: OK");
}

main().catch(console.error);
