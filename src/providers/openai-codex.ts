import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { executePKCEFlow, refreshAccessToken } from "../core/oauth-pkce.js";
import { decodeJWT } from "../token/jwt.js";
import type {
	AuthHeaders,
	LoginOptions,
	Provider,
	ProviderConfig,
	TokenSet,
} from "../types.js";
import { registerProvider } from "./registry.js";

const OPENAI_CODEX_CONFIG: ProviderConfig = {
	name: "openai-codex",
	displayName: "OpenAI ChatGPT Plus/Pro",
	authorizationEndpoint: "https://auth.openai.com/oauth/authorize",
	tokenEndpoint: "https://auth.openai.com/oauth/token",
	clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
	redirectUri: "http://localhost:1455/auth/callback",
	scopes: ["openid", "profile", "email", "offline_access"],
	grantType: "authorization_code",
};

export class OpenAICodexProvider implements Provider {
	readonly config = OPENAI_CODEX_CONFIG;

	async login(options?: LoginOptions): Promise<TokenSet> {
		return executePKCEFlow({
			config: this.config,
			loginOptions: {
				...options,
				port: options?.port ?? 1455,
			},
		});
	}

	async refresh(refreshToken: string): Promise<TokenSet> {
		return refreshAccessToken(this.config, refreshToken);
	}

	getAuthHeaders(accessToken: string): AuthHeaders {
		return {
			authorization: `Bearer ${accessToken}`,
			"content-type": "application/json",
		};
	}

	getAccountId(tokenSet: TokenSet): string {
		if (tokenSet.idToken) {
			try {
				const claims = decodeJWT(tokenSet.idToken);
				if (claims.sub) return claims.sub;
			} catch {
				// Fall through
			}
		}
		// Fallback: hash the access token
		const { createHash } = require("node:crypto") as typeof import("node:crypto");
		return createHash("sha256")
			.update(tokenSet.accessToken)
			.digest("hex")
			.slice(0, 16);
	}

	getAccountLabel(tokenSet: TokenSet): string | undefined {
		if (tokenSet.idToken) {
			try {
				const claims = decodeJWT(tokenSet.idToken);
				if (claims.email) return claims.email as string;
			} catch {
				// Fall through
			}
		}
		return undefined;
	}
}

/**
 * Import tokens from an existing Codex CLI installation.
 * Reads from ~/.codex/auth.json or $CODEX_HOME/auth.json.
 */
export function importFromCodexCli(): TokenSet | null {
	const paths = [
		process.env.CODEX_HOME ? join(process.env.CODEX_HOME, "auth.json") : null,
		join(homedir(), ".codex", "auth.json"),
	].filter(Boolean) as string[];

	for (const filePath of paths) {
		if (!existsSync(filePath)) continue;

		try {
			const content = readFileSync(filePath, "utf8");
			const data = JSON.parse(content) as {
				tokens?: {
					access_token?: string;
					refresh_token?: string;
					id_token?: string;
				};
			};

			if (!data.tokens?.access_token) continue;

			return {
				accessToken: data.tokens.access_token,
				refreshToken: data.tokens.refresh_token ?? null,
				expiresAt: Date.now() + 3600_000, // Assume 1 hour, will refresh as needed
				idToken: data.tokens.id_token,
				tokenType: "bearer",
			};
		} catch {
			continue;
		}
	}

	return null;
}

// Auto-register
registerProvider("openai-codex", () => new OpenAICodexProvider());
