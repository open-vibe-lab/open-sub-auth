/**
 * Minimal ambient declarations for the Chrome extension APIs we use.
 * Kept in-tree so that `@types/chrome` is NOT a dependency — the package
 * stays single-runtime-dep (`cross-keychain`) and consumers using
 * `@types/chrome` see no conflict because these declarations are scoped
 * to this module via a structural import below.
 */

export interface ChromeTab {
  id?: number;
  url?: string;
  active: boolean;
  windowId: number;
}

export interface ChromeTabChangeInfo {
  url?: string;
  status?: "loading" | "complete";
  title?: string;
}

export type TabUpdatedListener = (
  tabId: number,
  changeInfo: ChromeTabChangeInfo,
  tab: ChromeTab,
) => void;

export interface ChromeTabsAPI {
  create(props: { url: string; active?: boolean }): Promise<ChromeTab>;
  remove(tabId: number | number[]): Promise<void>;
  onUpdated: {
    addListener(listener: TabUpdatedListener): void;
    removeListener(listener: TabUpdatedListener): void;
  };
}

export interface ChromeStorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface ChromeStorageAPI {
  local: ChromeStorageArea;
  session?: ChromeStorageArea;
}

export interface ChromeAPI {
  tabs: ChromeTabsAPI;
  storage: ChromeStorageAPI;
}

/**
 * Read the chrome global from the runtime. Throws a descriptive error if
 * absent — common cause is using this adapter outside of a Chrome extension
 * context (e.g. plain web page, Node test without mocking).
 */
export function getChromeAPI(): ChromeAPI {
  const g = globalThis as unknown as { chrome?: ChromeAPI };
  if (!g.chrome) {
    throw new Error(
      "chrome API is not available — this adapter only runs in a Chrome extension context",
    );
  }
  return g.chrome;
}
