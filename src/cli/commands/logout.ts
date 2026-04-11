import { listProviders } from "../../providers/registry.js";
import { createTokenStore } from "../../storage/store.js";
import { TokenManager } from "../../token/manager.js";
import { printError, printSuccess, promptSelect } from "../ui.js";

export async function logoutCommand(providerArg?: string): Promise<void> {
	await import("../../providers/claude.js");
	await import("../../providers/openai-codex.js");

	const providers = listProviders();
	let providerName = providerArg;
	if (!providerName) {
		providerName = await promptSelect("Select a provider to logout:", providers);
	}

	const store = await createTokenStore();
	const manager = new TokenManager(store);

	try {
		await manager.logout(providerName);
		printSuccess(`Logged out of ${providerName}. Stored tokens removed.`);
	} catch (err) {
		printError(
			`Logout failed: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	}
}
