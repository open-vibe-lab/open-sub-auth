/**
 * In-memory mock of the subset of chrome.* APIs used by the chrome-extension
 * adapter. Wire it up via `installMockChrome()` in tests, and use
 * `chromeMock.fireTabUpdate(...)` to simulate redirects.
 */
import type {
  ChromeAPI,
  ChromeStorageArea,
  ChromeTab,
  ChromeTabChangeInfo,
  TabUpdatedListener,
} from "@/adapters/chrome-extension/chrome-api.ts";

export interface MockChrome extends ChromeAPI {
  /** Fires the registered tabs.onUpdated listeners. */
  fireTabUpdate(tabId: number, info: ChromeTabChangeInfo, tab?: ChromeTab): void;
  /** Tabs that have been opened via tabs.create. */
  openedTabs: ChromeTab[];
  /** Tab ids that have been removed via tabs.remove. */
  removedTabIds: number[];
  /** Reset all mock state. */
  reset(): void;
}

export function createMockChrome(): MockChrome {
  let nextTabId = 100;
  const listeners = new Set<TabUpdatedListener>();
  const openedTabs: ChromeTab[] = [];
  const removedTabIds: number[] = [];
  const storage = new Map<string, unknown>();

  const localArea: ChromeStorageArea = {
    async get(keys) {
      if (keys === null || keys === undefined) {
        return Object.fromEntries(storage);
      }
      const arr = typeof keys === "string" ? [keys] : keys;
      const out: Record<string, unknown> = {};
      for (const k of arr) {
        if (storage.has(k)) out[k] = storage.get(k);
      }
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) storage.set(k, v);
    },
    async remove(keys) {
      const arr = typeof keys === "string" ? [keys] : keys;
      for (const k of arr) storage.delete(k);
    },
    async clear() {
      storage.clear();
    },
  };

  return {
    tabs: {
      async create({ url }) {
        const tab: ChromeTab = { id: nextTabId++, url, active: true, windowId: 1 };
        openedTabs.push(tab);
        return tab;
      },
      async remove(tabId) {
        const arr = Array.isArray(tabId) ? tabId : [tabId];
        for (const id of arr) removedTabIds.push(id);
      },
      onUpdated: {
        addListener(l) {
          listeners.add(l);
        },
        removeListener(l) {
          listeners.delete(l);
        },
      },
    },
    storage: {
      local: localArea,
    },
    fireTabUpdate(tabId, info, tab) {
      const t = tab ?? { id: tabId, url: info.url, active: true, windowId: 1 };
      for (const l of listeners) l(tabId, info, t);
    },
    openedTabs,
    removedTabIds,
    reset() {
      listeners.clear();
      openedTabs.length = 0;
      removedTabIds.length = 0;
      storage.clear();
      nextTabId = 100;
    },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __mockChrome: MockChrome | undefined;
}

export function installMockChrome(): MockChrome {
  const mock = createMockChrome();
  (globalThis as unknown as { chrome: MockChrome }).chrome = mock;
  globalThis.__mockChrome = mock;
  return mock;
}

export function uninstallMockChrome(): void {
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
  delete globalThis.__mockChrome;
}
