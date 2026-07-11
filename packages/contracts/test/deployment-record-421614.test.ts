import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { Hex } from "viem";

import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  assertNoIdentitySurfaceInBytecode,
  blairClaimProofPath,
  deploymentRecordPath,
  readValidatedBlairClaimProof,
  readValidatedDeploymentRecord,
  validateBlairClaimProof,
  validateDeploymentRecord,
} from "../scripts/deployment-records.js";

const workspaceRoot = resolve(import.meta.dirname, "../../..");
const schemaPath = resolve(workspaceRoot, "deployments/deployment-record.schema.json");

void describe("Arbitrum Sepolia deployment records", () => {
  void it("keeps the deployment record schema requiring authorizer and provenance fields", () => {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      required: string[];
      properties: Record<string, unknown>;
    };
    for (const key of [
      "schemaVersion",
      "chainId",
      "contractName",
      "address",
      "bytecodeHash",
      "source",
      "constructorArguments",
      "deployer",
      "authorizer",
      "transactionHash",
      "explorerUrl",
      "verificationStatus",
    ]) {
      assert.ok(schema.required.includes(key), `schema must require ${key}`);
      assert.ok(key in schema.properties, `schema must define ${key}`);
    }
  });

  void it("rejects incomplete deployment records", () => {
    assert.throws(() =>
      validateDeploymentRecord({
        schemaVersion: 1,
        chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
        contractName: "GameRewardClaim",
      }),
    );
  });

  void it("validates the committed 421614 GameRewardClaim record when present", () => {
    const path = deploymentRecordPath(workspaceRoot);
    if (!existsSync(path)) {
      return;
    }
    const record = readValidatedDeploymentRecord(workspaceRoot);
    assert.equal(record.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
    assert.equal(record.contractName, "GameRewardClaim");
    assert.equal(record.constructorArguments[0], record.authorizer);
  });

  void it("validates the committed Blair claim proof when present", () => {
    const path = blairClaimProofPath(workspaceRoot);
    if (!existsSync(path)) {
      return;
    }
    const proof = readValidatedBlairClaimProof(workspaceRoot);
    assert.equal(proof.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
    assert.equal(proof.replayRejected, true);
    assert.ok(proof.replayError.length > 0);
    assert.throws(() =>
      validateBlairClaimProof({
        ...proof,
        notes: [...proof.notes, "contains nullifier evidence"],
      }),
    );
  });

  void it("rejects bytecode that embeds identity surface strings", () => {
    const leaked: Hex = `0x${Buffer.from("nullifier", "utf8").toString("hex")}`;
    assert.throws(() => assertNoIdentitySurfaceInBytecode(leaked));
  });
});
