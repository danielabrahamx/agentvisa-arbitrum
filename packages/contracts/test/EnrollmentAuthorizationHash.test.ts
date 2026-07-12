import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  ENROLLMENT_AUTHORIZATION_V1_DOMAIN,
  hashEnrollmentAuthorizationV1,
  type EnrollmentAuthorizationV1,
} from "@agentvisa/policy";
import hre from "hardhat";

interface GoldenVector {
  readonly authorization: {
    readonly sourceId: string;
    readonly uniquenessDomain: string;
    readonly opaqueSubjectDigest: string;
    readonly credentialSchemaId: string;
    readonly assuranceId: string;
    readonly semaphoreIdentityCommitment: string;
    readonly issuedAt: string;
    readonly expiresAt: string;
    readonly nonce: string;
  };
  readonly expected: {
    readonly domainSeparator: `0x${string}`;
    readonly signingDigest: `0x${string}`;
  };
}

function authorizationFromVector(input: GoldenVector["authorization"]): EnrollmentAuthorizationV1 {
  return {
    version: 1,
    sourceId: input.sourceId as EnrollmentAuthorizationV1["sourceId"],
    uniquenessDomain: input.uniquenessDomain as EnrollmentAuthorizationV1["uniquenessDomain"],
    opaqueSubjectDigest:
      input.opaqueSubjectDigest as EnrollmentAuthorizationV1["opaqueSubjectDigest"],
    credentialSchemaId: input.credentialSchemaId as EnrollmentAuthorizationV1["credentialSchemaId"],
    assuranceId: input.assuranceId as EnrollmentAuthorizationV1["assuranceId"],
    semaphoreIdentityCommitment: BigInt(input.semaphoreIdentityCommitment),
    issuedAt: BigInt(input.issuedAt),
    expiresAt: BigInt(input.expiresAt),
    nonce: input.nonce as EnrollmentAuthorizationV1["nonce"],
  };
}

function loadVector(): GoldenVector {
  const path = resolve(
    import.meta.dirname,
    "../../policy/vectors/enrollment-authorization-v1.json",
  );
  return JSON.parse(readFileSync(path, "utf8")) as GoldenVector;
}

void describe("EnrollmentAuthorizationHash", () => {
  void it("matches the TypeScript domain separator golden vector", () => {
    assert.equal(ENROLLMENT_AUTHORIZATION_V1_DOMAIN, loadVector().expected.domainSeparator);
  });

  void it("matches the TypeScript signing digest golden vector", async () => {
    const vector = loadVector();
    const authorization = authorizationFromVector(vector.authorization);
    assert.equal(hashEnrollmentAuthorizationV1(authorization), vector.expected.signingDigest);

    const { viem } = await hre.network.create();
    const hash = await viem.deployContract("EnrollmentAuthorizationHashHarness");
    const onChainDigest = (await hash.read.hashDigest!([
      {
        version: 1,
        sourceId: authorization.sourceId,
        uniquenessDomain: authorization.uniquenessDomain,
        opaqueSubjectDigest: authorization.opaqueSubjectDigest,
        credentialSchemaId: authorization.credentialSchemaId,
        assuranceId: authorization.assuranceId,
        semaphoreIdentityCommitment: authorization.semaphoreIdentityCommitment,
        issuedAt: authorization.issuedAt,
        expiresAt: authorization.expiresAt,
        nonce: authorization.nonce,
      },
    ])) as `0x${string}`;
    assert.equal(onChainDigest.toLowerCase(), vector.expected.signingDigest.toLowerCase());
  });
});
