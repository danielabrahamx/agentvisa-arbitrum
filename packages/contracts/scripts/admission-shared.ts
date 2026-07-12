import assert from "node:assert/strict";
import { resolve } from "node:path";

import { keccak256, stringToHex, type Address, type Hex } from "viem";

import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  PUBLIC_ARBITRUM_SEPOLIA_RPC,
  admissionBundlePath,
  admissionDeploymentRecordPath,
  assertNoIdentitySurfaceInBytecode,
  explorerAddressUrl,
  hashBytecode,
  readValidatedAdmissionBundle,
  readValidatedAdmissionDeploymentRecord,
  semaphoreDeploymentRecordPath,
  writeJsonFile,
  type AdmissionBundleV1,
  type AdmissionDeploymentRecordV1,
  type SemaphoreDeploymentRecordV1,
} from "./deployment-records.js";

export const DEMO_SOURCE_POLICY = Object.freeze({
  sourceId: keccak256(stringToHex("agentvisa.synthetic-localhost-source.v1")),
  uniquenessDomain: keccak256(stringToHex("agentvisa.synthetic-localhost-people.v1")),
  credentialSchemaId: keccak256(stringToHex("agentvisa.semaphore-credential.v1")),
  acceptedAssuranceId: keccak256(stringToHex("agentvisa.synthetic-localhost-assurance.v1")),
  maximumValiditySeconds: 300n,
});

export const ROBOT_RALLY_APPLICATION_ID = keccak256(stringToHex("agentvisa.robot-rally.v1"));
export const CREDENTIAL_GROUP_DURATION_SECONDS = 3_600n;

export function requirePrivateKey(name: string): Hex {
  const value = process.env[name];
  assert.ok(value, `${name} must be set for synthetic Sepolia deployment`);
  assert.match(value, /^0x[0-9a-fA-F]{64}$/, `${name} must be a 32-byte hex private key`);
  return value as Hex;
}

export function resolveEnrollmentSignerKey(): Hex {
  const dedicated = process.env.ARBITRUM_SEPOLIA_ENROLLMENT_SIGNER_PRIVATE_KEY;
  if (dedicated !== undefined && dedicated.length > 0) {
    return requirePrivateKey("ARBITRUM_SEPOLIA_ENROLLMENT_SIGNER_PRIVATE_KEY");
  }
  return requirePrivateKey("ARBITRUM_SEPOLIA_DEPLOYER_PRIVATE_KEY");
}

export function workspaceRoot(): string {
  return resolve(import.meta.dirname, "../../..");
}

export function packageVersion(): string {
  return "0.1.0";
}

export function buildAdmissionBundle(input: {
  readonly semaphore: Address;
  readonly admission: Address;
  readonly credentialGroupId: bigint;
  readonly enrollmentSigner: Address;
}): AdmissionBundleV1 {
  return {
    schemaVersion: 1,
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL ?? PUBLIC_ARBITRUM_SEPOLIA_RPC,
    semaphore: input.semaphore,
    admission: input.admission,
    credentialGroupId: input.credentialGroupId.toString(),
    stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
    enrollmentSourceId: DEMO_SOURCE_POLICY.sourceId,
    enrollmentSigner: input.enrollmentSigner,
    maximumValiditySeconds: DEMO_SOURCE_POLICY.maximumValiditySeconds.toString(),
  };
}

export {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  admissionBundlePath,
  admissionDeploymentRecordPath,
  assertNoIdentitySurfaceInBytecode,
  readValidatedAdmissionBundle,
  readValidatedAdmissionDeploymentRecord,
  semaphoreDeploymentRecordPath,
  writeJsonFile,
  type AdmissionBundleV1,
  type AdmissionDeploymentRecordV1,
  type SemaphoreDeploymentRecordV1,
  hashBytecode,
  explorerAddressUrl,
};
