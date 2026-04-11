import { listProviders } from "@/providers/registry.ts";
import { createTokenStore } from "@/storage/store.ts";
import { TokenManager } from "@/token/manager.ts";
import { printError, promptSelect } from "@/cli/ui.ts";

export async function tokenCommand(providerArg?: string): Promise<void> {
  await Promise.all([import("@/providers/claude.ts"), import("@/providers/openai-codex.ts")]);

  const providers = listProviders();
  let providerName = providerArg;
  if (!providerName) {
    providerName = await promptSelect("Select a provider:", providers);
  }

  const store = await createTokenStore();
  const manager = new TokenManager(store);

  try {
    const token = await manager.getToken(providerName);
    process.stdout.write(token);
  } catch (err) {
    printError(`Failed to get token: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
