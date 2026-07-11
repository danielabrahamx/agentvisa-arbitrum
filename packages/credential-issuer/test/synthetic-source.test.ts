import { hashEnrollmentAuthorizationV1, type EnrollmentSourcePolicyV1 } from "@agentvisa/policy";
import { keccak256, stringToHex } from "viem";
import { describe, expect, it } from "vitest";

import {
  createSyntheticUniquenessSource,
  deriveSyntheticOpaqueSubjectDigest,
} from "../src/index.js";

const SYNTHETIC_TEST_PRIVATE_KEY =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const policy: EnrollmentSourcePolicyV1 = {
  sourceId: keccak256(stringToHex("synthetic-source")),
  uniquenessDomain: keccak256(stringToHex("synthetic-domain")),
  credentialSchemaId: keccak256(stringToHex("agentvisa-semaphore-credential")),
  acceptedAssuranceIds: [keccak256(stringToHex("synthetic-assurance"))],
  maximumValiditySeconds: 300n,
};

describe("synthetic Uniqueness Source", () => {
  it("derives a stable opaque digest and signs the existing authorization digest", async () => {
    const source = createSyntheticUniquenessSource({
      privateKey: SYNTHETIC_TEST_PRIVATE_KEY,
      policy,
    });
    const signed = await source.authorize({
      opaqueSyntheticSubject: "synthetic-alex",
      semaphoreIdentityCommitment: 123n,
      issuedAt: 1_000n,
      expiresAt: 1_100n,
      nonce: keccak256(stringToHex("nonce-1")),
    });

    expect(signed.authorization.opaqueSubjectDigest).toBe(
      deriveSyntheticOpaqueSubjectDigest("synthetic-alex"),
    );
    expect(signed.authorization).toMatchObject({
      version: 1,
      sourceId: policy.sourceId,
      uniquenessDomain: policy.uniquenessDomain,
      credentialSchemaId: policy.credentialSchemaId,
      assuranceId: policy.acceptedAssuranceIds[0],
      semaphoreIdentityCommitment: 123n,
    });
    await expect(
      source.verifier.verify(hashEnrollmentAuthorizationV1(signed.authorization), signed.signature),
    ).resolves.toBe(true);
  });

  it("accepts an already-derived opaque subject digest", async () => {
    const source = createSyntheticUniquenessSource({
      privateKey: SYNTHETIC_TEST_PRIVATE_KEY,
      policy,
    });
    const opaqueSubjectDigest = keccak256(stringToHex("pre-derived-subject"));
    const signed = await source.authorize({
      opaqueSubjectDigest,
      semaphoreIdentityCommitment: 456n,
      issuedAt: 2_000n,
      expiresAt: 2_100n,
      nonce: keccak256(stringToHex("nonce-2")),
    });

    expect(signed.authorization.opaqueSubjectDigest).toBe(opaqueSubjectDigest);
  });

  it("rejects malformed subjects, policy ambiguity, and malformed signatures", async () => {
    expect(() =>
      createSyntheticUniquenessSource({
        privateKey: SYNTHETIC_TEST_PRIVATE_KEY,
        policy: { ...policy, acceptedAssuranceIds: [] },
      }),
    ).toThrow();

    const source = createSyntheticUniquenessSource({
      privateKey: SYNTHETIC_TEST_PRIVATE_KEY,
      policy,
    });
    await expect(
      source.authorize({
        opaqueSyntheticSubject: "",
        semaphoreIdentityCommitment: 789n,
        issuedAt: 3_000n,
        expiresAt: 3_100n,
        nonce: keccak256(stringToHex("nonce-3")),
      }),
    ).rejects.toThrow("opaque synthetic subject");
    await expect(source.verifier.verify(keccak256(stringToHex("digest")), "0x1234")).resolves.toBe(
      false,
    );
  });

  it("does not expose its injected signing key", () => {
    const source = createSyntheticUniquenessSource({
      privateKey: SYNTHETIC_TEST_PRIVATE_KEY,
      policy,
    });

    expect(JSON.stringify(source)).not.toContain(SYNTHETIC_TEST_PRIVATE_KEY.slice(2));
    expect(Object.keys(source)).not.toContain("privateKey");
    expect(Object.keys(source.verifier)).not.toContain("privateKey");
  });
});
