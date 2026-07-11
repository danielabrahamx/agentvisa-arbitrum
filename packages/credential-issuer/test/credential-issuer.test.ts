import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashEnrollmentAuthorizationV1 } from "@agentvisa/policy";
import { keccak256, stringToHex } from "viem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CredentialIssuer, SqliteCredentialIssuanceStore } from "../src/index.js";
import {
  GROUP_ID,
  OTHER_SYNTHETIC_TEST_PRIVATE_KEY,
  createSignedAuthorization,
  createSource,
  invalidCommitments,
  policy,
  signAuthorization,
  substituteAuthorization,
} from "./fixtures.js";

describe("Credential Issuer", () => {
  let directory: string;
  let databasePath: string;
  let stores: SqliteCredentialIssuanceStore[];

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "agentvisa-issuer-"));
    databasePath = join(directory, "issuance.sqlite");
    stores = [];
  });

  afterEach(async () => {
    for (const store of stores) {
      store.close();
    }
    await rm(directory, { recursive: true, force: true });
  });

  function createIssuer(
    source = createSource(),
    path = databasePath,
  ): { issuer: CredentialIssuer; store: SqliteCredentialIssuanceStore } {
    const store = new SqliteCredentialIssuanceStore({ databasePath: path });
    stores.push(store);
    return {
      issuer: new CredentialIssuer({
        sourcePolicy: policy,
        sourceVerifier: source.verifier,
        groupId: GROUP_ID,
        store,
        currentTime: () => 1_050n,
      }),
      store,
    };
  }

  it("issues one AgentVisa Semaphore Credential for a valid synthetic authorization", async () => {
    const source = createSource();
    const signed = await createSignedAuthorization(source);
    const { issuer, store } = createIssuer(source);

    const result = await issuer.issue(signed);

    expect(result.status).toBe("issued");
    if (result.status !== "issued") {
      return;
    }
    expect(result.credential).toMatchObject({
      groupId: GROUP_ID,
      semaphoreIdentityCommitment: signed.authorization.semaphoreIdentityCommitment,
      sourceId: policy.sourceId,
      credentialSchemaId: policy.credentialSchemaId,
      assuranceId: policy.acceptedAssuranceIds[0],
      authorizationDigest: hashEnrollmentAuthorizationV1(signed.authorization),
      membershipIndex: 0,
    });
    const group = store.reconstructGroup(GROUP_ID);
    expect(group.members).toEqual([signed.authorization.semaphoreIdentityCommitment]);
    expect(result.group).toEqual({
      members: [signed.authorization.semaphoreIdentityCommitment],
      root: group.root,
      size: 1,
    });
  });

  it("returns the same authoritative Credential for an identical retry", async () => {
    const source = createSource();
    const signed = await createSignedAuthorization(source);
    const { issuer } = createIssuer(source);

    const first = await issuer.issue(signed);
    const retry = await issuer.issue(signed);

    expect(first.status).toBe("issued");
    expect(retry.status).toBe("existing");
    if (first.status === "issued" && retry.status === "existing") {
      expect(retry.credential).toEqual(first.credential);
      expect(retry.group).toEqual(first.group);
    }
  });

  it("returns an existing Credential for an authenticated identical retry after expiry", async () => {
    const source = createSource();
    const signed = await createSignedAuthorization(source);
    const { issuer, store } = createIssuer(source);
    expect((await issuer.issue(signed)).status).toBe("issued");
    const restarted = new CredentialIssuer({
      sourcePolicy: policy,
      sourceVerifier: source.verifier,
      groupId: GROUP_ID,
      store,
      currentTime: () => 1_101n,
    });

    await expect(restarted.issue(signed)).resolves.toMatchObject({
      status: "existing",
      credential: { authorizationDigest: hashEnrollmentAuthorizationV1(signed.authorization) },
    });
  });

  it.each([
    ["subject", { opaqueSubjectDigest: keccak256(stringToHex("other-subject")) }],
    ["commitment", { semaphoreIdentityCommitment: 456n }],
  ] as const)("rejects a replayed nonce with changed %s", async (_name, change) => {
    const source = createSource();
    const original = await createSignedAuthorization(source);
    const conflicting = substituteAuthorization(original, change);
    const resigned = await signAuthorization(conflicting.authorization);
    const { issuer } = createIssuer(source);

    expect((await issuer.issue(original)).status).toBe("issued");
    expect(await issuer.issue(resigned)).toMatchObject({
      status: "conflict",
      conflict: "nonce",
    });
  });

  it.each([
    ["nonce", { nonce: keccak256(stringToHex("nonce-2")) }],
    [
      "nonce and commitment",
      {
        nonce: keccak256(stringToHex("nonce-3")),
        semaphoreIdentityCommitment: 456n,
      },
    ],
  ] as const)("rejects a repeated opaque subject with changed %s", async (_name, change) => {
    const source = createSource();
    const original = await createSignedAuthorization(source);
    const changed = substituteAuthorization(original, change);
    const resigned = await signAuthorization(changed.authorization);
    const { issuer } = createIssuer(source);

    expect((await issuer.issue(original)).status).toBe("issued");
    expect(await issuer.issue(resigned)).toMatchObject({
      status: "conflict",
      conflict: "subject",
    });
  });

  it("rejects reuse of a commitment by another subject and nonce", async () => {
    const source = createSource();
    const original = await createSignedAuthorization(source);
    const changed = substituteAuthorization(original, {
      nonce: keccak256(stringToHex("nonce-4")),
      opaqueSubjectDigest: keccak256(stringToHex("other-subject")),
    });
    const resigned = await signAuthorization(changed.authorization);
    const { issuer } = createIssuer(source);

    expect((await issuer.issue(original)).status).toBe("issued");
    expect(await issuer.issue(resigned)).toMatchObject({
      status: "conflict",
      conflict: "commitment",
    });
  });

  it.each([
    ["expired", {}, 1_100n],
    ["not yet valid", {}, 999n],
    ["wrong source", { sourceId: keccak256(stringToHex("wrong-source")) }, 1_050n],
    ["wrong domain", { uniquenessDomain: keccak256(stringToHex("wrong-domain")) }, 1_050n],
    ["wrong schema", { credentialSchemaId: keccak256(stringToHex("wrong-schema")) }, 1_050n],
    ["wrong assurance", { assuranceId: keccak256(stringToHex("wrong-assurance")) }, 1_050n],
  ] as const)("rejects an authorization that is %s", async (_name, change, currentTime) => {
    const source = createSource();
    const original = await createSignedAuthorization(source);
    const changed = substituteAuthorization(original, change);
    const resigned = await signAuthorization(changed.authorization);
    const store = new SqliteCredentialIssuanceStore({ databasePath });
    stores.push(store);
    const issuer = new CredentialIssuer({
      sourcePolicy: policy,
      sourceVerifier: source.verifier,
      groupId: GROUP_ID,
      store,
      currentTime: () => currentTime,
    });

    await expect(issuer.issue(resigned)).resolves.toMatchObject({
      status: "rejected",
      reason: "source_policy",
    });
  });

  it("rejects wrong versions and identity-secret-shaped extra input at the boundary", async () => {
    const source = createSource();
    const signed = await createSignedAuthorization(source);
    const { issuer } = createIssuer(source);

    expect(
      await issuer.issue({
        ...signed,
        authorization: { ...signed.authorization, version: 2 },
      }),
    ).toMatchObject({ status: "rejected", reason: "malformed_authorization" });
    expect(
      await issuer.issue({
        ...signed,
        identitySecret: "must-not-enter-server-types",
      }),
    ).toMatchObject({ status: "rejected", reason: "malformed_request" });
  });

  it("rejects a wrong signer, malformed signature, and digest substitution", async () => {
    const source = createSource();
    const wrongSource = createSource(OTHER_SYNTHETIC_TEST_PRIVATE_KEY);
    const signed = await createSignedAuthorization(source);
    const wrongSignature = await createSignedAuthorization(wrongSource);
    const { issuer } = createIssuer(source);

    expect(await issuer.issue({ ...signed, signature: wrongSignature.signature })).toMatchObject({
      status: "rejected",
      reason: "invalid_signature",
    });
    expect(await issuer.issue({ ...signed, signature: "0x1234" })).toMatchObject({
      status: "rejected",
      reason: "invalid_signature",
    });
    expect(
      await issuer.issue(
        substituteAuthorization(signed, {
          semaphoreIdentityCommitment: 999n,
        }),
      ),
    ).toMatchObject({ status: "rejected", reason: "invalid_signature" });
  });

  it.each(invalidCommitments)("rejects commitment %s at the untrusted boundary", async (value) => {
    const source = createSource();
    const signed = await createSignedAuthorization(source);
    const { issuer } = createIssuer(source);

    expect(
      await issuer.issue(
        substituteAuthorization(signed, {
          semaphoreIdentityCommitment: value,
        }),
      ),
    ).toMatchObject({ status: "rejected", reason: "malformed_authorization" });
  });

  it("serializes concurrent identical requests to one Credential", async () => {
    const source = createSource();
    const signed = await createSignedAuthorization(source);
    const first = createIssuer(source).issuer;
    const second = createIssuer(source).issuer;

    const results = await Promise.all([first.issue(signed), second.issue(signed)]);

    expect(results.map(({ status }) => status).sort()).toEqual(["existing", "issued"]);
    const credentials = results.flatMap((result) =>
      result.status === "issued" || result.status === "existing" ? [result.credential] : [],
    );
    expect(credentials).toHaveLength(2);
    expect(credentials[0]).toEqual(credentials[1]);
  });

  it("gives concurrent conflicting requests one winner and one deterministic conflict", async () => {
    const source = createSource();
    const firstSigned = await createSignedAuthorization(source);
    const secondAuthorization = substituteAuthorization(firstSigned, {
      semaphoreIdentityCommitment: 456n,
    });
    const secondSigned = await signAuthorization(secondAuthorization.authorization);
    const first = createIssuer(source).issuer;
    const second = createIssuer(source).issuer;

    const results = await Promise.all([first.issue(firstSigned), second.issue(secondSigned)]);

    expect(results.filter(({ status }) => status === "issued")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "conflict")).toEqual([
      expect.objectContaining({ conflict: "nonce" }),
    ]);
  });

  it("survives restart and reconstructs the standard Semaphore group deterministically", async () => {
    const source = createSource();
    const firstSigned = await createSignedAuthorization(source);
    const secondSigned = await createSignedAuthorization(source, {
      subject: "synthetic-blair",
      commitment: 456n,
      nonce: keccak256(stringToHex("nonce-2")),
    });
    const { issuer, store } = createIssuer(source);
    const firstResult = await issuer.issue(firstSigned);
    const secondResult = await issuer.issue(secondSigned);
    const rootBeforeRestart = store.reconstructGroup(GROUP_ID).root;
    store.close();
    stores = stores.filter((candidate) => candidate !== store);

    const restarted = createIssuer(source);
    const groupAfterRestart = restarted.store.reconstructGroup(GROUP_ID);
    const retry = await restarted.issuer.issue(firstSigned);

    expect(firstResult.status).toBe("issued");
    expect(secondResult.status).toBe("issued");
    expect(groupAfterRestart.members).toEqual([123n, 456n]);
    expect(groupAfterRestart.root).toBe(rootBeforeRestart);
    expect(restarted.store.getGroupSnapshot(GROUP_ID)).toEqual({
      members: [123n, 456n],
      root: rootBeforeRestart,
      size: 2,
    });
    expect(retry.status).toBe("existing");
  });

  it("does not persist source signatures or identity-secret-shaped data", async () => {
    const source = createSource();
    const signed = await createSignedAuthorization(source);
    const { issuer, store } = createIssuer(source);
    expect((await issuer.issue(signed)).status).toBe("issued");
    store.close();
    stores = stores.filter((candidate) => candidate !== store);

    const databaseBytes = await readFile(databasePath);
    const databaseText = databaseBytes.toString("latin1");
    expect(databaseText).not.toContain(signed.signature.slice(2));
    expect(databaseText).not.toContain("must-not-enter-server-types");
  });
});
