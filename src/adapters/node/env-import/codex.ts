import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { TokenSet } from "@/types.ts";

/**
 * Import tokens from an existing Codex CLI installation.
 *
 * Resolution rules:
 * - If `CODEX_HOME` is set, look ONLY at `$CODEX_HOME/auth.json` (no homedir fallback).
 *   This makes test isolation possible: pointing CODEX_HOME at a missing dir reliably
 *   yields null, instead of silently falling through to the user's real ~/.codex.
 * - Otherwise, look at `~/.codex/auth.json`.
 */
export function importFromCodexCli(): TokenSet | null {
  const filePath = process.env.CODEX_HOME
    ? join(process.env.CODEX_HOME, "auth.json")
    : join(homedir(), ".codex", "auth.json");

  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf8");
    const data = JSON.parse(content) as {
      tokens?: {
        access_token?: string;
        refresh_token?: string;
        id_token?: string;
      };
    };

    if (!data.tokens?.access_token) return null;

    return {
      accessToken: data.tokens.access_token,
      refreshToken: data.tokens.refresh_token ?? null,
      expiresAt: Date.now() + 3600_000, // Assume 1 hour, will refresh as needed
      idToken: data.tokens.id_token,
      tokenType: "bearer",
    };
  } catch {
    return null;
  }
}
