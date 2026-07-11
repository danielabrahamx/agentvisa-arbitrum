import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getAddress, keccak256, stringToHex, verifyTypedData } from "viem";
import { rewardAuthorizationTypedDataV1 } from "@agentvisa/policy";

import {
  ApplicationRegistrationService,
  RewardAuthorizer,
  RobotRallyAdapter,
  SqliteApplicationStore,
  createMemoryRewardClaimStore,
} from "../src/index.js";
import { CURRENT_ROOT, GROUP_ID, STABLE_APPLICATION_ID, createRequest } from "./fixtures.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("RewardAuthorizer", () => {
  let directory: string;
  let store: SqliteApplicationStore;
  let service: ApplicationRegistrationService;
  let robotRally: RobotRallyAdapter;
  let authorizerAccount: ReturnType<typeof privateKeyToAccount>;
  let rewardAuthorizer: RewardAuthorizer;
  const authenticate = vi.fn((_key: `0x${string}`, value: unknown) =>
    Promise.resolve(value === "signed"),
  );
  const verifyingContract = "0x5555555555555555555555555555555555555555" as const;
  const recipient = getAddress("0x4444444444444444444444444444444444444444");
  let now = 1_700_003_000n;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "agentvisa-reward-"));
    store = new SqliteApplicationStore({ databasePath: join(directory, "application.sqlite") });
    authenticate.mockClear();
    now = 1_700_003_000n;
    service = new ApplicationRegistrationService({
      stableApplicationId: STABLE_APPLICATION_ID,
      credentialGroupId: GROUP_ID,
      rootPolicy: { classify: (root) => (root === CURRENT_ROOT ? "current" : "rejected") },
      proofVerifier: () => Promise.resolve(true),
      loginKeyAuthenticator: { authenticate },
      sessionTokenFactory: () => "opaque-session-token",
      store,
      currentTime: () => now,
    });
    robotRally = new RobotRallyAdapter(service);
    authorizerAccount = privateKeyToAccount(generatePrivateKey());
    rewardAuthorizer = new RewardAuthorizer({
      stableApplicationId: STABLE_APPLICATION_ID,
      applicationAccounts: service,
      robotRally,
      store: createMemoryRewardClaimStore(),
      authorizer: authorizerAccount,
      currentTime: () => now,
    });
  });

  afterEach(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });

  async function registerPlayAndWin(): Promise<string> {
    const registered = await service.register(createRequest());
    expect(registered.status).toBe("registered");
    if (registered.status !== "registered") {
      throw new Error("registration failed");
    }
    const session = await service.createSession(registered.account.accountId, "signed");
    expect(session.status).toBe("created");
    if (session.status !== "created") {
      throw new Error("session failed");
    }
    expect(robotRally.play(session.token, { username: "blair" }).status).toBe("played");
    expect(robotRally.win(session.token).status).toBe("won");
    return session.token;
  }

  it("issues one EIP-712 authorization for an eligible Blair-style win", async () => {
    const token = await registerPlayAndWin();
    const issued = await rewardAuthorizer.issueForEligibleWin({
      token,
      recipient,
      amount: 100n,
      expiresAt: now + 3_600n,
      domain: { chainId: 31337n, verifyingContract },
    });

    expect(issued.status).toBe("issued");
    if (issued.status !== "issued") return;

    expect(issued.authorization.stableApplicationId).toBe(STABLE_APPLICATION_ID);
    expect(issued.authorization.recipient).toBe(recipient);
    expect(issued.authorization.amount).toBe(100n);
    expect(issued.result.winIndex).toBe(1);
    await expect(
      verifyTypedData({
        address: authorizerAccount.address,
        ...rewardAuthorizationTypedDataV1(issued.authorization, issued.domain),
        signature: issued.signature,
      }),
    ).resolves.toBe(true);

    expect(rewardAuthorizer.store.getClaim(issued.authorization.claimId)).toMatchObject({
      resultId: issued.result.resultId,
      accountId: issued.result.accountId,
    });
  });

  it("rejects a second authorization for the same win result", async () => {
    const token = await registerPlayAndWin();
    const input = {
      token,
      recipient,
      amount: 100n,
      expiresAt: now + 3_600n,
      domain: { chainId: 31337n, verifyingContract },
    };
    expect((await rewardAuthorizer.issueForEligibleWin(input)).status).toBe("issued");
    await expect(rewardAuthorizer.issueForEligibleWin(input)).resolves.toEqual({
      status: "rejected",
      reason: "already_authorized",
    });
  });

  it("rejects banned accounts before authorization issuance", async () => {
    const token = await registerPlayAndWin();
    const state = robotRally.listStates()[0];
    expect(state).toBeDefined();
    if (!state) return;

    expect(robotRally.ban(state.accountId)).toBe(true);

    await expect(
      rewardAuthorizer.issueForEligibleWin({
        token,
        recipient,
        amount: 100n,
        expiresAt: now + 3_600n,
        domain: { chainId: 31337n, verifyingContract },
      }),
    ).resolves.toEqual({ status: "rejected", reason: "invalid_session" });
  });

  it("rejects ineligible accounts with no win", async () => {
    const registered = await service.register(createRequest());
    if (registered.status !== "registered") throw new Error("registration failed");
    const session = await service.createSession(registered.account.accountId, "signed");
    if (session.status !== "created") throw new Error("session failed");
    robotRally.play(session.token, { username: "blair" });

    await expect(
      rewardAuthorizer.issueForEligibleWin({
        token: session.token,
        recipient,
        amount: 100n,
        expiresAt: now + 3_600n,
        domain: { chainId: 31337n, verifyingContract },
      }),
    ).resolves.toEqual({ status: "rejected", reason: "ineligible" });
  });

  it("does not put identity or proof material into issued claim records", async () => {
    const token = await registerPlayAndWin();
    const issued = await rewardAuthorizer.issueForEligibleWin({
      token,
      recipient,
      amount: 100n,
      expiresAt: now + 3_600n,
      domain: { chainId: 31337n, verifyingContract },
    });
    expect(issued.status).toBe("issued");
    if (issued.status !== "issued") return;

    const claim = rewardAuthorizer.store.getClaim(issued.authorization.claimId);
    expect(claim).toBeDefined();
    if (!claim) return;
    expect(claim).not.toHaveProperty("nullifier");
    expect(claim).not.toHaveProperty("identityCommitment");
    expect(claim).not.toHaveProperty("proof");
    expect(Object.values(claim)).not.toContain(keccak256(stringToHex("login-key")));
  });
});
