import { listProviders } from "@/core/providers/registry.ts";
import { createTokenStore } from "@/adapters/node/storage/index.ts";
import type { StoreType } from "@/adapters/node/storage/index.ts";
import { TokenManager } from "@/core/token-manager.ts";
import { printError, printSuccess, promptSelect } from "@/adapters/node/cli/ui.ts";

export async function logoutCommand(providerArg?: string, storeType?: StoreType): Promise<void> {
  await Promise.all([
    import("@/core/providers/claude.ts"),
    import("@/core/providers/openai-codex.ts"),
  ]);

  const providers = listProviders();
  let providerName = providerArg;
  if (!providerName) {
    providerName = await promptSelect("Select a provider to logout:", providers);
  }

  const store = await createTokenStore(storeType);
  const manager = new TokenManager(store);

  try {
    await manager.logout(providerName);
    printSuccess(`Logged out of ${providerName}. Stored tokens removed.`);
  } catch (err) {
    printError(`Logout failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
