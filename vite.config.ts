import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite-plus";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  fmt: {
    ignorePatterns: ["dist/**"],
    semi: true,
    singleQuote: false,
  },
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/adapters/node/cli/**"],
    },
  },
  pack: [
    {
      // Default entry — Node-bound, backward-compatible
      entry: ["src/index.ts"],
      format: ["esm", "cjs"],
      dts: true,
      sourcemap: true,
      clean: true,
      outDir: "dist",
    },
    {
      // Pure core entry — runtime-agnostic, no Node deps, no auto-registration
      entry: ["src/core/index.ts"],
      format: ["esm", "cjs"],
      dts: true,
      sourcemap: true,
      outDir: "dist/core",
    },
    {
      // Explicit Node adapter entry
      entry: ["src/adapters/node/index.ts"],
      format: ["esm", "cjs"],
      dts: true,
      sourcemap: true,
      outDir: "dist/adapters/node",
    },
    {
      // Chrome extension adapter entry (zero Node deps)
      entry: ["src/adapters/chrome-extension/index.ts"],
      format: ["esm", "cjs"],
      dts: true,
      sourcemap: true,
      outDir: "dist/adapters/chrome-extension",
    },
    {
      // CLI binary
      entry: ["src/adapters/node/cli/index.ts"],
      format: ["esm"],
      banner: { js: "#!/usr/bin/env node" },
      outDir: "dist/cli",
      sourcemap: true,
    },
  ],
  staged: {
    "*.{js,ts,tsx}": "vp check --fix",
  },
});
