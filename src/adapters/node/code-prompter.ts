import type { CodePrompter } from "@/core/abstractions/index.ts";
import { promptForCode } from "@/adapters/node/manual-code-input.ts";

export const nodeCodePrompter: CodePrompter = {
  promptForCode(expectedState) {
    return promptForCode(expectedState);
  },
};
