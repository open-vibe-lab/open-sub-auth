import { createTokenStore } from "@/storage/store.ts";
import type { StoreType } from "@/storage/store.ts";

export async function exportCommand(storeType?: StoreType): Promise<void> {
  const store = await createTokenStore(storeType);
  const credentials = await store.list();
  process.stdout.write(JSON.stringify(credentials, null, 2) + "\n");
}
