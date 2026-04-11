import { describe, expect, it } from "vitest";
import { startCallbackServer } from "../../src/core/callback-server.js";
import { parseCodeAndState } from "../../src/core/manual-code-input.js";
import { buildAuthorizationUrl } from "../../src/core/oauth-pkce.js";
import type { ProviderConfig } from "../../src/types.js";

const TEST_CONFIG: ProviderConfig = {
	name: "test",
	displayName: "Test Provider",
	authorizationEndpoint: "https://auth.example.com/authorize",
	tokenEndpoint: "https://auth.example.com/token",
	clientId: "test-client-id",
	redirectUri: "http://localhost:3000/callback",
	scopes: ["openid", "profile"],
	grantType: "authorization_code",
};

describe("buildAuthorizationUrl", () => {
	it("includes all required parameters", () => {
		const url = buildAuthorizationUrl(
			TEST_CONFIG,
			"test-challenge",
			"test-state",
			"http://localhost:3000/callback",
		);
		const parsed = new URL(url);

		expect(parsed.origin).toBe("https://auth.example.com");
		expect(parsed.pathname).toBe("/authorize");
		expect(parsed.searchParams.get("response_type")).toBe("code");
		expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
		expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:3000/callback");
		expect(parsed.searchParams.get("code_challenge")).toBe("test-challenge");
		expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
		expect(parsed.searchParams.get("state")).toBe("test-state");
		expect(parsed.searchParams.get("scope")).toBe("openid profile");
	});

	it("omits scope when no scopes configured", () => {
		const configNoScopes = { ...TEST_CONFIG, scopes: undefined };
		const url = buildAuthorizationUrl(
			configNoScopes,
			"challenge",
			"state",
			"http://localhost/cb",
		);
		const parsed = new URL(url);
		expect(parsed.searchParams.has("scope")).toBe(false);
	});
});

describe("parseCodeAndState", () => {
	it("parses code#state format correctly", () => {
		const result = parseCodeAndState("mycode123#mystate456", "mystate456");
		expect(result.code).toBe("mycode123");
		expect(result.state).toBe("mystate456");
	});

	it("accepts plain code when no # is present", () => {
		const result = parseCodeAndState("mycode123", "expected-state");
		expect(result.code).toBe("mycode123");
		expect(result.state).toBe("expected-state");
	});

	it("trims whitespace from input", () => {
		const result = parseCodeAndState("  mycode#mystate  ", "mystate");
		expect(result.code).toBe("mycode");
		expect(result.state).toBe("mystate");
	});

	it("throws on empty input", () => {
		expect(() => parseCodeAndState("", "state")).toThrow("Empty authorization code");
	});

	it("throws on state mismatch", () => {
		expect(() => parseCodeAndState("code#wrong-state", "expected-state")).toThrow(
			"state parameter mismatch",
		);
	});

	it("throws when code is empty before #", () => {
		expect(() => parseCodeAndState("#state", "state")).toThrow("Empty authorization code");
	});
});

describe("startCallbackServer", () => {
	it("captures authorization code from GET request", async () => {
		const server = await startCallbackServer({
			expectedState: "test-state",
			port: 0,
		});

		// Make a request to the callback
		const url = `http://127.0.0.1:${server.port}/callback?code=test-code&state=test-state`;
		const response = await fetch(url);
		expect(response.ok).toBe(true);

		const result = await server.result;
		expect(result.code).toBe("test-code");
		expect(result.state).toBe("test-state");
	});

	it("rejects on state mismatch", async () => {
		const server = await startCallbackServer({
			expectedState: "expected",
			port: 0,
		});

		// Attach catch handler early to prevent unhandled rejection
		const resultPromise = server.result.catch((e) => e);

		const url = `http://127.0.0.1:${server.port}/callback?code=test-code&state=wrong`;
		await fetch(url);

		const error = await resultPromise;
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain("State mismatch");
	});

	it("rejects on OAuth error response", async () => {
		const server = await startCallbackServer({
			expectedState: "state",
			port: 0,
		});

		const resultPromise = server.result.catch((e) => e);

		const url = `http://127.0.0.1:${server.port}/callback?error=access_denied&error_description=User+denied`;
		await fetch(url);

		const error = await resultPromise;
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain("User denied");
	});

	it("returns 404 for non-callback paths", async () => {
		const server = await startCallbackServer({
			expectedState: "state",
			port: 0,
		});

		const response = await fetch(`http://127.0.0.1:${server.port}/other`);
		expect(response.status).toBe(404);
		server.close();
	});

	it("rejects on missing code", async () => {
		const server = await startCallbackServer({
			expectedState: "state",
			port: 0,
		});

		const resultPromise = server.result.catch((e) => e);

		const url = `http://127.0.0.1:${server.port}/callback?state=state`;
		await fetch(url);

		const error = await resultPromise;
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain("No authorization code");
	});
});
