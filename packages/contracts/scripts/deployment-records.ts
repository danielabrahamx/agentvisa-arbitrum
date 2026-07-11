import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getAddress, type Address, type Hex } from "viem";

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
export const ARBITRUM_SEPOLIA_EXPLORER = "https://sepolia.arbiscan.io";
export const PUBLIC_ARBITRUM_SEPOLIA_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

export interface DeploymentSource {
  readonly kind: "npm" | "git" | "local";
  readonly name: string;
  readonly version: string;
  readonly commit?: string;
}

export interface DeploymentRecordV1 {
  readonly schemaVersion: 1;
  readonly chainId: number;
  readonly contractName: string;
  readonly address: Address;
  readonly bytecodeHash: Hex;
  readonly source: DeploymentSource;
  readonly constructorArguments: readonly unknown[];
  readonly authorizer: Address;
  readonly deployer: Address;
  readonly transactionHash: Hex;
  readonly explorerUrl: string;
  readonly verificationStatus: "unverified" | "pending" | "verified" | "failed";
}

export interface BlairClaimProofV1 {
  readonly schemaVersion: 1;
  readonly chainId: number;
  readonly contractAddress: Address;
  readonly authorizer: Address;
  readonly recipient: Address;
  readonly stableApplicationId: Hex;
  readonly resultId: Hex;
  readonly claimId: Hex;
  readonly amount: string;
  readonly expiresAt: string;
  readonly claimTransactionHash: Hex;
  readonly claimExplorerUrl: string;
  readonly replayRejected: true;
  readonly replayError: string;
  readonly syntheticPointsAfterClaim: string;
  readonly notes: readonly string[];
}

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function assertAddress(value: unknown, label: string): Address {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.match(value as string, ADDRESS_PATTERN, `${label} must be an address`);
  return getAddress(value as Address);
}

function assertBytes32(value: unknown, label: string): Hex {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.match(value as string, BYTES32_PATTERN, `${label} must be bytes32`);
  return (value as string).toLowerCase() as Hex;
}

export function deploymentRecordPath(workspaceRoot: string): string {
  return resolve(
    workspaceRoot,
    "deployments",
    String(ARBITRUM_SEPOLIA_CHAIN_ID),
    "GameRewardClaim.json",
  );
}

export function blairClaimProofPath(workspaceRoot: string): string {
  return resolve(
    workspaceRoot,
    "deployments",
    String(ARBITRUM_SEPOLIA_CHAIN_ID),
    "blair-claim-proof.json",
  );
}

export function hashBytecode(bytecode: Hex): Hex {
  const normalized = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  return `0x${createHash("sha256").update(Buffer.from(normalized, "hex")).digest("hex")}`;
}

export function explorerAddressUrl(address: Address): string {
  return `${ARBITRUM_SEPOLIA_EXPLORER}/address/${getAddress(address)}`;
}

export function explorerTxUrl(transactionHash: Hex): string {
  return `${ARBITRUM_SEPOLIA_EXPLORER}/tx/${transactionHash}`;
}

