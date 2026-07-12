import {
  generateBrowserRegistrationProof,
  loadOrCreateBrowserLoginKey,
  loadOrCreateBrowserSemaphoreIdentity,
  signBrowserLoginChallenge,
  type BrowserCredentialGroupSnapshot,
} from "@agentvisa/browser-identity";
import type { Address, Hex } from "viem";

import { connectArbitrumSepoliaWallet, submitGameRewardClaim } from "./browser-claim.js";
import type { DemoRewardClaimPublicConfig } from "./claim-constants.js";
import {
  FIXED_PLAY_WALLET,
  HOLDER_STORAGE_PREFIX,
  PrefixedStorage,
  clearClaimLink,
  getJson,
  holderStorage,
  isRecord,
  loadStored,
  plainWalletError,
  postJson,
  requireElement,
  setClaimLink,
  setControlsBusy,
  setHuman,
  show,
  truncateId,
  wireStartOverButton,
} from "./demo-client-shared.js";
import { renderAuditPage, renderOperatorPage } from "./demo-secondary-pages.js";

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

interface GuidedState {
  credentialId?: string;
  accountId?: string;
  joined: boolean;
  sybilBlocked: boolean;
  played: boolean;
  won: boolean;
  claimed: boolean;
}

const controls = requireElement<HTMLElement>("demo-controls");
const result = requireElement<HTMLElement>("result");
const claimLink = requireElement<HTMLElement>("claim-link");
const page = document.body.dataset.page ?? "/";
const humanStatus = document.getElementById("human-status");
let cachedConfig: DemoConfig | undefined;
let controlsBusy = false;
const guided: GuidedState = {
  joined: false,
  sybilBlocked: false,
  played: false,
  won: false,
  claimed: false,
};

window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  setHuman(humanStatus, "Something failed in the browser. Try the current step again.", "error");
  show(result, { status: "error", reason: "browser_operation_failed" });
});

void initialize().catch(() => {
  setHuman(humanStatus, "Demo failed to start.", "error");
  show(result, { status: "error", reason: "demo_initialization_failed" });
});

async function initialize(): Promise<void> {
  restoreGuidedProgress();
  if (page === "/" || page === "/demo") {
    wireStartOverButton();
    renderGuided();
  } else if (page === "/operator/robot-rally") await renderOperatorPage(controls, result);
  else if (page === "/audit") await renderAuditPage(controls, result);
}

function renderGuided(): void {
  updateStepper();
  const step = currentStep();
  if (step === 1) renderStepCredential();
  else if (step === 2) renderStepJoin();
  else if (step === 3) renderStepSybil();
  else renderStepClaim();
}

function currentStep(): 1 | 2 | 3 | 4 {
  if (!guided.credentialId) return 1;
  if (!guided.joined) return 2;
  if (!guided.sybilBlocked) return 3;
  return 4;
}

function renderStepCredential(): void {
  controls.innerHTML = `
    <article class="step-card">
      <h2>1 · Get credential</h2>
      <p>Uniqueness already happened upstream. This step admits you to a reusable credential. The identity secret stays in this browser — only a commitment is sent.</p>
      ${
        guided.credentialId
          ? `<p class="success-badge">✓ Credential ready · ${truncateId(guided.credentialId)}</p>`
          : ""
      }
      <div class="actions"><button id="enroll-button" class="primary" ${guided.credentialId ? 'data-locked="true" disabled' : ""}>Get credential</button></div>
    </article>`;
  requireElement("enroll-button").addEventListener("click", () => void enroll());
}

function renderStepJoin(): void {
  controls.innerHTML = `
    <article class="step-card">
      <h2>2 · Join service</h2>
      <p>One local Semaphore proof binds a Stable Application ID for Robot Rally. The platform receives a Registration Nullifier it can trust for this service only.</p>
      <label>Display username <span class="helper">optional — not your wallet or personhood</span>
        <input id="username" value="synthetic-player" maxlength="32">
      </label>
      <div class="actions"><button id="register-button" class="primary">Join Robot Rally</button></div>
      <p class="helper">Proof generation can take a few seconds in the browser.</p>
    </article>`;
  requireElement("register-button").addEventListener("click", () => void register());
}

