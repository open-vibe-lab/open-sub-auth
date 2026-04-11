import { createServer, type Server } from "node:http";
import { OAuthCallbackError, OAuthTimeoutError } from "@/errors.ts";
import type { AuthorizationResult } from "@/types.ts";

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Authorization Successful</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f8f9fa}
.card{text-align:center;padding:2rem;border-radius:12px;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
h1{color:#22c55e;font-size:1.5rem}p{color:#666}</style></head>
<body><div class="card"><h1>Authorization Successful</h1><p>You can close this window and return to the terminal.</p></div></body></html>`;

const ERROR_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Authorization Failed</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f8f9fa}
.card{text-align:center;padding:2rem;border-radius:12px;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
h1{color:#ef4444;font-size:1.5rem}p{color:#666}</style></head>
<body><div class="card"><h1>Authorization Failed</h1><p>Something went wrong. Please try again.</p></div></body></html>`;

export interface CallbackServerOptions {
  /** Port to listen on (0 = random available port) */
  port?: number;
  /** Expected state parameter for CSRF validation */
  expectedState: string;
  /** Timeout in milliseconds (default: 120000) */
  timeout?: number;
  /** Path to listen on (default: "/callback") */
  path?: string;
}

/** Start a local HTTP server to receive the OAuth callback redirect */
export function startCallbackServer(
  options: CallbackServerOptions,
): Promise<{ result: Promise<AuthorizationResult>; port: number; close: () => void }> {
  const { expectedState, timeout = 120_000, path = "/callback" } = options;
  const port = options.port ?? 0;

  return new Promise((resolveSetup, _rejectSetup) => {
    let server: Server;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const resultPromise = new Promise<AuthorizationResult>((resolveResult, rejectResult) => {
      server = createServer((req, res) => {
        const url = new URL(req.url ?? "/", `http://localhost`);

        if (url.pathname !== path) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          const errorDesc = url.searchParams.get("error_description") ?? error;
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(ERROR_HTML);
          cleanup();
          rejectResult(new OAuthCallbackError(`OAuth error: ${errorDesc}`));
          return;
        }

        if (!code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(ERROR_HTML);
          cleanup();
          rejectResult(new OAuthCallbackError("No authorization code in callback"));
          return;
        }

        if (state && state !== expectedState) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(ERROR_HTML);
          cleanup();
          rejectResult(
            new OAuthCallbackError("State mismatch — possible CSRF attack. Please try again."),
          );
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(SUCCESS_HTML);
        cleanup();
        resolveResult({ code, state: state ?? expectedState });
      });

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        server.close();
      };

      timeoutId = setTimeout(() => {
        cleanup();
        rejectResult(new OAuthTimeoutError(timeout));
      }, timeout);

      server.on("error", (err) => {
        cleanup();
        rejectResult(new OAuthCallbackError(`Callback server error: ${err.message}`));
      });

      server.listen(port, "127.0.0.1", () => {
        const addr = server.address();
        const actualPort = typeof addr === "object" && addr ? addr.port : port;
        resolveSetup({
          result: resultPromise,
          port: actualPort,
          close: cleanup,
        });
      });
    });
  });
}
