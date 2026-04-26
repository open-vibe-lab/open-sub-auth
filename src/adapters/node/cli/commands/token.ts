import { listProviders } from "@/core/providers/registry.ts";
import { createTokenStore } from "@/adapters/node/storage/index.ts";
import type { StoreType } from "@/adapters/node/storage/index.ts";
import { TokenManager } from "@/core/token-manager.ts";
import { printError, promptSelect } from "@/adapters/node/cli/ui.ts";

export async function tokenCommand(providerArg?: string, storeType?: StoreType): Promise<void> {
  await Promise.all([
    import("@/core/providers/claude.ts"),
    import("@/core/providers/openai-codex.ts"),
  ]);

  const providers = listProviders();
  let providerName = providerArg;
  if (!providerName) {
    providerName = await promptSelect("Select a provider:", providers);
  }

  const store = await createTokenStore(storeType);
  const manager = new TokenManager(store);

  try {
    const token = await manager.getToken(providerName);
    process.stdout.write(token);
  } catch (err) {
    printError(`Failed to get token: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