function renderStepSybil(): void {
  controls.innerHTML = `
    <article class="step-card">
      <h2>3 · Sybil check</h2>
      <p>One account per credential for this service. Try joining again as if you switched wallets — the same credential must not open a second Robot Rally account.</p>
      ${
        guided.sybilBlocked
          ? `<p class="success-badge">✓ Second join blocked — nullifier already consumed</p>`
          : ""
      }
      <div class="actions">
        <button id="sybil-button" class="primary">Try again with different wallet</button>
      </div>
    </article>`;
  requireElement("sybil-button").addEventListener("click", () => void demonstrateSybilBlock());
}

function renderStepClaim(): void {
  controls.innerHTML = `
    <article class="step-card">
      <h2>4 · Claim on Arbitrum</h2>
      <p>Record a synthetic win, then submit the reward claim on Arbitrum Sepolia (421614). The server signs EIP-712 only; your wallet pays gas. Replay protection is on-chain.</p>
      <label>Display username <span class="helper">play metadata only</span>
        <input id="username" value="synthetic-player" maxlength="32">
      </label>
      <div class="actions"><button id="play-button" ${guided.played ? 'data-locked="true" disabled' : ""}>Record play</button>
        <button id="win-button" ${guided.played && !guided.won ? "" : 'data-locked="true" disabled'}>Record win</button>
        <button id="claim-button" class="primary" ${guided.won && !guided.claimed ? "" : 'data-locked="true" disabled'}>Claim reward on Arbitrum Sepolia</button>
      </div>
      <p class="helper">Wallet checklist: MetaMask (or Rabby) on chain 421614 with a little Sepolia ETH for gas.</p>
      ${
        guided.claimed
          ? `<p class="success-badge">✓ Claim submitted — use the Arbiscan link below</p>`
          : ""
      }
    </article>`;
  requireElement("play-button").addEventListener("click", () => void play());
  requireElement("win-button").addEventListener("click", () => void win());
  requireElement("claim-button").addEventListener("click", () => void claimOnSepolia());
  if (controlsBusy) setControlsBusy(controls, true);
}

async function withControlsBusy(work: () => Promise<void>): Promise<void> {
  if (controlsBusy) return;
  controlsBusy = true;
  setControlsBusy(controls, true);
  try {
    await work();
  } finally {
    controlsBusy = false;
    setControlsBusy(controls, false);
  }
}

async function enroll(): Promise<void> {
  await withControlsBusy(async () => {
    setHuman(
      humanStatus,
      "Creating browser identity and requesting a synthetic credential…",
      "info",
    );
    show(result, {
      status: "working",
      action: "creating_browser_identity_and_synthetic_credential",
    });
    const storage = holderStorage();
    const identity = loadOrCreateBrowserSemaphoreIdentity(storage);
    const response = await postJson("/api/enroll", {
      semaphoreIdentityCommitment: identity.commitment.toString(),
    });
    if (
      (response.status === "issued" || response.status === "existing") &&
      isRecord(response.credential) &&
      isRecord(response.group) &&
      typeof response.credential.credentialId === "string"
    ) {
      storage.setItem(
        "demo.credential",
        JSON.stringify({
          credentialId: response.credential.credentialId,
          groupId: response.credential.groupId,
          group: response.group,
        }),
      );
      guided.credentialId = response.credential.credentialId;
      persistGuidedProgress();
      setHuman(
        humanStatus,
        `Credential ready (${truncateId(guided.credentialId)}). Retry here returns the same credential.`,
        "ok",
      );
      show(result, {
        status: response.status,
        credentialId: response.credential.credentialId,
        groupId: response.credential.groupId,
        groupRoot: response.group.root,
        groupSize: response.group.size,
      });
      renderGuided();
      return;
    }
    setHuman(humanStatus, "Credential issuance failed.", "error");
    show(result, response);
  });
}

