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
      exclude: ["src/cli/**"],
    },
  },
  pack: [
    {
      entry: ["src/index.ts"],
      format: ["esm", "cjs"],
      dts: true,
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
  ],
  staged: {
    "*.{js,ts,tsx}": "vp check --fix",
  },
});
