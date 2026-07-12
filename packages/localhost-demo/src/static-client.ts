import {
  generateBrowserRegistrationProof,
  loadOrCreateBrowserLoginKey,
  loadOrCreateBrowserSemaphoreIdentity,
  type BrowserIdentityStorage,
  type BrowserRegistrationProof,
} from "@agentvisa/browser-identity";
import {
  hashEnrollmentAuthorizationV1,
  parseEnrollmentAuthorizationV1,
  type EnrollmentAuthorizationV1,
} from "@agentvisa/policy";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  getAddress,
  http,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import {
  HOLDER_STORAGE_PREFIX,
  plainWalletError,
  PrefixedStorage,
  requireElement,
  setControlsBusy,
  setHuman,
  show,
  truncateId,
  wireStartOverButton,
  type StatusTone,
} from "./demo-client-shared.js";
import { freshWalletGasFees } from "./wallet-fees.js";
import { loadOnchainCredentialGroupSnapshot } from "./onchain-group-snapshot.js";

declare const __ADMISSION_DEPLOYMENT__: AdmissionDeployment;
declare const __DEMO_ENROLLMENT_SIGNER_PRIVATE_KEY__: string;

interface AdmissionDeployment {
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly semaphore: Address;
  readonly admission: Address;
  readonly credentialGroupId: string;
  readonly stableApplicationId: Hex;
  readonly enrollmentSourceId: Hex;
  readonly enrollmentSigner: Address;
  readonly maximumValiditySeconds: string;
}

interface EthereumProvider {
  request(args: {
    readonly method: string;
    readonly params?: readonly unknown[];
  }): Promise<unknown>;
}

interface GuidedState {
  enrolled: boolean;
  joined: boolean;
  sybilBlocked: boolean;
}

const SYNTHETIC_SUBJECT_DOMAIN = keccak256(stringToHex("agentvisa.synthetic-opaque-subject.v1"));
const DEMO_SOURCE_POLICY = {
  sourceId: keccak256(stringToHex("agentvisa.synthetic-localhost-source.v1")),
  uniquenessDomain: keccak256(stringToHex("agentvisa.synthetic-localhost-people.v1")),
  credentialSchemaId: keccak256(stringToHex("agentvisa.semaphore-credential.v1")),
  assuranceId: keccak256(stringToHex("agentvisa.synthetic-localhost-assurance.v1")),
};

