import type { BrowserIdentityStorage } from "@agentvisa/browser-identity";

export type JsonRecord = Record<string, unknown>;
export type StatusTone = "info" | "ok" | "warn" | "error";

export const HOLDER_STORAGE_PREFIX = "agentvisa.demo.holder.";
export const STATIC_GUIDED_STORAGE_KEY = "agentvisa.static.guided";
export const FIXED_PLAY_WALLET = "0x0000000000000000000000000000000000000001";

export class PrefixedStorage implements BrowserIdentityStorage {
  constructor(
    readonly storage: Storage,
    readonly prefix: string,
  ) {}

  getItem(key: string): string | null {
    return this.storage.getItem(`${this.prefix}${key}`);
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(`${this.prefix}${key}`, value);
  }
}

export function holderStorage(): PrefixedStorage {
  return new PrefixedStorage(localStorage, HOLDER_STORAGE_PREFIX);
}

export async function getJson(path: string): Promise<JsonRecord> {
  return parseResponse(await fetch(path, { headers: { accept: "application/json" } }));
}

export async function postJson(path: string, body: unknown, token?: string): Promise<JsonRecord> {
  return parseResponse(
    await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    }),
  );
}

async function parseResponse(response: Response): Promise<JsonRecord> {
  const value = (await response.json()) as unknown;
  return isRecord(value) ? value : { status: "error", reason: "invalid_server_response" };
}

export function loadStored<T>(storage: BrowserIdentityStorage, key: string): T | undefined {
  const value = storage.getItem(key);
  if (value === null || value.length === 0) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export function show(result: HTMLElement, value: unknown): void {
  result.textContent = safeJson(value);
}

export function setHuman(humanStatus: HTMLElement | null, message: string, tone: StatusTone): void {
  if (humanStatus === null) return;
  humanStatus.textContent = message;
  humanStatus.classList.remove("is-ok", "is-warn", "is-error");
  if (tone === "ok") humanStatus.classList.add("is-ok");
  if (tone === "warn") humanStatus.classList.add("is-warn");
  if (tone === "error") humanStatus.classList.add("is-error");
}

export function setClaimLink(claimLink: HTMLElement, url: string): void {
  claimLink.hidden = false;
  claimLink.replaceChildren();
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.textContent = `View claim on Arbiscan: ${url}`;
  claimLink.append(anchor);
}

export function clearClaimLink(claimLink: HTMLElement): void {
  claimLink.hidden = true;
  claimLink.replaceChildren();
}

export function plainWalletError(message: string): string {
  if (/user rejected|denied|cancelled|canceled/i.test(message)) {
    return "Wallet request was rejected.";
  }
  if (/chain|network|421614|wrong network|unsupported chain/i.test(message)) {
    return "Switch your wallet to Arbitrum Sepolia (chain 421614) and try again.";
  }
  if (/insufficient funds|gas|fee/i.test(message)) {
    return "Wallet needs a little Arbitrum Sepolia ETH for gas.";
  }
  if (
    /wallet|metamask|provider|connect/i.test(message) &&
    /not found|missing|install/i.test(message)
  ) {
    return "Install MetaMask or Rabby and connect a wallet to continue.";
  }
  return message.length > 160 ? "Claim failed — see technical details." : message;
}

export function setControlsBusy(container: HTMLElement, busy: boolean): void {
  for (const button of container.querySelectorAll("button")) {
    if (button instanceof HTMLButtonElement) {
      button.disabled = busy || button.dataset.locked === "true";
      button.classList.toggle("is-loading", busy && button.classList.contains("primary"));
    }
  }
}

export function truncateId(value: string): string {
  return value.length <= 14 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (value === null) throw new Error(`missing demo element ${id}`);
  return value as T;
}

export function resetDemoProgress(): void {
  localStorage.removeItem(STATIC_GUIDED_STORAGE_KEY);
  clearStorageByPrefix(localStorage, HOLDER_STORAGE_PREFIX);
  clearStorageByPrefix(sessionStorage, HOLDER_STORAGE_PREFIX);
}

export function wireStartOverButton(): void {
  const button = document.getElementById("start-over-button");
  if (button === null) return;
  button.addEventListener("click", () => {
    if (!window.confirm("Start over? Clears demo progress in this browser and reloads.")) {
      return;
    }
    resetDemoProgress();
    location.reload();
  });
}

function clearStorageByPrefix(storage: Storage, prefix: string): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null && key.startsWith(prefix)) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    storage.removeItem(key);
  }
}
