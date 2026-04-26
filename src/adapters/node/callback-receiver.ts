import type { CallbackReceiver } from "@/core/abstractions/index.ts";
import { startCallbackServer } from "@/adapters/node/callback-server.ts";

/**
 * Node implementation: starts a local HTTP server on 127.0.0.1 and waits for
 * the OAuth provider to redirect the browser back to /callback.
 *
 * Per-listen `port` (passed via `listen({ port })`) takes precedence over the
 * receiver's default. A default of `0` lets the OS pick a free port.
 */
export function createNodeCallbackReceiver(opts?: { defaultPort?: number }): CallbackReceiver {
  const defaultPort = opts?.defaultPort ?? 0;
  return {
    async listen({ expectedState, timeout, port }) {
      const server = await startCallbackServer({
        port: port ?? defaultPort,
        expectedState,
        timeout,
      });
      return {
        redirectUri: `http://127.0.0.1:${server.port}/callback`,
        result: server.result,
        close: server.close,
      };
    },
  };
}

export const nodeCallbackReceiver: CallbackReceiver = createNodeCallbackReceiver();
