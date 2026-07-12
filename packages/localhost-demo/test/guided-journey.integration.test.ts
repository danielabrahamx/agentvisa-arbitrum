import type { AddressInfo } from "node:net";
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
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getAddress, type Hex } from "viem";

import {
  DEMO_REWARD_CLAIM_CHAIN_ID,
  DEMO_REWARD_CLAIM_CONTRACT,
  DemoApplication,
  ROBOT_RALLY_APPLICATION_ID,
  createDemoHttpServer,
} from "../src/index.js";

class MemoryBrowserStorage implements BrowserIdentityStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("guided demo HTTP journey", () => {
  let directory: string;
  let application: DemoApplication;
  let server: ReturnType<typeof createDemoHttpServer>;
  let origin: string;
  let authorizerKey: Hex;
  const holderCommitment = "888001";
  const recipient = getAddress("0x2222222222222222222222222222222222222222");

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "agentvisa-guided-journey-"));
    authorizerKey = generatePrivateKey();
    application = new DemoApplication({
      dataDirectory: directory,
      currentTime: () => 1_750_000_000n,
      proofVerifier: (proof) => Promise.resolve(proof.points[0] !== 999n),
      challengeFactory: () => "synthetic-login-challenge-guided",
      sessionTokenFactory: (() => {
        let index = 0;
        return () => `guided-session-${++index}`;
      })(),
      rewardClaim: {
        authorizerPrivateKey: authorizerKey,
        chainId: BigInt(DEMO_REWARD_CLAIM_CHAIN_ID),
        verifyingContract: DEMO_REWARD_CLAIM_CONTRACT,
      },
    });
    server = createDemoHttpServer(application);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error === undefined ? resolve() : reject(error))),
    );
    application.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("walks enroll → register → sybil conflict → session → play → win → claim-authorization", async () => {
    const primaryStorage = new MemoryBrowserStorage();
    const sybilStorage = new MemoryBrowserStorage();
    const primaryLogin = await loadOrCreateBrowserLoginKey(primaryStorage);
    const substitutedLogin = await loadOrCreateBrowserLoginKey(sybilStorage);

    const enrollFirst = await post("/api/enroll", {
      semaphoreIdentityCommitment: holderCommitment,
    });
    expect(enrollFirst.status).toBe(200);
    const issuedEnrollment = parseIssuedEnrollment(enrollFirst.body);
    expect(issuedEnrollment.status).toBe("issued");

    const enrollRetry = await post("/api/enroll", {
      semaphoreIdentityCommitment: holderCommitment,
    });
    expect(enrollRetry.status).toBe(200);
    expect(enrollRetry.body).toMatchObject({ status: "existing" });

    const registration = {
      version: 1 as const,
      stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
      loginPublicKey: primaryLogin.loginPublicKey,
    };
    const fields = deriveApplicationRegistrationV1(registration);
    const proof = {
      merkleTreeDepth: 1,
      merkleTreeRoot: issuedEnrollment.group.root,
      nullifier: "707",
      message: fields.message.toString(),
      scope: fields.scope.toString(),
      points: ["1", "2", "3", "4", "5", "6", "7", "8"],
    };

    const registerFirst = await post("/api/register", {
      registration,
      groupId: issuedEnrollment.credential.groupId,
      proof,
    });
    expect(registerFirst.status).toBe(200);
    expect(registerFirst.body).toMatchObject({ status: "registered" });
    const registeredAccount = parseRegisteredAccount(registerFirst.body);

    const registerRetry = await post("/api/register", {
      registration,
      groupId: issuedEnrollment.credential.groupId,
      proof,
    });
    expect(registerRetry.status).toBe(200);
    expect(registerRetry.body).toMatchObject({ status: "existing" });

    const substitutedRegistration = {
      ...registration,
      loginPublicKey: substitutedLogin.loginPublicKey,
    };
    const substitutedFields = deriveApplicationRegistrationV1(substitutedRegistration);
    const sybilAttempt = await post("/api/register", {
      registration: substitutedRegistration,
      groupId: issuedEnrollment.credential.groupId,
      proof: {
        ...proof,
        message: substitutedFields.message.toString(),
      },
    });
    expect(sybilAttempt.status).toBe(409);
    expect(sybilAttempt.body).toEqual({
      status: "conflict",
      reason: "login_key_substitution",
    });

    const accountId = registeredAccount.accountId;
    const challenge = await post("/api/game/login-challenge", { accountId });
    expect(challenge.status).toBe(200);
    expect(challenge.body).toMatchObject({ status: "created" });
    if (challenge.body.status !== "created") throw new Error("challenge failed");

    const authentication = await signBrowserLoginChallenge(
      primaryStorage,
      challenge.body.challenge as string,
    );
    const session = await post("/api/game/session", { accountId, authentication });
    expect(session.status).toBe(200);
    expect(session.body).toMatchObject({ status: "created" });
    if (session.body.status !== "created") throw new Error("session failed");
    const token = session.body.token as string;

    const play = await post(
      "/api/game/play",
      { username: "guided-player", wallet: "0x0000000000000000000000000000000000000001" },
      token,
    );
    expect(play.status).toBe(200);
    expect(play.body).toMatchObject({ status: "played", plays: 1 });

    const win = await post("/api/game/win", {}, token);
    expect(win.status).toBe(200);
    expect(win.body).toMatchObject({ status: "won", wins: 1 });

    const claim = await post("/api/game/claim-authorization", { recipient }, token);
    expect(claim.status).toBe(200);
    expect(claim.body).toMatchObject({ status: "issued" });
    expect(JSON.stringify(claim.body)).not.toContain(authorizerKey.slice(2));
    expect(JSON.stringify(claim.body)).not.toMatch(/privateKey/i);

    const claimReplay = await post("/api/game/claim-authorization", { recipient }, token);
    expect(claimReplay.status).toBe(403);
    expect(claimReplay.body).toEqual({ status: "rejected", reason: "already_authorized" });

    expect(privateKeyToAccount(authorizerKey).address).toMatch(/^0x/i);
  });

  async function post(
    path: string,
    body: unknown,
    token?: string,
  ): Promise<{ readonly status: number; readonly body: Record<string, unknown> }> {
    const response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });
    const parsed = (await response.json()) as Record<string, unknown>;
    return { status: response.status, body: parsed };
  }
});

function parseIssuedEnrollment(body: Record<string, unknown>): {
  readonly status: "issued";
  readonly credential: { readonly groupId: Hex };
  readonly group: { readonly root: string };
} {
  if (
    body.status !== "issued" ||
    typeof body.group !== "object" ||
    body.group === null ||
    typeof (body.group as { root?: unknown }).root !== "string" ||
    typeof body.credential !== "object" ||
    body.credential === null ||
    typeof (body.credential as { groupId?: unknown }).groupId !== "string"
  ) {
    throw new Error("expected issued enrollment");
  }
  return body as {
    status: "issued";
    credential: { groupId: Hex };
    group: { root: string };
  };
}

function parseRegisteredAccount(body: Record<string, unknown>): { readonly accountId: Hex } {
  if (
    body.status !== "registered" ||
    typeof body.account !== "object" ||
    body.account === null ||
    typeof (body.account as { accountId?: unknown }).accountId !== "string"
  ) {
    throw new Error("expected registered account");
  }
  return { accountId: (body.account as { accountId: Hex }).accountId };
}
