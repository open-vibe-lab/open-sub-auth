import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    outDir: "dist",
  },
  {
    entry: ["src/cli/index.ts"],
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    outDir: "dist/cli",
    sourcemap: true,
  },
]);
