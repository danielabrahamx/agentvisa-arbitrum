import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { createPublicClient, getAddress, http, keccak256, stringToHex } from "viem";
import { arbitrumSepolia } from "viem/chains";

import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  PUBLIC_ARBITRUM_SEPOLIA_RPC,
  assertNoIdentitySurfaceInBytecode,
  blairClaimProofPath,
  deploymentRecordPath,
  readValidatedBlairClaimProof,
  readValidatedDeploymentRecord,
} from "../../scripts/deployment-records.js";

const workspaceRoot = resolve(import.meta.dirname, "../../../..");
const gameRewardClaimAbi = [
  {
    type: "function",
    name: "authorizer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "claimConsumed",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "syntheticPoints",
    stateMutability: "view",
    inputs: [
      { name: "stableApplicationId", type: "bytes32" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

void describe("Arbitrum Sepolia GameRewardClaim integration", () => {
  void it("confirms deployed claim state against public RPC when records exist", async () => {
    if (
      !existsSync(deploymentRecordPath(workspaceRoot)) ||
      !existsSync(blairClaimProofPath(workspaceRoot))
    ) {
      return;
    }

    const record = readValidatedDeploymentRecord(workspaceRoot);
    const proof = readValidatedBlairClaimProof(workspaceRoot);
    assert.equal(record.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
    assert.equal(proof.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
    assert.equal(proof.contractAddress, record.address);
    assert.equal(proof.authorizer, record.authorizer);
    assert.equal(proof.replayRejected, true);

    const client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(PUBLIC_ARBITRUM_SEPOLIA_RPC),
    });
    assert.equal(await client.getChainId(), ARBITRUM_SEPOLIA_CHAIN_ID);

    const bytecode = await client.getCode({ address: record.address });
    assert.ok(bytecode && bytecode !== "0x");
    assertNoIdentitySurfaceInBytecode(bytecode);

    const authorizer = getAddress(
      await client.readContract({
        address: record.address,
        abi: gameRewardClaimAbi,
        functionName: "authorizer",
      }),
    );
    assert.equal(authorizer, record.authorizer);

    const consumed = await client.readContract({
      address: record.address,
      abi: gameRewardClaimAbi,
      functionName: "claimConsumed",
      args: [proof.claimId],
    });
    assert.equal(consumed, true);

    const points = await client.readContract({
      address: record.address,
      abi: gameRewardClaimAbi,
      functionName: "syntheticPoints",
      args: [proof.stableApplicationId, proof.recipient],
    });
    assert.equal(points.toString(), proof.syntheticPointsAfterClaim);
    assert.ok(points > 0n);

    // Confirm the recorded application id matches the Robot Rally stable id.
    assert.equal(proof.stableApplicationId, keccak256(stringToHex("agentvisa.robot-rally.v1")));
  });

  void it("records that no World or Semaphore verifier was deployed for chain 421614", () => {
    if (!existsSync(deploymentRecordPath(workspaceRoot))) {
      return;
    }
    const record = readValidatedDeploymentRecord(workspaceRoot);
    assert.equal(record.contractName, "GameRewardClaim");
    assert.notEqual(record.contractName.toLowerCase().includes("world"), true);
    assert.notEqual(record.contractName.toLowerCase().includes("semaphore"), true);
    assert.equal(record.constructorArguments.length, 1);
  });
});
