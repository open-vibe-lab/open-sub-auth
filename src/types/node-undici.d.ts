// Type declarations for the Node.js built-in `node:undici` module.
// @types/node v22 does not yet include these; we re-export from the
// already-installed `undici-types` package which ships the canonical types.
declare module "node:undici" {
  export { EnvHttpProxyAgent, setGlobalDispatcher } from "undici-types";
}
