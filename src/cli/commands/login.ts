import { listProviders } from "@/providers/registry.ts";
import { createTokenStore } from "@/storage/store.ts";
import type { StoreType } from "@/storage/store.ts";
import { TokenManager } from "@/token/manager.ts";
import { promptSelect, printError, printSuccess } from "@/cli/ui.ts";

export async function loginCommand(providerArg?: string, storeType?: StoreType): Promise<void> {
  await Promise.all([import("@/providers/claude.ts"), import("@/providers/openai-codex.ts")]);

  const providers = listProviders();
  if (providers.length === 0) {
    printError("No providers registered.");
    process.exit(1);
  }

  let providerName = providerArg;
  if (!providerName) {
    providerName = await promptSelect("Select a provider:", providers);
  }

  if (!providers.includes(providerName)) {
    printError(`Unknown provider "${providerName}". Available: ${providers.join(", ")}`);
    process.exit(1);
  }

  const manual = process.argv.includes("--manual");
  const store = await createTokenStore(storeType);
  const manager = new TokenManager(store);

  try {
    const credential = await manager.login(providerName, { manual });
    const label = credential.metadata.accountLabel ? ` (${credential.metadata.accountLabel})` : "";
    printSuccess(`Logged in to ${providerName}${label}. Token stored securely.`);
  } catch (err) {
    printError(`Login failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
