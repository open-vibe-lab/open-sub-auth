import { createTokenStore } from "../../storage/store.js";
import { TokenManager } from "../../token/manager.js";
import { printError } from "../ui.js";

export async function statusCommand(): Promise<void> {
	await import("../../providers/claude.js");
	await import("../../providers/openai-codex.js");

	const store = await createTokenStore();
	const manager = new TokenManager(store);

	try {
		const statuses = await manager.status();

		if (statuses.length === 0) {
			console.log("No stored credentials. Run `open-sub-auth login` to get started.");
			return;
		}

		// Table header
		const header = [
			"Provider".padEnd(22),
			"Account".padEnd(20),
			"Status".padEnd(10),
			"Expires",
		].join("  ");

		console.log(header);
		console.log("-".repeat(header.length));

		for (const s of statuses) {
			const account = s.accountLabel ?? s.accountId.slice(0, 12) + "...";
			const expires = s.isExpired
				? "-"
				: formatDuration(s.expiresAt - Date.now());

			console.log(
				[
					s.displayName.padEnd(22),
					account.padEnd(20),
					(s.isExpired ? "Expired" : "Valid").padEnd(10),
					expires,
				].join("  "),
			);
		}
	} catch (err) {
		printError(
			`Failed to get status: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	}
}

function formatDuration(ms: number): string {
	if (ms <= 0) return "-";
	const hours = Math.floor(ms / 3600_000);
	const minutes = Math.floor((ms % 3600_000) / 60_000);
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}
