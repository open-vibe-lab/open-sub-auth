import { createTokenStore } from "@/storage/store.ts";
import { printError, printSuccess } from "@/cli/ui.ts";
import type { StoredCredential } from "@/types.ts";

export async function importCommand(): Promise<void> {
  if (process.stdin.isTTY) {
    process.stderr.write(
      "Reading credentials from stdin (pipe JSON or press Ctrl+D when done)...\n",
    );
  }

  const parts: string[] = [];
  for await (const chunk of process.stdin) {
    parts.push(typeof chunk === "string" ? chunk : (chunk as Buffer).toString("utf8"));
  }
  const json = parts.join("").trim();

  if (!json) {
    printError("No input received. Pipe a JSON array of credentials to stdin.");
    process.exit(1);
  }

  let credentials: StoredCredential[];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error("Input must be a JSON array of credentials");
    }
    // Validate each entry has required fields
    for (const item of parsed) {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof (item as Record<string, unknown>).tokenSet !== "object" ||
        typeof (item as Record<string, unknown>).metadata !== "object"
      ) {
        throw new Error(
          "Each credential must have a 'tokenSet' and 'metadata' field (StoredCredential format)",
        );
      }
      const meta = (item as StoredCredential).metadata;
      const ts = (item as StoredCredential).tokenSet;
      if (!meta?.provider || !meta?.accountId || !ts?.accessToken) {
        throw new Error(
          "Each credential must have metadata.provider, metadata.accountId, and tokenSet.accessToken",
        );
      }
    }
    credentials = parsed as StoredCredential[];
  } catch (err) {
    printError(`Invalid input: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const store = await createTokenStore();
  let count = 0;
  for (const cred of credentials) {
    await store.set(cred.metadata.provider, cred.metadata.accountId, cred);
    count++;
  }

  printSuccess(`Imported ${count} credential(s).`);
}
