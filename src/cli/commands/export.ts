import { createTokenStore } from "@/storage/store.ts";

export async function exportCommand(): Promise<void> {
  const store = await createTokenStore();
  const credentials = await store.list();
  process.stdout.write(JSON.stringify(credentials, null, 2) + "\n");
}
