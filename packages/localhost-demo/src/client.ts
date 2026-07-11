import {
  generateBrowserRegistrationProof,
  loadOrCreateBrowserLoginKey,
  loadOrCreateBrowserSemaphoreIdentity,
  signBrowserLoginChallenge,
  type BrowserCredentialGroupSnapshot,
  type BrowserIdentityStorage,
} from "@agentvisa/browser-identity";
import type { Address, Hex } from "viem";

import { connectArbitrumSepoliaWallet, submitGameRewardClaim } from "./browser-claim.js";
import type { DemoRewardClaimPublicConfig } from "./claim-constants.js";

type JsonRecord = Record<string, unknown>;

const HOLDER_STORAGE_PREFIX = "agentvisa.demo.holder.";

interface DemoConfig {
  readonly stableApplicationId: `0x${string}`;
  readonly credentialGroupId: `0x${string}`;
  readonly snarkArtifacts: { readonly wasm: string; readonly zkey: string };
  readonly rewardClaim: DemoRewardClaimPublicConfig;
}

interface EnrollmentState {
  readonly credentialId: `0x${string}`;
  readonly groupId: `0x${string}`;
  readonly group: {
    readonly members: readonly string[];
    readonly root: string;
    readonly size: number;
  };
}

interface AccountState {
  readonly accountId: `0x${string}`;
}

class PrefixedStorage implements BrowserIdentityStorage {
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

const controls = requireElement<HTMLElement>("demo-controls");
const result = requireElement<HTMLElement>("result");
const claimLink = requireElement<HTMLElement>("claim-link");
const page = document.body.dataset.page;
let cachedConfig: DemoConfig | undefined;

window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  show({ status: "error", reason: "browser_operation_failed" });
});

void initialize().catch(() => show({ status: "error", reason: "demo_initialization_failed" }));

async function initialize(): Promise<void> {
  if (page === "/enroll") renderEnrollment();
  else if (page === "/games/robot-rally") renderGame();
  else if (page === "/operator/robot-rally") await renderOperator();
  else if (page === "/audit") await renderAudit();
}

function renderEnrollment(): void {
  controls.innerHTML = `
    <h2>Browser-owned enrollment</h2>
    <div class="actions"><button id="enroll-button">Create or retry Credential</button></div>
    <p>Your Semaphore identity is created and kept in this browser. Only its commitment is sent for synthetic issuance. Retry reuses the same identity.</p>`;
  requireElement("enroll-button").addEventListener("click", () => void enroll());
}

function renderGame(): void {
  controls.innerHTML = `
    <h2>One proof, then routine account authentication</h2>
    <label>Username <input id="username" value="synthetic-player" maxlength="32"></label>
    <label>Wallet label (play metadata only) <input id="wallet" value="0x0000000000000000000000000000000000000001"></label>
    <div class="actions">
      <button id="register-button">Register with one Credential Proof</button>
      <button id="duplicate-button">Retry duplicate registration</button>
      <button id="wrong-proof-button">Submit wrong proof</button>
      <button id="login-button">Authenticate Login Key</button>
      <button id="play-button">Routine play</button>
      <button id="win-button">Record win</button>
      <button id="claim-button">Claim on Arbitrum Sepolia</button>
    </div>
    <p class="warning">Identity stays off-chain. Claim uses MetaMask/Rabby on Arbitrum Sepolia (421614) only — not Ethereum Sepolia. Your wallet pays gas as the recipient; the server signs EIP-712.</p>`;
  requireElement("register-button").addEventListener("click", () => void register(false));
  requireElement("duplicate-button").addEventListener("click", () => void register(false));
  requireElement("wrong-proof-button").addEventListener("click", () => void register(true));
  requireElement("login-button").addEventListener("click", () => void login());
  requireElement("play-button").addEventListener("click", () => void play());
  requireElement("win-button").addEventListener("click", () => void win());
  requireElement("claim-button").addEventListener("click", () => void claimOnSepolia());
}

