/**
 * Example: Managing multiple accounts across providers
 *
 * Usage:
 *   npx tsx examples/multi-account.ts
 */
import { TokenManager, createTokenStore } from "@/index.ts";

async function main() {
  const store = await createTokenStore();
  const manager = new TokenManager(store);

  // Check status of all stored credentials
  const statuses = await manager.status();

  if (statuses.length === 0) {
    console.log("No stored credentials. Login to get started:");
    console.log("  npx tsx examples/basic-claude.ts");
    console.log("  npx tsx examples/basic-openai.ts");
    return;
  }

  console.log("Stored credentials:\n");
  for (const s of statuses) {
    const account = s.accountLabel ?? s.accountId;
    const status = s.isExpired ? "EXPIRED" : "Valid";
    const expires = s.isExpired
      ? ""
      : ` (expires in ${Math.round((s.expiresAt - Date.now()) / 60_000)}m)`;

    console.log(`  ${s.displayName}: ${account} [${status}]${expires}`);

    if (!s.isExpired) {
      // Get headers for this specific account
      const headers = await manager.getAuthHeaders(s.provider, s.accountId);
      console.log(`    Headers: ${JSON.stringify(Object.keys(headers))}`);
    }
  }
}

main().catch(console.error);