const ADMISSION_ABI = [
  {
    type: "function",
    name: "enroll",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "authorization",
        type: "tuple",
        components: [
          { name: "version", type: "uint8" },
          { name: "sourceId", type: "bytes32" },
          { name: "uniquenessDomain", type: "bytes32" },
          { name: "opaqueSubjectDigest", type: "bytes32" },
          { name: "credentialSchemaId", type: "bytes32" },
          { name: "assuranceId", type: "bytes32" },
          { name: "semaphoreIdentityCommitment", type: "uint256" },
          { name: "issuedAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const SEMAPHORE_ABI = [
  {
    type: "function",
    name: "validateProof",
    stateMutability: "nonpayable",
    inputs: [
      { name: "groupId", type: "uint256" },
      {
        name: "proof",
        type: "tuple",
        components: [
          { name: "merkleTreeDepth", type: "uint256" },
          { name: "merkleTreeRoot", type: "uint256" },
          { name: "nullifier", type: "uint256" },
          { name: "message", type: "uint256" },
          { name: "scope", type: "uint256" },
          { name: "points", type: "uint256[8]" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMerkleTreeRoot",
    stateMutability: "view",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getMerkleTreeSize",
    stateMutability: "view",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const deployment = __ADMISSION_DEPLOYMENT__;
const controls = requireElement<HTMLElement>("demo-controls");
const result = requireElement<HTMLElement>("result");
const humanStatus = document.getElementById("human-status");
const guided: GuidedState = { enrolled: false, joined: false, sybilBlocked: false };
let controlsBusy = false;

window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  setHuman(humanStatus, "Something failed in the browser. Try the current step again.", "error");
  show(result, { status: "error", reason: "browser_operation_failed" });
});

try {
  initialize();
} catch (error) {
  setHuman(
    humanStatus,
    "Demo failed to start. Reload the page — if this persists, open Technical details.",
    "error",
  );
  show(result, {
    status: "boot_error",
    detail: error instanceof Error ? error.message : String(error),
  });
}

function initialize(): void {
  restoreGuidedProgress();
  wireStartOverButton();
  renderGuided();
}

function holderStorage(): PrefixedStorage {
  return new PrefixedStorage(localStorage, HOLDER_STORAGE_PREFIX);
}

function restoreGuidedProgress(): void {
  const stored = localStorage.getItem("agentvisa.static.guided");
  if (stored === null) return;
  try {
    const parsed = JSON.parse(stored) as Partial<GuidedState>;
    guided.enrolled = parsed.enrolled === true;
    guided.joined = parsed.joined === true;
    guided.sybilBlocked = parsed.sybilBlocked === true;
  } catch {
    // ignore corrupt state
  }
}

function persistGuidedProgress(): void {
  localStorage.setItem("agentvisa.static.guided", JSON.stringify(guided));
}

function currentStep(): 1 | 2 | 3 {
  if (!guided.enrolled) return 1;
  if (!guided.joined) return 2;
  return 3;
}

function updateStepper(): void {
  const step = currentStep();
  for (const element of document.querySelectorAll<HTMLElement>(".step")) {
    const value = Number(element.dataset.step);
    element.classList.toggle("is-active", value === step);
    element.classList.toggle("is-done", value < step || (value === 3 && guided.sybilBlocked));
  }
}

function renderGuided(): void {
  updateStepper();
  const step = currentStep();
  if (step === 1) renderStepCredential();
  else if (step === 2) renderStepJoin();
  else renderStepSybil();
}

function renderStepCredential(): void {
  controls.replaceChildren();
  const card = document.createElement("div");
  card.className = "step-card";
  card.innerHTML = `
    <h2>Step 1 · Get credential</h2>
    <p>Create a browser Semaphore identity, sign a synthetic enrollment authorization, and submit <code>enroll</code> on Arbitrum Sepolia.</p>
    <div class="actions"><button type="button" class="primary" id="enroll-btn">Enroll on-chain</button></div>`;
  controls.append(card);
  card.querySelector("#enroll-btn")?.addEventListener("click", () => {
    void runEnroll();
  });
  setHuman(humanStatus, "Step 1 — enroll your commitment into the Semaphore group.", "info");
}

function renderStepJoin(): void {
  controls.replaceChildren();
  const card = document.createElement("div");
  card.className = "step-card";
  card.innerHTML = `
    <h2>Step 2 · Join Robot Rally</h2>
    <p>Read the on-chain Merkle root, generate a scoped proof, and call <code>Semaphore.validateProof</code>.</p>
    <div class="actions"><button type="button" class="primary" id="join-btn">Register on-chain</button></div>`;
  controls.append(card);
  card.querySelector("#join-btn")?.addEventListener("click", () => {
    void runJoin();
  });
  setHuman(humanStatus, "Step 2 — one scoped registration proof on Sepolia.", "info");
}

function renderStepSybil(): void {
  controls.replaceChildren();
  const card = document.createElement("div");
  card.className = "step-card";
  card.innerHTML = `
    <h2>Step 3 · Sybil check</h2>
    <p>Same identity, fresh Login Key. The nullifier must match — the second <code>validateProof</code> should revert.</p>
    <div class="actions"><button type="button" class="primary" id="sybil-btn">Try second account</button></div>`;
  controls.append(card);
  card.querySelector("#sybil-btn")?.addEventListener("click", () => {
    void runSybil();
  });
  setHuman(
    humanStatus,
    guided.sybilBlocked
      ? "Sybil blocked on-chain — nullifier replay reverted as expected."
      : "Step 3 — prove the same credential cannot register twice.",
    guided.sybilBlocked ? "ok" : "info",
  );
}

async function runEnroll(): Promise<void> {
  if (controlsBusy) return;
  setBusy(true);
  try {
    const storage = holderStorage();
    const identity = loadOrCreateBrowserSemaphoreIdentity(storage);
    const wallet = await connectWallet();
    const authorization = await buildSignedEnrollment(identity.commitment);
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(deployment.rpcUrl),
    });
    const gasFees = await freshWalletGasFees(publicClient);
    const hash = await wallet.writeContract({
      address: deployment.admission,
      abi: ADMISSION_ABI,
      functionName: "enroll",
      args: [toSolidityAuthorization(authorization.authorization), authorization.signature],
      ...gasFees,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    guided.enrolled = true;
    persistGuidedProgress();
    setHuman(humanStatus, "Credential enrolled on-chain.", "ok");
    show(result, {
      status: "enrolled",
      commitment: identity.commitment.toString(),
      transactionHash: hash,
      admission: deployment.admission,
    });
    renderGuided();
  } catch (error) {
    reportError(error, "enrollment_failed");
  } finally {
    setBusy(false);
  }
}

async function runJoin(): Promise<void> {
  if (controlsBusy) return;
  setBusy(true);
  try {
    const storage = holderStorage();
    const login = await loadOrCreateBrowserLoginKey(storage);
    const proof = await buildRegistrationProof(storage, login.loginPublicKey);
    const wallet = await connectWallet();
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(deployment.rpcUrl),
    });
    const gasFees = await freshWalletGasFees(publicClient);
    const hash = await wallet.writeContract({
      address: deployment.semaphore,
      abi: SEMAPHORE_ABI,
      functionName: "validateProof",
      args: [BigInt(deployment.credentialGroupId), toSolidityProof(proof)],
      ...gasFees,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    guided.joined = true;
    persistGuidedProgress();
    setHuman(humanStatus, "Joined Robot Rally — nullifier consumed on-chain.", "ok");
    show(result, {
      status: "registered",
      nullifier: proof.nullifier,
      scope: proof.scope,
      message: proof.message,
      transactionHash: hash,
      loginPublicKey: truncateId(login.loginPublicKey),
    });
    renderGuided();
  } catch (error) {
    reportError(error, "registration_failed");
  } finally {
    setBusy(false);
  }
}

async function runSybil(): Promise<void> {
  if (controlsBusy) return;
  setBusy(true);
  try {
    const storage = holderStorage();
    localStorage.removeItem(`${HOLDER_STORAGE_PREFIX}agentvisa.login-key.p256.v1`);
    const login = await loadOrCreateBrowserLoginKey(storage);
    const proof = await buildRegistrationProof(storage, login.loginPublicKey);
    const wallet = await connectWallet();
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(deployment.rpcUrl),
    });
    const gasFees = await freshWalletGasFees(publicClient);
    let rejected = false;
    try {
      const hash = await wallet.writeContract({
        address: deployment.semaphore,
        abi: SEMAPHORE_ABI,
        functionName: "validateProof",
        args: [BigInt(deployment.credentialGroupId), toSolidityProof(proof)],
        ...gasFees,
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error("sybil_not_blocked");
    }
    guided.sybilBlocked = true;
    persistGuidedProgress();
    setHuman(humanStatus, "Second registration reverted — scoped nullifier replay blocked.", "ok");
    show(result, {
      status: "sybil_blocked",
      nullifier: proof.nullifier,
      loginPublicKey: truncateId(login.loginPublicKey),
      note: "validateProof reverted on-chain for duplicate nullifier",
    });
    renderGuided();
  } catch (error) {
    reportError(error, "sybil_check_failed");
  } finally {
    setBusy(false);
  }
}

async function buildRegistrationProof(
  storage: BrowserIdentityStorage,
  loginPublicKey: Hex,
): Promise<BrowserRegistrationProof> {
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(deployment.rpcUrl),
  });
  const identity = loadOrCreateBrowserSemaphoreIdentity(storage);
  const snapshot = await loadOnchainCredentialGroupSnapshot(
    publicClient,
    deployment.semaphore,
    BigInt(deployment.credentialGroupId),
    identity.commitment,
  );
  return generateBrowserRegistrationProof(
    storage,
    snapshot,
    {
      version: 1,
      stableApplicationId: deployment.stableApplicationId,
      loginPublicKey,
    },
    { wasm: "/semaphore-1.wasm", zkey: "/semaphore-1.zkey" },
  );
}

async function buildSignedEnrollment(commitment: bigint): Promise<{
  readonly authorization: EnrollmentAuthorizationV1;
  readonly signature: Hex;
}> {
  const signer = privateKeyToAccount(__DEMO_ENROLLMENT_SIGNER_PRIVATE_KEY__ as Hex);
  const issuedAt = BigInt(Math.floor(Date.now() / 1000));
  const expiresAt = issuedAt + BigInt(deployment.maximumValiditySeconds);
  const opaqueSubjectDigest = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "string" }],
      [SYNTHETIC_SUBJECT_DOMAIN, `static-demo-${commitment.toString()}`],
    ),
  );
  const authorization = parseEnrollmentAuthorizationV1({
    version: 1,
    sourceId: DEMO_SOURCE_POLICY.sourceId,
    uniquenessDomain: DEMO_SOURCE_POLICY.uniquenessDomain,
    opaqueSubjectDigest,
    credentialSchemaId: DEMO_SOURCE_POLICY.credentialSchemaId,
    assuranceId: DEMO_SOURCE_POLICY.assuranceId,
    semaphoreIdentityCommitment: commitment,
    issuedAt,
    expiresAt,
    nonce: keccak256(stringToHex(`enroll-nonce-${commitment.toString()}-${issuedAt.toString()}`)),
  });
  const digest = hashEnrollmentAuthorizationV1(authorization);
  const signature = await signer.sign({ hash: digest });
  return { authorization, signature };
}

function toSolidityAuthorization(authorization: EnrollmentAuthorizationV1) {
  return {
    version: authorization.version,
    sourceId: authorization.sourceId,
    uniquenessDomain: authorization.uniquenessDomain,
    opaqueSubjectDigest: authorization.opaqueSubjectDigest,
    credentialSchemaId: authorization.credentialSchemaId,
    assuranceId: authorization.assuranceId,
    semaphoreIdentityCommitment: authorization.semaphoreIdentityCommitment,
    issuedAt: authorization.issuedAt,
    expiresAt: authorization.expiresAt,
    nonce: authorization.nonce,
  };
}

function toSolidityProof(proof: BrowserRegistrationProof) {
  return {
    merkleTreeDepth: BigInt(proof.merkleTreeDepth),
    merkleTreeRoot: BigInt(proof.merkleTreeRoot),
    nullifier: BigInt(proof.nullifier),
    message: BigInt(proof.message),
    scope: BigInt(proof.scope),
    points: proof.points.map((point) => BigInt(point)) as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ],
  };
}