async function register(): Promise<void> {
  await withControlsBusy(async () => {
    setHuman(
      humanStatus,
      "Generating a Semaphore proof locally — this can take a few seconds…",
      "info",
    );
    show(result, { status: "working", action: "generating_standard_semaphore_proof_locally" });
    const storage = holderStorage();
    const enrollment = loadStored<EnrollmentState>(storage, "demo.credential");
    if (enrollment === undefined) {
      setHuman(humanStatus, "Get a credential first.", "warn");
      show(result, { status: "rejected", reason: "enroll_first" });
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
    const proof = await generateBrowserRegistrationProof(
      storage,
      snapshot,
      registration,
      config.snarkArtifacts,
    );
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
      guided.accountId = response.account.accountId;
      guided.joined = true;
      persistGuidedProgress();
      setHuman(humanStatus, "Joined Robot Rally with one scoped proof.", "ok");
      show(result, response);
      renderGuided();
      return;
    }
    setHuman(humanStatus, "Join failed.", "error");
    show(result, response);
  });
}

async function demonstrateSybilBlock(): Promise<void> {
  await withControlsBusy(async () => {
    setHuman(
      humanStatus,
      "Attempting a second join with a different Login Key (wallet stand-in)…",
      "info",
    );
    show(result, { status: "working", action: "sybil_retry_with_substituted_login_key" });
    const storage = holderStorage();
    const enrollment = loadStored<EnrollmentState>(storage, "demo.credential");
    if (enrollment === undefined) {
      setHuman(humanStatus, "Get a credential and join first.", "warn");
      show(result, { status: "rejected", reason: "enroll_first" });
      return;
    }
    const scratch = new PrefixedStorage(sessionStorage, `${HOLDER_STORAGE_PREFIX}sybil.`);
    const config = await loadConfig();
    const substituted = await loadOrCreateBrowserLoginKey(scratch);
    const registration = {
      version: 1 as const,
      stableApplicationId: config.stableApplicationId,
      loginPublicKey: substituted.loginPublicKey,
    };
    const snapshot: BrowserCredentialGroupSnapshot = {
      members: enrollment.group.members.map(BigInt),
      root: BigInt(enrollment.group.root),
      size: enrollment.group.size,
    };
    const proof = await generateBrowserRegistrationProof(
      storage,
      snapshot,
      registration,
      config.snarkArtifacts,
    );
    const response = await postJson("/api/register", {
      registration,
      groupId: enrollment.groupId,
      proof,
    });
    if (response.status === "conflict") {
      guided.sybilBlocked = true;
      persistGuidedProgress();
      setHuman(
        humanStatus,
        "Blocked — one account per credential for this service. Nullifier already consumed.",
        "ok",
      );
      show(result, response);
      renderGuided();
      return;
    }
    setHuman(humanStatus, "Expected a conflict; see technical details.", "warn");
    show(result, response);
  });
}

async function ensureSession(): Promise<string | undefined> {
  const storage = holderStorage();
  const existing = storage.getItem("demo.session");
  if (existing !== null) return existing;
  const account = loadStored<AccountState>(storage, "demo.account");
  if (account === undefined) {
    setHuman(humanStatus, "Join Robot Rally first.", "warn");
    show(result, { status: "rejected", reason: "register_first" });
    return undefined;
  }
  const challenge = await postJson("/api/game/login-challenge", { accountId: account.accountId });
  if (challenge.status !== "created" || typeof challenge.challenge !== "string") {
    show(result, challenge);
    return undefined;
  }
  const authentication = await signBrowserLoginChallenge(storage, challenge.challenge);
  const session = await postJson("/api/game/session", {
    accountId: account.accountId,
    authentication,
  });
  if (session.status === "created" && typeof session.token === "string") {
    storage.setItem("demo.session", session.token);
    return session.token;
  }
  show(result, session);
  return undefined;
}

async function play(): Promise<void> {
  await withControlsBusy(async () => {
    const token = await ensureSession();
    if (token === undefined) return;
    const username = document.getElementById("username");
    const response = await postJson(
      "/api/game/play",
      {
        username: username instanceof HTMLInputElement ? username.value : "synthetic-player",
        wallet: FIXED_PLAY_WALLET,
      },
      token,
    );
    if (response.status === "played") {
      guided.played = true;
      persistGuidedProgress();
      setHuman(
        humanStatus,
        "Play recorded with the Login Key session — no second personhood check.",
        "ok",
      );
      show(result, response);
      renderGuided();
      return;
    }
    setHuman(humanStatus, "Play failed.", "error");
    show(result, response);
  });
}

