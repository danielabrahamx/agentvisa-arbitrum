import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { createPublicClient, getAddress, http } from "viem";
import { arbitrumSepolia } from "viem/chains";

import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  PUBLIC_ARBITRUM_SEPOLIA_RPC,
  admissionBundlePath,
  admissionDeploymentRecordPath,
  readValidatedAdmissionBundle,
  readValidatedAdmissionDeploymentRecord,
  readValidatedSemaphoreDeploymentRecord,
  semaphoreDeploymentRecordPath,
} from "../../scripts/deployment-records.js";

const workspaceRoot = resolve(import.meta.dirname, "../../../..");

const admissionAbi = [
  {
    type: "function",
    name: "enrollmentSigner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "credentialGroupId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const semaphoreAbi = [
  {
    type: "function",
    name: "groupCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getGroupAdmin",
    stateMutability: "view",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

void describe("Arbitrum Sepolia admission integration", () => {
  void it("confirms deployed admission stack against public RPC when records exist", async () => {
    if (
      !existsSync(semaphoreDeploymentRecordPath(workspaceRoot)) ||
      !existsSync(admissionDeploymentRecordPath(workspaceRoot)) ||
      !existsSync(admissionBundlePath(workspaceRoot))
    ) {
      return;
    }

    const semaphoreRecord = readValidatedSemaphoreDeploymentRecord(workspaceRoot);
    const admissionRecord = readValidatedAdmissionDeploymentRecord(workspaceRoot);
    const bundle = readValidatedAdmissionBundle(workspaceRoot);

    assert.equal(semaphoreRecord.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
    assert.equal(admissionRecord.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
    assert.equal(bundle.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
    assert.equal(getAddress(bundle.admission), getAddress(admissionRecord.address));
    assert.equal(getAddress(bundle.semaphore), getAddress(semaphoreRecord.address));

    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(process.env.ARBITRUM_SEPOLIA_RPC_URL ?? PUBLIC_ARBITRUM_SEPOLIA_RPC),
    });

    const [semaphoreCode, admissionCode] = await Promise.all([
      publicClient.getCode({ address: semaphoreRecord.address }),
      publicClient.getCode({ address: admissionRecord.address }),
    ]);
    assert.ok(semaphoreCode && semaphoreCode !== "0x");
    assert.ok(admissionCode && admissionCode !== "0x");

    const onChainSigner = getAddress(
      await publicClient.readContract({
        address: admissionRecord.address,
        abi: admissionAbi,
        functionName: "enrollmentSigner",
      }),
    );
    assert.equal(onChainSigner, getAddress(admissionRecord.enrollmentSigner));
    assert.equal(onChainSigner, getAddress(bundle.enrollmentSigner));

    const groupId = BigInt(admissionRecord.credentialGroupId);
    const groupAdmin = getAddress(
      await publicClient.readContract({
        address: semaphoreRecord.address,
        abi: semaphoreAbi,
        functionName: "getGroupAdmin",
        args: [groupId],
      }),
    );
    assert.equal(groupAdmin, getAddress(admissionRecord.address));
  });
});
