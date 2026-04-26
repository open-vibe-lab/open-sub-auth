/**
 * Popup UI. Sends messages to the service worker and renders results.
 *
 * The popup does not import the auth library directly — all OAuth state
 * lives in the service worker so it survives popup close. The popup is
 * just a remote control.
 */

const log = document.getElementById("log") as HTMLDivElement;
const codePaste = document.getElementById("code-paste") as HTMLDivElement;
const codeInput = document.getElementById("code-input") as HTMLInputElement;

function append(line: string): void {
  const ts = new Date().toLocaleTimeString();
  log.textContent += `\n[${ts}] ${line}`;
  log.scrollTop = log.scrollHeight;
}

async function send<T = unknown>(msg: object): Promise<T> {
  const res = (await chrome.runtime.sendMessage(msg)) as {
    ok: boolean;
    result?: T;
    error?: string;
  };
  if (!res?.ok) throw new Error(res?.error ?? "unknown error");
  return res.result as T;
}

async function refreshStatus(): Promise<void> {
  try {
    const status = await send<
      Array<{ provider: string; accountLabel?: string; isExpired: boolean }>
    >({
      type: "status",
    });
    append(
      "status: " +
        (status.length === 0
          ? "(no credentials)"
          : status
              .map(
                (s) =>
                  `${s.provider}${s.accountLabel ? `(${s.accountLabel})` : ""}${s.isExpired ? "[expired]" : ""}`,
              )
              .join(", ")),
    );
  } catch (err) {
    append(`status error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

document.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const action = btn.dataset.action;
    const provider = btn.dataset.provider;
    if (!action || !provider) return;
    append(`${action} ${provider}…`);
    try {
      if (action === "login") {
        // Claude login may need a code paste — show the input form preemptively
        if (provider === "claude") codePaste.style.display = "block";
        const result = await send({ type: "login", provider });
        append(`login ok: ${JSON.stringify(result)}`);
        codePaste.style.display = "none";
      } else if (action === "logout") {
        await send({ type: "logout", provider });
        append("logout ok");
      } else if (action === "test") {
        const result = await send({ type: "test-call", provider });
        append(`test: ${JSON.stringify(result).slice(0, 200)}`);
      }
    } catch (err) {
      append(`error: ${err instanceof Error ? err.message : String(err)}`);
      codePaste.style.display = "none";
    }
    await refreshStatus();
  });
});

document.getElementById("code-submit")!.addEventListener("click", async () => {
  const input = codeInput.value;
  codeInput.value = "";
  try {
    await send({ type: "submit-code", input });
    append("code submitted");
  } catch (err) {
    append(`submit error: ${err instanceof Error ? err.message : String(err)}`);
  }
});

document.getElementById("code-cancel")!.addEventListener("click", async () => {
  await send({ type: "cancel-code" });
  codePaste.style.display = "none";
  append("code cancelled");
});

document.getElementById("refresh-status")!.addEventListener("click", () => void refreshStatus());

void refreshStatus();