async function win(): Promise<void> {
  await withControlsBusy(async () => {
    const token = await ensureSession();
    if (token === undefined) return;
    const response = await postJson("/api/game/win", {}, token);
    if (response.status === "won") {
      guided.won = true;
      persistGuidedProgress();
      setHuman(humanStatus, "Win recorded. Ready to claim the reward on Arbitrum Sepolia.", "ok");
      show(result, response);
      renderGuided();
      return;
    }
    setHuman(humanStatus, "Win failed — play first if needed.", "error");
    show(result, response);
  });
}

async function claimOnSepolia(): Promise<void> {
  await withControlsBusy(async () => {
    clearClaimLink(claimLink);
    const token = await ensureSession();
    if (token === undefined) return;
    const config = await loadConfig();
    if (!config.rewardClaim.enabled) {
      setHuman(
        humanStatus,
        "Claims are disabled on this server (missing authorizer key).",
        "error",
      );
      show(result, {
        status: "rejected",
        reason: "claim_disabled",
        hint: "Server needs ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY",
      });
      return;
    }
    setHuman(humanStatus, "Connecting wallet on Arbitrum Sepolia…", "info");
    show(result, { status: "working", action: "connecting_wallet_on_arbitrum_sepolia" });
    try {
      const recipient = await connectArbitrumSepoliaWallet(config.rewardClaim);
      setHuman(humanStatus, "Requesting server EIP-712 authorization…", "info");
      show(result, {
        status: "working",
        action: "requesting_server_eip712_authorization",
        recipient,
      });
      const issued = await postJson("/api/game/claim-authorization", { recipient }, token);
      if (
        issued.status !== "issued" ||
        !isRecord(issued.authorization) ||
        typeof issued.signature !== "string"
      ) {
        setHuman(humanStatus, "Could not issue claim authorization.", "error");
        show(result, issued);
        return;
      }
      setHuman(humanStatus, "Submitting claim transaction — confirm in your wallet…", "info");
      show(result, {
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
      guided.claimed = true;
      persistGuidedProgress();
      setHuman(
        humanStatus,
        "Claim landed on Arbitrum Sepolia. Replay of this claim ID must fail on-chain.",
        "ok",
      );
      show(result, {
        status: "claimed",
        chainId: config.rewardClaim.chainId,
        claimId: issued.authorization.claimId,
        recipient,
        transactionHash: submitted.transactionHash,
        explorerUrl: submitted.explorerUrl,
        note: "Replay of this claimId must fail on-chain",
      });
      setClaimLink(claimLink, submitted.explorerUrl);
      renderGuided();
    } catch (error) {
      const message = error instanceof Error ? error.message : "claim_failed";
      setHuman(humanStatus, plainWalletError(message), "error");
      show(result, { status: "error", reason: message });
    }
  });
}

async function loadConfig(): Promise<DemoConfig> {
  if (cachedConfig !== undefined) return cachedConfig;
  const response = (await getJson("/api/config")) as unknown as DemoConfig;
  cachedConfig = response;
  return response;
}

function restoreGuidedProgress(): void {
  const storage = holderStorage();
  const enrollment = loadStored<EnrollmentState>(storage, "demo.credential");
  const account = loadStored<AccountState>(storage, "demo.account");
  const saved = loadStored<Partial<GuidedState>>(storage, "demo.guided");
  if (enrollment?.credentialId !== undefined) guided.credentialId = enrollment.credentialId;
  if (account?.accountId !== undefined) {
    guided.accountId = account.accountId;
    guided.joined = true;
  }
  if (saved?.sybilBlocked === true) guided.sybilBlocked = true;
  if (saved?.played === true) guided.played = true;
  if (saved?.won === true) guided.won = true;
  if (saved?.claimed === true) guided.claimed = true;
}

function persistGuidedProgress(): void {
  holderStorage().setItem(
    "demo.guided",
    JSON.stringify({
      sybilBlocked: guided.sybilBlocked,
      played: guided.played,
      won: guided.won,
      claimed: guided.claimed,
    }),
  );
}

function updateStepper(): void {
  const active = currentStep();
  for (const node of document.querySelectorAll<HTMLElement>(".step")) {
    const step = Number(node.dataset.step);
    node.classList.toggle("is-active", step === active);
    node.classList.toggle("is-done", step < active || (step === 4 && guided.claimed));
  }
}
