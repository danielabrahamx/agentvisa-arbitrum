import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApplicationRegistrationService,
  RobotRallyAdapter,
  SqliteApplicationStore,
  SqliteRobotRallyStore,
} from "../src/index.js";
import {
  CURRENT_ROOT,
  GROUP_ID,
  LOGIN_PUBLIC_KEY,
  STABLE_APPLICATION_ID,
  createRequest,
} from "./fixtures.js";

describe("Application account lifecycle", () => {
  let directory: string;
  let databasePath: string;
  let store: SqliteApplicationStore;
  let service: ApplicationRegistrationService;
  const authenticate = vi.fn((_key: `0x${string}`, value: unknown) =>
    Promise.resolve(value === "signed"),
  );

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "agentvisa-lifecycle-"));
    databasePath = join(directory, "application.sqlite");
    store = new SqliteApplicationStore({ databasePath });
    authenticate.mockClear();
    service = new ApplicationRegistrationService({
      stableApplicationId: STABLE_APPLICATION_ID,
      credentialGroupId: GROUP_ID,
      rootPolicy: { classify: (root) => (root === CURRENT_ROOT ? "current" : "rejected") },
      proofVerifier: () => Promise.resolve(true),
      loginKeyAuthenticator: { authenticate },
      sessionTokenFactory: () => "opaque-session-token",
      store,
      currentTime: () => 1_000n,
    });
  });

  afterEach(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("authenticates routine activity with a hashed opaque session and no new proof", async () => {
    const registered = await service.register(createRequest());
    expect(registered.status).toBe("registered");
    if (registered.status !== "registered") return;

    await expect(service.createSession(registered.account.accountId, "wrong")).resolves.toEqual({
      status: "rejected",
      reason: "invalid_login",
    });
    const session = await service.createSession(registered.account.accountId, "signed");
    expect(session).toMatchObject({ status: "created", token: "opaque-session-token" });
    expect(authenticate).toHaveBeenCalledWith(LOGIN_PUBLIC_KEY, "signed");
    expect(service.authenticateSession("opaque-session-token")).toMatchObject({
      status: "authenticated",
      account: { accountId: registered.account.accountId },
    });
    expect(service.authenticateSession("wrong-token")).toEqual({
      status: "rejected",
      reason: "invalid_session",
    });
  });

  it("atomically bans an account and invalidates all of its sessions", async () => {
    const registered = await service.register(createRequest());
    if (registered.status !== "registered") throw new Error("registration failed");
    expect((await service.createSession(registered.account.accountId, "signed")).status).toBe(
      "created",
    );

    expect(service.banAccount(registered.account.accountId)).toBe(true);
    expect(service.authenticateSession("opaque-session-token")).toEqual({
      status: "rejected",
      reason: "invalid_session",
    });
    await expect(service.createSession(registered.account.accountId, "signed")).resolves.toEqual({
      status: "rejected",
      reason: "banned",
    });
    expect(store.getAccount(registered.account.accountId)?.status).toBe("banned");
  });

  it("stores only session digests and redacted audit fields", async () => {
    const registered = await service.register(createRequest());
    if (registered.status !== "registered") throw new Error("registration failed");
    await service.createSession(registered.account.accountId, "signed");

    expect(store.listAuditEvents()).toEqual([
      {
        eventType: "account_registered",
        stableApplicationId: STABLE_APPLICATION_ID,
        accountId: registered.account.accountId,
        occurredAt: 1_000n,
      },
      {
        eventType: "session_created",
        stableApplicationId: STABLE_APPLICATION_ID,
        accountId: registered.account.accountId,
        occurredAt: 1_000n,
      },
    ]);
    expect(
      JSON.stringify(store.listAuditEvents(), (_key: string, value: unknown): unknown =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toMatch(/nullifier|login|proof|identity|enrollment|session-token/i);
    store.close();
    expect((await readFile(databasePath)).toString("latin1")).not.toContain("opaque-session-token");
  });

  it("keeps Robot Rally play, wins, bot flags, usernames, and wallets game-local", async () => {
    const registered = await service.register(createRequest());
    if (registered.status !== "registered") throw new Error("registration failed");
    await service.createSession(registered.account.accountId, "signed");
    const robotRally = new RobotRallyAdapter(service);

    expect(
      robotRally.play("opaque-session-token", {
        username: "first-name",
        wallet: "0xfirst-wallet",
      }),
    ).toMatchObject({ status: "played", plays: 1 });
    expect(robotRally.win("opaque-session-token")).toMatchObject({ status: "won", wins: 1 });
    expect(
      robotRally.play("opaque-session-token", {
        username: "changed-name",
        wallet: "0xchanged-wallet",
      }),
    ).toMatchObject({
      status: "played",
      accountId: registered.account.accountId,
      plays: 2,
    });
    expect(robotRally.flagBot(registered.account.accountId)).toMatchObject({
      isManuallyFlaggedBot: true,
    });

    expect(robotRally.ban(registered.account.accountId)).toBe(true);
    expect(robotRally.play("opaque-session-token", { username: "again" })).toEqual({
      status: "rejected",
      reason: "invalid_session",
    });
    expect(robotRally.getState(registered.account.accountId)).toMatchObject({
      plays: 2,
      wins: 1,
      isManuallyFlaggedBot: true,
      isBanned: true,
    });
  });

  it("preserves Robot Rally state across adapter and process restarts", async () => {
    const registered = await service.register(createRequest());
    if (registered.status !== "registered") throw new Error("registration failed");
    await service.createSession(registered.account.accountId, "signed");
    const gameStore = new SqliteRobotRallyStore({ databasePath });
    const robotRally = new RobotRallyAdapter(service, gameStore);

    robotRally.play("opaque-session-token", {
      username: "alex-before-refresh",
      wallet: "0xwallet-a",
    });
    robotRally.win("opaque-session-token");
    robotRally.flagBot(registered.account.accountId);
    gameStore.close();

    const restartedStore = new SqliteRobotRallyStore({ databasePath });
    const restarted = new RobotRallyAdapter(service, restartedStore);
    expect(restarted.getState(registered.account.accountId)).toMatchObject({
      accountId: registered.account.accountId,
      plays: 1,
      wins: 1,
      isManuallyFlaggedBot: true,
      isBanned: false,
      latestUsername: "alex-before-refresh",
      latestWallet: "0xwallet-a",
    });
    restartedStore.close();
  });
});
