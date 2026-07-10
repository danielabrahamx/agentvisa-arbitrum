import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof as upstreamGenerateProof } from "@semaphore-protocol/proof";
import hre from "hardhat";

interface SemaphoreProof {
  readonly merkleTreeDepth: number;
  readonly merkleTreeRoot: string;
  readonly nullifier: string;
  readonly message: string;
  readonly scope: string;
  readonly points: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
}

interface SnarkArtifacts {
  readonly wasm: string;
  readonly zkey: string;
}

type GenerateProof = (
  identity: Identity,
  group: Group,
  message: bigint,
  scope: bigint,
  merkleTreeDepth: number,
  snarkArtifacts: SnarkArtifacts,
) => Promise<SemaphoreProof>;

const generateProof = upstreamGenerateProof as GenerateProof;

interface ActiveHandle {
  readonly constructor: { readonly name: string };
  close?: () => void;
}

const processWithHandles = process as NodeJS.Process & {
  _getActiveHandles(): ActiveHandle[];
};

function getActiveHandles(): Set<ActiveHandle> {
  return new Set(processWithHandles._getActiveHandles());
}

function closeNewSnarkWorkerPorts(existingHandles: Set<ActiveHandle>): void {
  for (const handle of getActiveHandles()) {
    if (!existingHandles.has(handle) && handle.constructor.name === "MessagePort") {
      handle.close?.();
    }
  }
}

const handlesBeforeProofs = getActiveHandles();

void after(() => {
  closeNewSnarkWorkerPorts(handlesBeforeProofs);
});

void describe("local Semaphore integration", () => {
  void it("deploys standard contracts and adds a synthetic Operator", async () => {
    const { viem } = await hre.network.create();
    const [admin] = await viem.getWalletClients();
    assert.ok(admin);
    const verifier = await viem.deployContract("SemaphoreVerifier");
    const poseidon = await viem.deployContract("PoseidonT3");
    const semaphore = await viem.deployContract("Semaphore", [verifier.address], {
      libraries: { PoseidonT3: poseidon.address },
    });
    const operator = new Identity("synthetic-operator-1");

    await semaphore.write.createGroup!([admin.account.address, 60n]);
    await semaphore.write.addMember!([0n, operator.commitment]);

    assert.equal(await semaphore.read.groupCounter!(), 1n);
    assert.equal(await semaphore.read.getMerkleTreeSize!([0n]), 1n);
  });

  void it("binds message and scope, then rejects nullifier replay", async () => {
    const { viem } = await hre.network.create();
    const [admin] = await viem.getWalletClients();
    assert.ok(admin);
    const verifier = await viem.deployContract("SemaphoreVerifier");
    const poseidon = await viem.deployContract("PoseidonT3");
    const semaphore = await viem.deployContract("Semaphore", [verifier.address], {
      libraries: { PoseidonT3: poseidon.address },
    });
    const operator = new Identity("synthetic-operator-proof");
    const decoy = new Identity("synthetic-operator-decoy");
    const group = new Group([operator.commitment, decoy.commitment]);
    const message = 123n;
    const scope = 456n;

    await semaphore.write.createGroup!([admin.account.address, 60n]);
    await semaphore.write.addMembers!([0n, group.members]);

    const proof = await generateProof(operator, group, message, scope, 1, {
      wasm: fileURLToPath(import.meta.resolve("@zk-kit/semaphore-artifacts/semaphore-1.wasm")),
      zkey: fileURLToPath(import.meta.resolve("@zk-kit/semaphore-artifacts/semaphore-1.zkey")),
    });

    assert.equal(await semaphore.read.verifyProof!([0n, proof]), true);
    assert.equal(await semaphore.read.verifyProof!([0n, { ...proof, message: "124" }]), false);
    assert.equal(await semaphore.read.verifyProof!([0n, { ...proof, scope: "457" }]), false);

    await semaphore.write.validateProof!([0n, proof]);
    await assert.rejects(semaphore.write.validateProof!([0n, proof]));
  });

  void it("expires a removed Operator's historical root after the configured duration", async () => {
    const { viem } = await hre.network.create();
    const [admin] = await viem.getWalletClients();
    assert.ok(admin);
    const testClient = await viem.getTestClient();
    const verifier = await viem.deployContract("SemaphoreVerifier");
    const poseidon = await viem.deployContract("PoseidonT3");
    const semaphore = await viem.deployContract("Semaphore", [verifier.address], {
      libraries: { PoseidonT3: poseidon.address },
    });
    const operator = new Identity("synthetic-operator-revoked");
    const decoy = new Identity("synthetic-operator-remaining");
    const group = new Group([operator.commitment, decoy.commitment]);

    await semaphore.write.createGroup!([admin.account.address, 60n]);
    await semaphore.write.addMembers!([0n, group.members]);

    const proof = await generateProof(operator, group, 789n, 101112n, 1, {
      wasm: fileURLToPath(import.meta.resolve("@zk-kit/semaphore-artifacts/semaphore-1.wasm")),
      zkey: fileURLToPath(import.meta.resolve("@zk-kit/semaphore-artifacts/semaphore-1.zkey")),
    });

    const { siblings } = group.generateMerkleProof(0);
    await semaphore.write.removeMember!([0n, operator.commitment, siblings]);
    group.removeMember(0);

    assert.equal(await semaphore.read.getMerkleTreeRoot!([0n]), group.root);
    assert.equal(await semaphore.read.verifyProof!([0n, proof]), true);

    await testClient.increaseTime({ seconds: 61 });
    await testClient.mine({ blocks: 1 });

    await assert.rejects(semaphore.read.verifyProof!([0n, proof]));
  });
});