async function connectWallet() {
  const provider = requireEthereumProvider();
  await ensureArbitrumSepolia(provider);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const account = accounts[0];
  if (account === undefined) throw new Error("wallet_account_unavailable");
  return createWalletClient({
    account: getAddress(account),
    chain: arbitrumSepolia,
    transport: custom(provider),
  });
}

async function ensureArbitrumSepolia(provider: EthereumProvider): Promise<void> {
  const chainIdHex = `0x${deployment.chainId.toString(16)}`;
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (current.toLowerCase() === chainIdHex.toLowerCase()) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? Number(error.code)
        : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: "Arbitrum Sepolia",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [deployment.rpcUrl],
          blockExplorerUrls: ["https://sepolia.arbiscan.io"],
        },
      ],
    });
  }
}

function requireEthereumProvider(): EthereumProvider {
  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (provider === undefined) throw new Error("install_metamask_or_rabby");
  return provider;
}

function setBusy(busy: boolean): void {
  controlsBusy = busy;
  setControlsBusy(controls, busy);
}

function reportError(error: unknown, reason: string): void {
  const detail = error instanceof Error ? error.message : String(error);
  const message =
    error instanceof Error && error.message === "install_metamask_or_rabby"
      ? "Install MetaMask or Rabby and connect to Arbitrum Sepolia."
      : error instanceof Error && error.message === "wallet_account_unavailable"
        ? "Wallet account unavailable."
        : error instanceof Error && error.message === "sybil_not_blocked"
          ? "Expected on-chain nullifier replay revert, but transaction succeeded."
          : error instanceof Error && error.message === "enroll_first_on_chain"
            ? "Enroll on-chain first, then join Robot Rally."
            : /Credential group snapshot is invalid|credential_group_/i.test(detail)
              ? "Could not read the on-chain credential group. Retry after enroll, or Start over and run step 1 again."
              : /max fee per gas less than block base fee/i.test(detail)
            ? "Wallet gas estimate was too low for the current block. Retry the step."
            : plainWalletError(detail);
  const tone: StatusTone =
    error instanceof Error && error.message === "sybil_not_blocked" ? "error" : "error";
  setHuman(humanStatus, message, tone);
  show(result, {
    status: "error",
    reason,
    detail,
  });
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
