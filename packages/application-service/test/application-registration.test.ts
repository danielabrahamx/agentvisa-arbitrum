import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApplicationRegistrationService,
  SqliteApplicationStore,
  type RegistrationProof,
} from "../src/index.js";
import {
  CURRENT_ROOT,
  GROUP_ID,
  HISTORICAL_ROOT,
  LOGIN_PUBLIC_KEY,
  OTHER_APPLICATION_ID,
  OTHER_LOGIN_PUBLIC_KEY,
  REGISTRATION_NULLIFIER,
  STABLE_APPLICATION_ID,
  createProof,
  createRegistration,
  createRequest,
} from "./fixtures.js";

describe("Application registration", () => {
  let directory: string;
  let databasePath: string;
  let stores: SqliteApplicationStore[];

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "agentvisa-application-"));
    databasePath = join(directory, "application.sqlite");
    stores = [];
  });

  afterEach(async () => {
    for (const store of stores) {
      store.close();
    }
    await rm(directory, { recursive: true, force: true });
  });

  function createService(
    options: {
      path?: string;
      applicationId?: `0x${string}`;
      proofVerifier?: (proof: RegistrationProof) => Promise<boolean>;
      roots?: readonly bigint[];
    } = {},
  ) {
    const store = new SqliteApplicationStore({ databasePath: options.path ?? databasePath });
    stores.push(store);
    const proofVerifier = vi.fn(options.proofVerifier ?? (() => Promise.resolve(true)));
    return {
      store,
      proofVerifier,
      service: new ApplicationRegistrationService({
        stableApplicationId: options.applicationId ?? STABLE_APPLICATION_ID,
        credentialGroupId: GROUP_ID,
        rootPolicy: {
          classify(root) {
            if (root === CURRENT_ROOT) return "current";
            if ((options.roots ?? [HISTORICAL_ROOT]).includes(root)) return "historical";
            return "rejected";
          },
        },
        proofVerifier,
        store,
        currentTime: () => 1_000n,
      }),
    };
  }

  it("verifies a valid proof and creates one pseudonymous account", async () => {
    const { service, proofVerifier } = createService();

    const result = await service.register(createRequest());

    expect(result).toMatchObject({
      status: "registered",
      account: {
        stableApplicationId: STABLE_APPLICATION_ID,
        loginPublicKey: LOGIN_PUBLIC_KEY,
        status: "active",
      },
      rootStatus: "current",
    });
    expect(proofVerifier).toHaveBeenCalledOnce();
    expect(
      JSON.stringify(result, (_key: string, value: unknown): unknown =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toMatch(/identity|enrollment|opaqueSubject|merkleTree|points|proof/i);
  });

  it.each([
    [
      "wrong application",
      createRequest(createRegistration({ stableApplicationId: OTHER_APPLICATION_ID })),
      "wrong_application",
    ],
    ["wrong group", { ...createRequest(), groupId: OTHER_APPLICATION_ID }, "wrong_group"],
    [
      "wrong root",
      createRequest(
        createRegistration(),
        createProof(createRegistration(), { merkleTreeRoot: 999n }),
      ),
      "unaccepted_root",
    ],
    [
      "wrong message",
      createRequest(createRegistration(), createProof(createRegistration(), { message: 999n })),
      "wrong_message",
    ],
    [
      "wrong scope",
      createRequest(createRegistration(), createProof(createRegistration(), { scope: 999n })),
      "wrong_scope",
    ],
  ] as const)("rejects %s before proof verification", async (_name, request, reason) => {
    const { service, proofVerifier } = createService();

    await expect(service.register(request)).resolves.toEqual({ status: "rejected", reason });
    expect(proofVerifier).not.toHaveBeenCalled();
  });

  it.each([
    ["non-object request", null],
    ["extra request field", { ...createRequest(), identitySecret: "forbidden" }],
    [
      "malformed Login Key",
      {
        ...createRequest(),
        registration: { ...createRegistration(), loginPublicKey: "0x12" },
      },
    ],
    [
      "extra proof field",
      { ...createRequest(), proof: { ...createProof(), rawProof: "forbidden" } },
    ],
    ["malformed point", { ...createRequest(), proof: { ...createProof(), points: [1n] } }],
    ["zero nullifier", { ...createRequest(), proof: { ...createProof(), nullifier: 0n } }],
  ])("rejects malformed input: %s", async (_name, input) => {
    const { service, proofVerifier } = createService();

    await expect(service.register(input)).resolves.toEqual({
      status: "rejected",
      reason: "malformed_request",
    });
    expect(proofVerifier).not.toHaveBeenCalled();
  });

  it("rejects a cryptographically invalid proof", async () => {
    const { service } = createService({ proofVerifier: () => Promise.resolve(false) });

    await expect(service.register(createRequest())).resolves.toEqual({
      status: "rejected",
      reason: "invalid_proof",
    });
  });

  it("accepts an explicitly configured historical root", async () => {
    const registration = createRegistration();
    const request = createRequest(
      registration,
      createProof(registration, { merkleTreeRoot: HISTORICAL_ROOT }),
    );
    const { service } = createService();

    await expect(service.register(request)).resolves.toMatchObject({
      status: "registered",
      rootStatus: "historical",
    });
  });

  it("returns the authoritative active or banned account on an identical retry", async () => {
    const { service } = createService();
    const first = await service.register(createRequest());
    expect(first.status).toBe("registered");
    if (first.status !== "registered") return;

    await expect(service.register(createRequest())).resolves.toMatchObject({
      status: "existing",
      account: first.account,
    });
    expect(service.banAccount(first.account.accountId)).toBe(true);
    await expect(service.register(createRequest())).resolves.toMatchObject({
      status: "existing",
      account: { accountId: first.account.accountId, status: "banned" },
    });
  });

  it("rejects nullifier replay with Login Key substitution", async () => {
    const { service } = createService();
    expect((await service.register(createRequest())).status).toBe("registered");
    const changed = createRegistration({ loginPublicKey: OTHER_LOGIN_PUBLIC_KEY });

    await expect(service.register(createRequest(changed))).resolves.toEqual({
      status: "conflict",
      reason: "login_key_substitution",
    });
  });

  it("serializes concurrent identical registrations to one account", async () => {
    const first = createService().service;
    const second = createService().service;

    const results = await Promise.all([
      first.register(createRequest()),
      second.register(createRequest()),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual(["existing", "registered"]);
    const accountIds = results.flatMap((result) =>
      result.status === "registered" || result.status === "existing"
        ? [result.account.accountId]
        : [],
    );
    expect(new Set(accountIds).size).toBe(1);
  });

  it("gives concurrent conflicting registrations one winner", async () => {
    const first = createService().service;
    const second = createService().service;
    const changed = createRegistration({ loginPublicKey: OTHER_LOGIN_PUBLIC_KEY });

    const results = await Promise.all([
      first.register(createRequest()),
      second.register(createRequest(changed)),
    ]);

    expect(results.filter(({ status }) => status === "registered")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "conflict")).toEqual([
      { status: "conflict", reason: "login_key_substitution" },
    ]);
  });

  it("survives restart without persisting raw proof or forbidden identity data", async () => {
    const first = createService();
    const registered = await first.service.register(createRequest());
    first.store.close();
    stores = stores.filter((store) => store !== first.store);

    const restarted = createService();
    await expect(restarted.service.register(createRequest())).resolves.toMatchObject({
      status: "existing",
      account: registered.status === "registered" ? registered.account : undefined,
    });
    restarted.store.close();
    stores = stores.filter((store) => store !== restarted.store);

    const text = (await readFile(databasePath)).toString("latin1");
    expect(text).not.toContain("identitySecret");
    expect(text).not.toContain("opaqueSubject");
    expect(text).not.toContain(createProof().points.join(","));
  });

  it("keeps different Stable Application IDs separate", async () => {
    const first = createService().service;
    const second = createService({ applicationId: OTHER_APPLICATION_ID }).service;
    const otherRegistration = createRegistration({ stableApplicationId: OTHER_APPLICATION_ID });

    const results = await Promise.all([
      first.register(createRequest()),
      second.register(createRequest(otherRegistration, createProof(otherRegistration), GROUP_ID)),
    ]);

    expect(results.every(({ status }) => status === "registered")).toBe(true);
    expect(
      new Set(
        results.flatMap((result) =>
          result.status === "registered" ? [result.account.accountId] : [],
        ),
      ).size,
    ).toBe(2);
  });

  it("does not let caller metadata alter account identity or proof scope", async () => {
    const { service } = createService();
    const first = await service.register(createRequest());
    const second = await service.register({
      ...createRequest(),
      wallet: "0xchanged",
      username: "changed",
      season: 2,
      attempt: 99,
    });

    expect(first.status).toBe("registered");
    expect(second).toEqual({ status: "rejected", reason: "malformed_request" });
    expect(REGISTRATION_NULLIFIER).toBe(createProof().nullifier);
  });
});
