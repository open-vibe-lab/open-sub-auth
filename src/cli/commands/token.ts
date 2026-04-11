import { listProviders } from "../../providers/registry.js";
import { createTokenStore } from "../../storage/store.js";
import { TokenManager } from "../../token/manager.js";
import { printError, promptSelect } from "../ui.js";

export async function tokenCommand(providerArg?: string): Promise<void> {
	await import("../../providers/claude.js");
	await import("../../providers/openai-codex.js");

	const providers = listProviders();
	let providerName = providerArg;
	if (!providerName) {
		providerName = await promptSelect("Select a provider:", providers);
	}

	const store = await createTokenStore();
	const manager = new TokenManager(store);

	try {
		const token = await manager.getToken(providerName);
		// Output raw token to stdout (for piping into other tools)
		process.stdout.write(token);
	} catch (err) {
		printError(
			`Failed to get token: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	}
}
