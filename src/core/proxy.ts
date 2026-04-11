import { EnvHttpProxyAgent, setGlobalDispatcher } from "node:undici";

/**
 * Initialize HTTP proxy support for all outgoing fetch() calls.
 *
 * Reads HTTPS_PROXY / HTTP_PROXY / NO_PROXY environment variables automatically.
 * If a proxyUrl is provided, it overrides those env vars before installing the dispatcher.
 *
 * Call this once at startup — CLI entry point or library init — before any network requests.
 *
 * @param proxyUrl - Optional explicit proxy URL (e.g. "http://proxy.corp:8080").
 *                   Sets both HTTPS_PROXY and HTTP_PROXY env vars when provided.
 */
export function initProxy(proxyUrl?: string): void {
  if (proxyUrl) {
    process.env.HTTPS_PROXY = proxyUrl;
    process.env.HTTP_PROXY = proxyUrl;
  }
  setGlobalDispatcher(new EnvHttpProxyAgent());
}
