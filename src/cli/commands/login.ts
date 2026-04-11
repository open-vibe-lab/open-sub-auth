import { listProviders } from "../../providers/registry.js";
import { createTokenStore } from "../../storage/store.js";
import { TokenManager } from "../../token/manager.js";
import { promptSelect, printError, printSuccess } from "../ui.js";

export async function loginCommand(providerArg?: string): Promise<void> {
	// Ensure providers are registered
	await import("../../providers/claude.js");
	await import("../../providers/openai-codex.js");

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
	const store = await createTokenStore();
	const manager = new TokenManager(store);

	try {
		const credential = await manager.login(providerName, { manual });
		const label = credential.metadata.accountLabel
			? ` (${credential.metadata.accountLabel})`
			: "";
		printSuccess(
			`Logged in to ${providerName}${label}. Token stored securely.`,
		);
	} catch (err) {
		printError(
			`Login failed: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	}
}