async function renderOperator(): Promise<void> {
  controls.innerHTML = `<h2>Application-local moderation</h2><div id="accounts"></div>`;
  const response = await getJson("/api/operator/accounts");
  const accounts = Array.isArray(response.accounts) ? response.accounts : [];
  const container = requireElement("accounts");
  if (accounts.length === 0) {
    container.textContent = "No Robot Rally accounts yet.";
    show(response);
    return;
  }
  for (const value of accounts) {
    if (!isRecord(value) || typeof value.accountId !== "string") continue;
    const accountId = value.accountId;
    const row = document.createElement("article");
    const details = document.createElement("pre");
    details.textContent = safeJson(value);
    const flag = document.createElement("button");
    flag.textContent = "Manual bot flag";
    flag.addEventListener("click", () => void operatorAction("/api/operator/flag", accountId));
    const ban = document.createElement("button");
    ban.textContent = "Ban and invalidate sessions";
    ban.addEventListener("click", () => void operatorAction("/api/operator/ban", accountId));
    row.append(details, flag, ban);
    container.append(row);
  }
  show(response);
}

async function renderAudit(): Promise<void> {
  controls.innerHTML = `<h2>Ordered application events</h2><p>This projection excludes raw proofs, source subjects, identity commitments, session tokens, and cross-application mappings.</p>`;
  show(await getJson("/api/audit"));
}

async function enroll(): Promise<void> {
  show({ status: "working", action: "creating_browser_identity_and_synthetic_credential" });
  const storage = holderStorage();
  const identity = loadOrCreateBrowserSemaphoreIdentity(storage);
  const response = await postJson("/api/enroll", {
    semaphoreIdentityCommitment: identity.commitment.toString(),
  });
  if (
    (response.status === "issued" || response.status === "existing") &&
    isRecord(response.credential) &&
    isRecord(response.group)
  ) {
    storage.setItem(
      "demo.credential",
      JSON.stringify({
        credentialId: response.credential.credentialId,
        groupId: response.credential.groupId,
        group: response.group,
      }),
    );
    show({
      status: response.status,
      credentialId: response.credential.credentialId,
      groupId: response.credential.groupId,
      groupRoot: response.group.root,
      groupSize: response.group.size,
    });
    return;
  }
  show(response);
}

async function register(makeWrongProof: boolean): Promise<void> {
  show({ status: "working", action: "generating_standard_semaphore_proof_locally" });
  const storage = holderStorage();
  const enrollment = loadStored<EnrollmentState>(storage, "demo.credential");
  if (enrollment === undefined) {
    show({ status: "rejected", reason: "enroll_first" });
    return;
  }
  const config = await loadConfig();
  const loginKey = await loadOrCreateBrowserLoginKey(storage);
  const registration = {
    version: 1 as const,
    stableApplicationId: config.stableApplicationId,
    loginPublicKey: loginKey.loginPublicKey,
  };
  const snapshot: BrowserCredentialGroupSnapshot = {
    members: enrollment.group.members.map(BigInt),
    root: BigInt(enrollment.group.root),
    size: enrollment.group.size,
  };
  const generated = await generateBrowserRegistrationProof(
    storage,
    snapshot,
    registration,
    config.snarkArtifacts,
  );
  const proof = makeWrongProof ? { ...generated, scope: "1" } : generated;
  const response = await postJson("/api/register", {
    registration,
    groupId: enrollment.groupId,
    proof,
  });
  if (
    (response.status === "registered" || response.status === "existing") &&
    isRecord(response.account) &&
    typeof response.account.accountId === "string"
  ) {
    storage.setItem("demo.account", JSON.stringify({ accountId: response.account.accountId }));
  }
  show(response);
}

async function login(): Promise<void> {
  const storage = holderStorage();
  const account = loadStored<AccountState>(storage, "demo.account");
  if (account === undefined) {
    show({ status: "rejected", reason: "register_first" });
    return;
  }
  const challenge = await postJson("/api/game/login-challenge", { accountId: account.accountId });
  if (challenge.status !== "created" || typeof challenge.challenge !== "string") {
    show(challenge);
    return;
  }
  const authentication = await signBrowserLoginChallenge(storage, challenge.challenge);
  const session = await postJson("/api/game/session", {
    accountId: account.accountId,
    authentication,
  });
  if (session.status === "created" && typeof session.token === "string") {
    storage.setItem("demo.session", session.token);
    show({ status: "created", account: session.account, tokenStoredInBrowser: true });
    return;
  }
  show(session);
}

