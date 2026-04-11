/**
 * Example: Login to OpenAI Codex and call the ChatGPT backend API
 *
 * Usage:
 *   npx tsx examples/basic-openai.ts
 *
 * ⚠️ WARNING: The Codex API endpoint (chatgpt.com/backend-api/codex/responses)
 * is a private/undocumented endpoint. It may change or be restricted at any time.
 * Use at your own risk.
 */
import { TokenManager, createTokenStore, importFromCodexCli } from "../src/index.js";

async function main() {
	const store = await createTokenStore();
	const manager = new TokenManager(store);

	// Option 1: Import existing tokens from Codex CLI
	const existing = importFromCodexCli();
	if (existing) {
		console.log("Found existing Codex CLI tokens, importing...");
		// You would store these via the store directly
	}

	// Option 2: Fresh login
	console.log("Starting OpenAI Codex OAuth login...");
	const credential = await manager.login("openai-codex");
	const label = credential.metadata.accountLabel ?? credential.metadata.accountId;
	console.log(`Logged in as: ${label}`);

	// Get authenticated headers
	const headers = await manager.getAuthHeaders("openai-codex");

	// Call the Codex API (private endpoint)
	const response = await fetch(
		"https://chatgpt.com/backend-api/codex/responses",
		{
			method: "POST",
			headers,
			body: JSON.stringify({
				model: "gpt-5-codex-mini",
				input: [
					{
						role: "user",
						type: "message",
						content: "Hello! Say hi in one sentence.",
					},
				],
				stream: false,
			}),
		},
	);

	if (!response.ok) {
		console.error(`API error: ${response.status} ${await response.text()}`);
		return;
	}

	const data = await response.json();
	console.log("Response:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
