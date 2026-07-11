import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { deriveApplicationRegistrationV1 } from "@agentvisa/policy";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof as upstreamGenerateProof } from "@semaphore-protocol/proof";
import { afterAll, describe, expect, it } from "vitest";

import { ApplicationRegistrationService, SqliteApplicationStore } from "../src/index.js";
import { GROUP_ID, LOGIN_PUBLIC_KEY, STABLE_APPLICATION_ID } from "./fixtures.js";

interface SemaphoreProof {
  readonly merkleTreeDepth: number;
  readonly merkleTreeRoot: string;
  readonly nullifier: string;
  readonly message: string;
  readonly scope: string;
  readonly points: readonly [string, string, string, string, string, string, string, string];
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

describe("standard Semaphore registration integration", () => {
  const directories: string[] = [];
  const stores: SqliteApplicationStore[] = [];

  afterAll(async () => {
    for (const store of stores) store.close();
    await Promise.all(
      directories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("verifies an unmodified standard Semaphore v4 proof locally", async () => {
    const identity = new Identity("synthetic-phase-3-holder");
    const decoy = new Identity("synthetic-phase-3-decoy");
    const group = new Group([identity.commitment, decoy.commitment]);
    const registration = {
      version: 1 as const,
      stableApplicationId: STABLE_APPLICATION_ID,
      loginPublicKey: LOGIN_PUBLIC_KEY,
    };
    const fields = deriveApplicationRegistrationV1(registration);
    const proof = await generateProof(identity, group, fields.message, fields.scope, 1, {
      wasm: fileURLToPath(import.meta.resolve("@zk-kit/semaphore-artifacts/semaphore-1.wasm")),
      zkey: fileURLToPath(import.meta.resolve("@zk-kit/semaphore-artifacts/semaphore-1.zkey")),
    });
    const directory = await mkdtemp(join(tmpdir(), "agentvisa-semaphore-registration-"));
    directories.push(directory);
    const store = new SqliteApplicationStore({
      databasePath: join(directory, "application.sqlite"),
    });
    stores.push(store);
    const service = new ApplicationRegistrationService({
      stableApplicationId: STABLE_APPLICATION_ID,
      credentialGroupId: GROUP_ID,
      rootPolicy: { classify: (root) => (root === group.root ? "current" : "rejected") },
      store,
      currentTime: () => 1_000n,
    });

    await expect(
      service.register({ registration, groupId: GROUP_ID, proof }),
    ).resolves.toMatchObject({
      status: "registered",
      account: { status: "active" },
    });
  }, 30_000);
});