async function play(): Promise<void> {
  const storage = holderStorage();
  const token = storage.getItem("demo.session");
  if (token === null) {
    show({ status: "rejected", reason: "authenticate_login_key_first" });
    return;
  }
  show(
    await postJson(
      "/api/game/play",
      {
        username: requireInput("username").value,
        wallet: requireInput("wallet").value,
      },
      token,
    ),
  );
}

async function win(): Promise<void> {
  const storage = holderStorage();
  const token = storage.getItem("demo.session");
  show(
    token === null
      ? { status: "rejected", reason: "authenticate_login_key_first" }
      : await postJson("/api/game/win", {}, token),
  );
}

async function claimOnSepolia(): Promise<void> {
  clearClaimLink();
  const storage = holderStorage();
  const token = storage.getItem("demo.session");
  if (token === null) {
    show({ status: "rejected", reason: "authenticate_login_key_first" });
    return;
  }
  const config = await loadConfig();
  if (!config.rewardClaim.enabled) {
    show({
      status: "rejected",
      reason: "claim_disabled",
      hint: "Server needs ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY",
    });
    return;
  }
  show({ status: "working", action: "connecting_wallet_on_arbitrum_sepolia" });
  try {
    const recipient = await connectArbitrumSepoliaWallet(config.rewardClaim);
    show({ status: "working", action: "requesting_server_eip712_authorization", recipient });
    const issued = await postJson("/api/game/claim-authorization", { recipient }, token);
    if (
      issued.status !== "issued" ||
      !isRecord(issued.authorization) ||
      typeof issued.signature !== "string"
    ) {
      show(issued);
      return;
    }
    show({
      status: "working",
      action: "submitting_claim_transaction",
      claimId: issued.authorization.claimId,
    });
    const submitted = await submitGameRewardClaim(config.rewardClaim, {
      authorization: {
        version: Number(issued.authorization.version),
        stableApplicationId: issued.authorization.stableApplicationId as Hex,
        resultId: issued.authorization.resultId as Hex,
        claimId: issued.authorization.claimId as Hex,
        recipient: issued.authorization.recipient as Address,
        amount: String(issued.authorization.amount),
        expiresAt: String(issued.authorization.expiresAt),
      },
      signature: issued.signature as Hex,
    });
    show({
      status: "claimed",
      chainId: config.rewardClaim.chainId,
      claimId: issued.authorization.claimId,
      recipient,
      transactionHash: submitted.transactionHash,
      explorerUrl: submitted.explorerUrl,
      note: "Replay of this claimId must fail on-chain",
    });
    setClaimLink(submitted.explorerUrl);
  } catch (error) {
    show({
      status: "error",
      reason: error instanceof Error ? error.message : "claim_failed",
    });
  }
}

async function operatorAction(path: string, accountId: string): Promise<void> {
  show(await postJson(path, { accountId }));
  await renderOperator();
}

async function loadConfig(): Promise<DemoConfig> {
  if (cachedConfig !== undefined) return cachedConfig;
  const response = (await getJson("/api/config")) as unknown as DemoConfig;
  cachedConfig = response;
  return response;
}

function holderStorage(): PrefixedStorage {
  return new PrefixedStorage(localStorage, HOLDER_STORAGE_PREFIX);
}

async function getJson(path: string): Promise<JsonRecord> {
  return parseResponse(await fetch(path, { headers: { accept: "application/json" } }));
}

async function postJson(path: string, body: unknown, token?: string): Promise<JsonRecord> {
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

function loadStored<T>(storage: BrowserIdentityStorage, key: string): T | undefined {
  const value = storage.getItem(key);
  if (value === null) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function show(value: unknown): void {
  result.textContent = safeJson(value);
}

function setClaimLink(url: string): void {
  claimLink.hidden = false;
  claimLink.replaceChildren();
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.textContent = `View claim on Arbiscan: ${url}`;
  claimLink.append(anchor);
}

function clearClaimLink(): void {
  claimLink.hidden = true;
  claimLink.replaceChildren();
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (value === null) throw new Error(`missing demo element ${id}`);
  return value as T;
}

function requireInput(id: string): HTMLInputElement {
  return requireElement<HTMLInputElement>(id);
}
