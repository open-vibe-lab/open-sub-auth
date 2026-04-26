/* eslint-disable */
// Minimal build script for the demo extension.
//   node build.mjs           # one-shot bundle
//   node build.mjs --watch   # rebuild on change
//
// Output goes into ./dist/, which is what manifest.json points to.

import { build, context } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const outdir = "dist";

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const common = {
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir,
  logLevel: "info",
  sourcemap: watch ? "inline" : false,
};

const config = {
  ...common,
  entryPoints: {
    "service-worker": "src/service-worker.ts",
    popup: "src/popup.ts",
  },
};

await copyFile("manifest.json", `${outdir}/manifest.json`);
await copyFile("popup.html", `${outdir}/popup.html`);

if (watch) {
  const ctx = await context(config);
  await ctx.watch();
  console.log("watching for changes…");
} else {
  await build(config);
  console.log(`built → ${outdir}/`);
}