export function validateDeploymentRecord(record: unknown): DeploymentRecordV1 {
  assert.equal(typeof record, "object");
  assert.ok(record !== null);
  const value = record as Record<string, unknown>;

  assert.equal(value.schemaVersion, 1);
  assert.equal(value.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
  assert.equal(typeof value.contractName, "string");
  assert.ok((value.contractName as string).length > 0);
  assert.equal(value.contractName, "GameRewardClaim");

  const address = assertAddress(value.address, "address");
  const bytecodeHash = assertBytes32(value.bytecodeHash, "bytecodeHash");
  const deployer = assertAddress(value.deployer, "deployer");
  const authorizer = assertAddress(value.authorizer, "authorizer");
  const transactionHash = assertBytes32(value.transactionHash, "transactionHash");

  assert.equal(typeof value.source, "object");
  assert.ok(value.source !== null);
  const source = value.source as Record<string, unknown>;
  assert.ok(source.kind === "npm" || source.kind === "git" || source.kind === "local");
  assert.equal(typeof source.name, "string");
  assert.equal(typeof source.version, "string");

  assert.ok(Array.isArray(value.constructorArguments));
  assert.equal(value.constructorArguments.length, 1);
  assert.equal(getAddress(value.constructorArguments[0] as Address), authorizer);

  assert.equal(typeof value.explorerUrl, "string");
  assert.match(value.explorerUrl as string, /^https:\/\/[^\s]+$/);
  assert.equal(value.explorerUrl, explorerAddressUrl(address));

  assert.ok(
    value.verificationStatus === "unverified" ||
      value.verificationStatus === "pending" ||
      value.verificationStatus === "verified" ||
      value.verificationStatus === "failed",
  );

  return {
    schemaVersion: 1,
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    contractName: "GameRewardClaim",
    address,
    bytecodeHash,
    source: {
      kind: source.kind,
      name: source.name as string,
      version: source.version as string,
      ...(typeof source.commit === "string" ? { commit: source.commit } : {}),
    },
    constructorArguments: [authorizer],
    authorizer,
    deployer,
    transactionHash,
    explorerUrl: value.explorerUrl,
    verificationStatus: value.verificationStatus,
  };
}

export function validateBlairClaimProof(proof: unknown): BlairClaimProofV1 {
  assert.equal(typeof proof, "object");
  assert.ok(proof !== null);
  const value = proof as Record<string, unknown>;

  assert.equal(value.schemaVersion, 1);
  assert.equal(value.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
  assertAddress(value.contractAddress, "contractAddress");
  assertAddress(value.authorizer, "authorizer");
  assertAddress(value.recipient, "recipient");
  assertBytes32(value.stableApplicationId, "stableApplicationId");
  assertBytes32(value.resultId, "resultId");
  assertBytes32(value.claimId, "claimId");
  assert.equal(typeof value.amount, "string");
  assert.equal(typeof value.expiresAt, "string");
  assertBytes32(value.claimTransactionHash, "claimTransactionHash");
  assert.equal(typeof value.claimExplorerUrl, "string");
  assert.match(value.claimExplorerUrl as string, /^https:\/\/[^\s]+$/);
  assert.equal(value.replayRejected, true);
  assert.equal(typeof value.replayError, "string");
  assert.ok((value.replayError as string).length > 0);
  assert.equal(typeof value.syntheticPointsAfterClaim, "string");
  assert.ok(Array.isArray(value.notes));
  assert.ok((value.notes as unknown[]).every((note) => typeof note === "string"));

  const identityLeakTerms = ["nullifier", "identityCommitment", "opaqueSubject", "worldId", "pii"];
  const serialized = JSON.stringify(value).toLowerCase();
  for (const term of identityLeakTerms) {
    const lowered = term.toLowerCase();
    // Require a word boundary for short tokens like "pii" so explanatory notes
    // that say "personally identifying data" are not false positives.
    const leaked =
      lowered.length <= 3
        ? new RegExp(`\\b${lowered}\\b`, "i").test(serialized)
        : serialized.includes(lowered);
    assert.equal(leaked, false, `proof must not contain ${term}`);
  }

  return value as unknown as BlairClaimProofV1;
}

export function readValidatedDeploymentRecord(workspaceRoot: string): DeploymentRecordV1 {
  const path = deploymentRecordPath(workspaceRoot);
  assert.ok(existsSync(path), `missing deployment record at ${path}`);
  return validateDeploymentRecord(JSON.parse(readFileSync(path, "utf8")));
}

export function readValidatedBlairClaimProof(workspaceRoot: string): BlairClaimProofV1 {
  const path = blairClaimProofPath(workspaceRoot);
  assert.ok(existsSync(path), `missing Blair claim proof at ${path}`);
  return validateBlairClaimProof(JSON.parse(readFileSync(path, "utf8")));
}

export function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function assertNoIdentitySurfaceInBytecode(bytecode: Hex): void {
  const lowered = bytecode.toLowerCase();
  for (const term of ["nullifier", "identitycommitment", "opaquesubject", "worldid"]) {
    const hex = Buffer.from(term, "utf8").toString("hex");
    assert.equal(lowered.includes(hex), false, `bytecode must not embed ${term}`);
  }
}
