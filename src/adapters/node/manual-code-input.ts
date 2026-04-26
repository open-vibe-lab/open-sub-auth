import { createInterface } from "node:readline";
import { OAuthCallbackError, StateMismatchError } from "@/errors.ts";
import type { AuthorizationResult } from "@/types.ts";

/**
 * Parse a "code#state" string (Anthropic's manual paste format).
 * Also supports a plain authorization code (state validated separately).
 */
export function parseCodeAndState(input: string, expectedState: string): AuthorizationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new OAuthCallbackError("Empty authorization code input");
  }

  const hashIndex = trimmed.indexOf("#");
  if (hashIndex !== -1) {
    const code = trimmed.slice(0, hashIndex);
    const state = trimmed.slice(hashIndex + 1);
    if (!code) {
      throw new OAuthCallbackError("Empty authorization code in code#state input");
    }
    if (state !== expectedState) {
      throw new StateMismatchError();
    }
    return { code, state };
  }

  // No "#" found — assume just the code was provided
  return { code: trimmed, state: expectedState };
}

/** Prompt the user to paste the authorization code from their browser */
export function promptForCode(expectedState: string): Promise<AuthorizationResult> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr, // Use stderr so stdout stays clean for piping
    });

    rl.question("Paste the authorization code (or code#state) from your browser: ", (answer) => {
      rl.close();
      try {
        resolve(parseCodeAndState(answer, expectedState));
      } catch (err) {
        reject(err);
      }
    });
  });
}
