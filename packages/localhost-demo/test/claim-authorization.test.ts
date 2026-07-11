import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadOrCreateBrowserLoginKey,
  signBrowserLoginChallenge,
  type BrowserIdentityStorage,
} from "@agentvisa/browser-identity";
import { deriveApplicationRegistrationV1, rewardAuthorizationTypedDataV1 } from "@agentvisa/policy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getAddress, verifyTypedData, type Hex } from "viem";

import {
  DEMO_REWARD_CLAIM_CHAIN_ID,
  DEMO_REWARD_CLAIM_CONTRACT,
  DemoApplication,
  ROBOT_RALLY_APPLICATION_ID,
  createDemoHttpServer,
} from "../src/index.js";
import type { AddressInfo } from "node:net";

class MemoryBrowserStorage implements BrowserIdentityStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("authorize then claim wiring for Arbitrum Sepolia domain", () => {
  let directory: string;
  let application: DemoApplication;
  let authorizerKey: Hex;
  let authorizerAddress: `0x${string}`;
  const now = 1_750_000_000n;
  const recipient = getAddress("0x1111111111111111111111111111111111111111");

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "agentvisa-claim-wiring-"));
    authorizerKey = generatePrivateKey();
    authorizerAddress = privateKeyToAccount(authorizerKey).address;
    application = new DemoApplication({
      dataDirectory: directory,
      currentTime: () => now,
      proofVerifier: () => Promise.resolve(true),
      challengeFactory: () => "synthetic-login-challenge-claim",
      sessionTokenFactory: () => "synthetic-session-claim",
      rewardClaim: {
        authorizerPrivateKey: authorizerKey,
        chainId: BigInt(DEMO_REWARD_CLAIM_CHAIN_ID),
        verifyingContract: DEMO_REWARD_CLAIM_CONTRACT,
      },
    });
  });

  afterEach(async () => {
    application.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("issues a fresh EIP-712 authorization bound to 421614 and rejects reuse", async () => {
    expect(application.rewardClaimConfig).toMatchObject({
      enabled: true,
      chainId: DEMO_REWARD_CLAIM_CHAIN_ID,
      contractAddress: DEMO_REWARD_CLAIM_CONTRACT,
    });

    const token = await registerPlayAndWin();
    const issued = await application.issueClaimAuthorization(token, recipient);
    expect(issued.status).toBe("issued");
    if (issued.status !== "issued") return;

    expect(issued.domain.chainId).toBe(BigInt(DEMO_REWARD_CLAIM_CHAIN_ID));
    expect(issued.domain.verifyingContract).toBe(DEMO_REWARD_CLAIM_CONTRACT);
    expect(issued.authorization.recipient).toBe(recipient);
    expect(issued.authorization.claimId).not.toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );

    await expect(
      verifyTypedData({
        address: authorizerAddress,
        ...rewardAuthorizationTypedDataV1(issued.authorization, issued.domain),
        signature: issued.signature,
      }),
    ).resolves.toBe(true);

    const replay = await application.issueClaimAuthorization(token, recipient);
    expect(replay).toEqual({ status: "rejected", reason: "already_authorized" });
  });

  it("serves claim authorization over HTTP without leaking the authorizer key", async () => {
    const token = await registerPlayAndWin();
    const server = createDemoHttpServer(application);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;

    try {
      const configResponse = await fetch(`${origin}/api/config`);
      const configBody = (await configResponse.json()) as Record<string, unknown>;
      expect(configBody.rewardClaim).toMatchObject({
        enabled: true,
        chainId: DEMO_REWARD_CLAIM_CHAIN_ID,
      });
      expect(JSON.stringify(configBody)).not.toMatch(/private|authorizerPrivateKey/i);
      expect(JSON.stringify(configBody)).not.toContain(authorizerKey.slice(2));

      const response = await fetch(`${origin}/api/game/claim-authorization`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipient }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      expect(response.status).toBe(200);
      expect(body.status).toBe("issued");
      expect(JSON.stringify(body)).not.toContain(authorizerKey.slice(2));
      expect(JSON.stringify(body)).not.toMatch(/privateKey/i);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  });

  it("rejects claim authorization when reward claiming is disabled", async () => {
    application.close();
    application = new DemoApplication({
      dataDirectory: directory,
      currentTime: () => now,
      proofVerifier: () => Promise.resolve(true),
    });
    await expect(application.issueClaimAuthorization("token", recipient)).resolves.toEqual({
      status: "rejected",
      reason: "claim_disabled",
    });
  });

  async function registerPlayAndWin(): Promise<string> {
    const storage = new MemoryBrowserStorage();
    const login = await loadOrCreateBrowserLoginKey(storage);
    const enrollment = await application.enroll({
      semaphoreIdentityCommitment: "456",
    });
    expect(enrollment.status).toBe("issued");
    if (enrollment.status !== "issued") throw new Error("enrollment failed");

    const registration = {
      version: 1 as const,
      stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
      loginPublicKey: login.loginPublicKey,
    };
    const fields = deriveApplicationRegistrationV1(registration);
    const account = await application.register({
      registration,
      groupId: enrollment.credential.groupId,
      proof: {
        merkleTreeDepth: 1,
        merkleTreeRoot: enrollment.group.root.toString(),
        nullifier: "101",
        message: fields.message.toString(),
        scope: fields.scope.toString(),
        points: ["1", "2", "3", "4", "5", "6", "7", "8"],
      },
    });
    expect(account.status).toBe("registered");
    if (account.status !== "registered") throw new Error("registration failed");

    const challenge = application.createLoginChallenge(account.account.accountId);
    expect(challenge.status).toBe("created");
    if (challenge.status !== "created") throw new Error("challenge failed");
    const session = await application.createSession(
      account.account.accountId,
      await signBrowserLoginChallenge(storage, challenge.challenge),
    );
    expect(session.status).toBe("created");
    if (session.status !== "created") throw new Error("session failed");

    expect(application.play(session.token, { username: "claim-player" }).status).toBe("played");
    expect(application.win(session.token)).toMatchObject({ status: "won", wins: 1 });
    return session.token;
  }
});
