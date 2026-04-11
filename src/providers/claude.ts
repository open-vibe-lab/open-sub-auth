import { createHash } from "node:crypto";
import { executePKCEFlow, refreshAccessToken } from "../core/oauth-pkce.js";
import type {
	AuthHeaders,
	LoginOptions,
	Provider,
	ProviderConfig,
	TokenSet,
} from "../types.js";
import { registerProvider } from "./registry.js";

const CLAUDE_CONFIG: ProviderConfig = {
	name: "claude",
	displayName: "Claude Pro/Max",
	authorizationEndpoint: "https://claude.ai/oauth/authorize",
	tokenEndpoint: "https://console.anthropic.com/v1/oauth/token",
	clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
	grantType: "authorization_code",
};

/** Redirect URI used in manual/headless mode (user copies code from browser) */
const MANUAL_REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";

export class ClaudeProvider implements Provider {
	readonly config = CLAUDE_CONFIG;

	async login(options?: LoginOptions): Promise<TokenSet> {
		return executePKCEFlow({
			config: this.config,
			loginOptions: options,
			manualRedirectUri: MANUAL_REDIRECT_URI,
		});
	}

	async refresh(refreshToken: string): Promise<TokenSet> {
		return refreshAccessToken(this.config, refreshToken);
	}

	getAuthHeaders(accessToken: string): AuthHeaders {
		return {
			"x-api-key": accessToken,
			"anthropic-version": "2023-06-01",
			"anthropic-beta": "oauth-2025-04-20",
			"content-type": "application/json",
		};
	}

	getAccountId(tokenSet: TokenSet): string {
		// Claude doesn't provide a profile endpoint, so derive ID from refresh token hash
		const source = tokenSet.refreshToken ?? tokenSet.accessToken;
		return createHash("sha256").update(source).digest("hex").slice(0, 16);
	}

	getAccountLabel(_tokenSet: TokenSet): string | undefined {
		// Claude tokens don't carry user identity info
		return undefined;
	}
}

// Auto-register
registerProvider("claude", () => new ClaudeProvider());
