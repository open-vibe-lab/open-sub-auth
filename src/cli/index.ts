import { parseArgs } from "node:util";
import { printError } from "@/cli/ui.ts";

const HELP = `
open-sub-auth - OAuth authentication for AI subscription APIs

Usage:
  open-sub-auth <command> [provider] [options]

Commands:
  login [provider]     Login to an AI provider via OAuth
  logout [provider]    Remove stored tokens for a provider
  status               Show status of all stored credentials
  token [provider]     Output a valid access token to stdout
  providers            List available providers

Options:
  --manual             Use manual code paste mode (for headless/CI)
  --help, -h           Show this help message
  --version, -v        Show version

Examples:
  open-sub-auth login claude
  open-sub-auth login openai-codex
  open-sub-auth login claude --manual
  open-sub-auth token claude | pbcopy
  open-sub-auth status
`.trim();

async function main(): Promise<void> {
  const { positionals } = parseArgs({
    allowPositionals: true,
    strict: false,
  });

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    console.log("0.1.0");
    return;
  }

  const command = positionals[0];
  const providerArg = positionals[1];

  switch (command) {
    case "login": {
      const { loginCommand } = await import("@/cli/commands/login.ts");
      await loginCommand(providerArg);
      break;
    }
    case "logout": {
      const { logoutCommand } = await import("@/cli/commands/logout.ts");
      await logoutCommand(providerArg);
      break;
    }
    case "status": {
      const { statusCommand } = await import("@/cli/commands/status.ts");
      await statusCommand();
      break;
    }
    case "token": {
      const { tokenCommand } = await import("@/cli/commands/token.ts");
      await tokenCommand(providerArg);
      break;
    }
    case "providers": {
      await Promise.all([import("@/providers/claude.ts"), import("@/providers/openai-codex.ts")]);
      const { listProviders } = await import("@/providers/registry.ts");
      const providers = listProviders();
      console.log("Available providers:");
      for (const p of providers) {
        console.log(`  - ${p}`);
      }
      break;
    }
    default: {
      if (command) {
        printError(`Unknown command: ${command}`);
      }
      console.log(HELP);
      process.exit(command ? 1 : 0);
    }
  }
}

// Suppress EPIPE errors (e.g. when stdout is piped to a command that exits early)
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
});

main().catch((err) => {
  printError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
