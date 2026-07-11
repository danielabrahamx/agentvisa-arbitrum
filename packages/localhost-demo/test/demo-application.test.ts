import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadOrCreateBrowserLoginKey,
  signBrowserLoginChallenge,
  type BrowserIdentityStorage,
} from "@agentvisa/browser-identity";
import { deriveApplicationRegistrationV1 } from "@agentvisa/policy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DemoApplication, ROBOT_RALLY_APPLICATION_ID } from "../src/index.js";

class MemoryBrowserStorage implements BrowserIdentityStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("localhost demo service", () => {
  let directory: string;
  let application: DemoApplication;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "agentvisa-localhost-demo-"));
    application = new DemoApplication({
      dataDirectory: directory,
      currentTime: () => 1_750_000_000n,
      proofVerifier: (proof) => Promise.resolve(proof.points[0] !== 999n),
      challengeFactory: () => "synthetic-login-challenge-0001",
      sessionTokenFactory: (() => {
        let index = 0;
        return () => `synthetic-session-${++index}`;
      })(),
    });
  });

  afterEach(async () => {
    application.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("runs two browser holders without another routine proof", async () => {
    const firstStorage = new MemoryBrowserStorage();
    const firstLogin = await loadOrCreateBrowserLoginKey(firstStorage);
    const firstEnrollment = await application.enroll({
      semaphoreIdentityCommitment: "123",
    });
    const firstRetry = await application.enroll({
      semaphoreIdentityCommitment: "123",
    });
    expect(firstEnrollment.status).toBe("issued");
    expect(firstRetry).toEqual({ ...firstEnrollment, status: "existing" });
    if (firstEnrollment.status !== "issued") throw new Error("first enrollment failed");

    const firstRegistration = {
      version: 1 as const,
      stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
      loginPublicKey: firstLogin.loginPublicKey,
    };
    const firstProof = proofFor(firstRegistration, firstEnrollment.group.root, 101n);
    const firstAccount = await application.register({
      registration: firstRegistration,
      groupId: firstEnrollment.credential.groupId,
      proof: firstProof,
    });
    const firstDuplicate = await application.register({
      registration: firstRegistration,
      groupId: firstEnrollment.credential.groupId,
      proof: firstProof,
    });
    expect(firstAccount.status).toBe("registered");
    expect(firstDuplicate).toMatchObject({ status: "existing" });
    if (firstAccount.status !== "registered") throw new Error("first registration failed");

    const firstChallenge = application.createLoginChallenge(firstAccount.account.accountId);
    if (firstChallenge.status !== "created") throw new Error("first challenge failed");
    const firstAuthentication = await signBrowserLoginChallenge(
      firstStorage,
      firstChallenge.challenge,
    );
    const firstSession = await application.createSession(
      firstAccount.account.accountId,
      firstAuthentication,
    );
    if (firstSession.status !== "created") throw new Error("first session failed");
    expect(
      application.play(firstSession.token, {
        username: "player-a",
        wallet: "0x0000000000000000000000000000000000000001",
      }),
    ).toMatchObject({ status: "played", plays: 1 });
    expect(
      application.play(firstSession.token, {
        username: "player-b",
        wallet: "0x0000000000000000000000000000000000000002",
      }),
    ).toMatchObject({ status: "played", accountId: firstAccount.account.accountId, plays: 2 });
    expect(application.flagBot(firstAccount.account.accountId)).toMatchObject({
      isManuallyFlaggedBot: true,
    });
    expect(application.ban(firstAccount.account.accountId)).toBe(true);
    expect(application.play(firstSession.token, {})).toEqual({
      status: "rejected",
      reason: "invalid_session",
    });
    await expect(
      application.register({
        registration: firstRegistration,
        groupId: firstEnrollment.credential.groupId,
        proof: firstProof,
      }),
    ).resolves.toMatchObject({
      status: "existing",
      account: { accountId: firstAccount.account.accountId, status: "banned" },
    });

    const secondStorage = new MemoryBrowserStorage();
    const secondLogin = await loadOrCreateBrowserLoginKey(secondStorage);
    const secondEnrollment = await application.enroll({
      semaphoreIdentityCommitment: "456",
    });
    if (secondEnrollment.status !== "issued") throw new Error("second enrollment failed");
    const secondRegistration = {
      version: 1 as const,
      stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
      loginPublicKey: secondLogin.loginPublicKey,
    };
    const secondAccount = await application.register({
      registration: secondRegistration,
      groupId: secondEnrollment.credential.groupId,
      proof: proofFor(secondRegistration, secondEnrollment.group.root, 202n),
    });
    if (secondAccount.status !== "registered") throw new Error("second registration failed");
    const secondChallenge = application.createLoginChallenge(secondAccount.account.accountId);
    if (secondChallenge.status !== "created") throw new Error("second challenge failed");
    const secondSession = await application.createSession(
      secondAccount.account.accountId,
      await signBrowserLoginChallenge(secondStorage, secondChallenge.challenge),
    );
    if (secondSession.status !== "created") throw new Error("second session failed");
    expect(application.play(secondSession.token, { username: "player-c" })).toMatchObject({
      status: "played",
    });
    expect(application.win(secondSession.token)).toMatchObject({ status: "won", wins: 1 });

    const operatorAccounts = application.listOperatorAccounts();
    expect(operatorAccounts).toHaveLength(2);
    expect(JSON.stringify(operatorAccounts)).not.toMatch(
      /identity|commitment|nullifier|proof|enrollment|loginPublicKey/i,
    );
    expect(
      JSON.stringify(application.listAuditEvents(), (_key, value: unknown) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toMatch(/identity|commitment|nullifier|proof|enrollment|subject|session-token/i);
  });

  it("preserves game account state across username, wallet, and process restart", async () => {
    const storage = new MemoryBrowserStorage();
    const login = await loadOrCreateBrowserLoginKey(storage);
    const enrollment = await application.enroll({
      semaphoreIdentityCommitment: "123",
    });
    if (enrollment.status !== "issued") throw new Error("enrollment failed");
    const registration = {
      version: 1 as const,
      stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
      loginPublicKey: login.loginPublicKey,
    };
    const account = await application.register({
      registration,
      groupId: enrollment.credential.groupId,
      proof: proofFor(registration, enrollment.group.root, 101n),
    });
    if (account.status !== "registered") throw new Error("registration failed");
    const challenge = application.createLoginChallenge(account.account.accountId);
    if (challenge.status !== "created") throw new Error("challenge failed");
    const session = await application.createSession(
      account.account.accountId,
      await signBrowserLoginChallenge(storage, challenge.challenge),
    );
    if (session.status !== "created") throw new Error("session failed");
    expect(
      application.play(session.token, {
        username: "player-a",
        wallet: "0x0000000000000000000000000000000000000001",
      }),
    ).toMatchObject({ status: "played", plays: 1 });

    application.close();
    application = new DemoApplication({
      dataDirectory: directory,
      currentTime: () => 1_750_000_000n,
      proofVerifier: (proof) => Promise.resolve(proof.points[0] !== 999n),
      challengeFactory: () => "synthetic-login-challenge-0001",
      sessionTokenFactory: () => "synthetic-session-restart",
    });

    const retryChallenge = application.createLoginChallenge(account.account.accountId);
    if (retryChallenge.status !== "created") throw new Error("restart challenge failed");
    const restartSession = await application.createSession(
      account.account.accountId,
      await signBrowserLoginChallenge(storage, retryChallenge.challenge),
    );
    if (restartSession.status !== "created") throw new Error("restart session failed");
    expect(
      application.play(restartSession.token, {
        username: "player-b",
        wallet: "0x0000000000000000000000000000000000000002",
      }),
    ).toMatchObject({
      status: "played",
      accountId: account.account.accountId,
      plays: 2,
    });
  });

  it("returns the same enrollment after a process restart and authorization expiry", async () => {
    const first = await application.enroll({
      semaphoreIdentityCommitment: "123",
    });
    expect(first.status).toBe("issued");
    application.close();
    application = new DemoApplication({
      dataDirectory: directory,
      currentTime: () => 1_750_001_000n,
      proofVerifier: () => Promise.resolve(true),
    });

    await expect(
      application.enroll({
        semaphoreIdentityCommitment: "123",
      }),
    ).resolves.toEqual({ ...first, status: "existing" });
  });

  it.each([
    [
      "wrong group",
      (valid: RegistrationRequest) => ({ ...valid, groupId: hex32("wrong") }),
      "wrong_group",
    ],
    [
      "wrong root",
      (valid: RegistrationRequest) => ({
        ...valid,
        proof: { ...valid.proof, merkleTreeRoot: "999" },
      }),
      "unaccepted_root",
    ],
    [
      "wrong message",
      (valid: RegistrationRequest) => ({ ...valid, proof: { ...valid.proof, message: "999" } }),
      "wrong_message",
    ],
    [
      "wrong scope",
      (valid: RegistrationRequest) => ({ ...valid, proof: { ...valid.proof, scope: "999" } }),
      "wrong_scope",
    ],
    [
      "malformed proof",
      (valid: RegistrationRequest) => ({ ...valid, proof: { ...valid.proof, points: ["1"] } }),
      "malformed_request",
    ],
    [
      "invalid proof",
      (valid: RegistrationRequest) => ({
        ...valid,
        proof: {
          ...valid.proof,
          points: ["999", "2", "3", "4", "5", "6", "7", "8"],
        },
      }),
      "invalid_proof",
    ],
  ])("prepares the %s failure without leaking input", async (_name, mutate, reason) => {
    const storage = new MemoryBrowserStorage();
    const login = await loadOrCreateBrowserLoginKey(storage);
    const enrollment = await application.enroll({
      semaphoreIdentityCommitment: "123",
    });
    if (enrollment.status !== "issued") throw new Error("enrollment failed");
    const registration = {
      version: 1 as const,
      stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
      loginPublicKey: login.loginPublicKey,
    };
    const valid = {
      registration,
      groupId: enrollment.credential.groupId,
      proof: proofFor(registration, enrollment.group.root, 101n),
    };

    await expect(application.register(mutate(valid) as never)).resolves.toEqual({
      status: "rejected",
      reason,
    });
  });
});

interface RegistrationRequest {
  readonly registration: {
    readonly version: 1;
    readonly stableApplicationId: `0x${string}`;
    readonly loginPublicKey: `0x${string}`;
  };
  readonly groupId: `0x${string}`;
  readonly proof: {
    readonly merkleTreeDepth: number;
    readonly merkleTreeRoot: string;
    readonly nullifier: string;
    readonly message: string;
    readonly scope: string;
    readonly points: readonly string[];
  };
}

function proofFor(
  registration: RegistrationRequest["registration"],
  root: bigint,
  nullifier: bigint,
): RegistrationRequest["proof"] {
  const fields = deriveApplicationRegistrationV1(registration);
  return {
    merkleTreeDepth: 1,
    merkleTreeRoot: root.toString(),
    nullifier: nullifier.toString(),
    message: fields.message.toString(),
    scope: fields.scope.toString(),
    points: ["1", "2", "3", "4", "5", "6", "7", "8"],
  };
}

function hex32(value: string): `0x${string}` {
  void value;
  return `0x${"11".repeat(32)}`;
}
