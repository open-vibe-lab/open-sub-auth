import { execFile } from "node:child_process";
import { platform } from "node:os";

/** Open a URL in the user's default browser. Does not throw on failure. */
export function openBrowser(url: string): void {
  const os = platform();
  try {
    if (os === "darwin") {
      execFile("open", [url]);
    } else if (os === "win32") {
      execFile("cmd", ["/c", "start", "", url]);
    } else {
      execFile("xdg-open", [url]);
    }
  } catch {
    // Silently ignore — caller should provide fallback instructions
  }
}
