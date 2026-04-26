import type { BrowserLauncher } from "@/core/abstractions/index.ts";
import { openBrowser } from "@/adapters/node/browser.ts";

export const nodeBrowserLauncher: BrowserLauncher = {
  open(url) {
    openBrowser(url);
  },
};
