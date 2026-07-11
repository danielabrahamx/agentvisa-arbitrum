import { describe, expect, it } from "vitest";

import {
  ENROLLMENT_AUTHORIZATION_V1_DOMAIN,
  hashEnrollmentAuthorizationV1,
  parseEnrollmentAuthorizationV1,
  validateEnrollmentAuthorizationV1ForSource,
  type EnrollmentAuthorizationV1,
  type EnrollmentSourcePolicyV1,
} from "../src/index.js";
import boundaryVector from "../vectors/enrollment-authorization-v1-boundary.json" with { type: "json" };
import malformedVectors from "../vectors/enrollment-authorization-v1-malformed.json" with { type: "json" };
import vector from "../vectors/enrollment-authorization-v1.json" with { type: "json" };

function authorizationFromVector(
  input: typeof vector.authorization | typeof boundaryVector.authorization,
): EnrollmentAuthorizationV1 {
  return {
    version: input.version as 1,
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

const authorization = authorizationFromVector(vector.authorization);
const policy: EnrollmentSourcePolicyV1 = {
  sourceId: authorization.sourceId,
  uniquenessDomain: authorization.uniquenessDomain,
  credentialSchemaId: authorization.credentialSchemaId,
  acceptedAssuranceIds: [authorization.assuranceId],
  maximumValiditySeconds: 3600n,
};

describe("Enrollment Authorization V1", () => {
  it("matches the published domain and normal signing digest", () => {
    expect(ENROLLMENT_AUTHORIZATION_V1_DOMAIN).toBe(vector.expected.domainSeparator);
    expect(hashEnrollmentAuthorizationV1(authorization)).toBe(vector.expected.signingDigest);
  });

  it("matches the published field and uint64 boundary vector", () => {
    expect(
      hashEnrollmentAuthorizationV1(authorizationFromVector(boundaryVector.authorization)),
    ).toBe(boundaryVector.expected.signingDigest);
  });

  it.each([
    ["sourceId", { sourceId: `0x${"a".repeat(64)}` }],
    ["uniquenessDomain", { uniquenessDomain: `0x${"a".repeat(64)}` }],
    ["opaqueSubjectDigest", { opaqueSubjectDigest: `0x${"a".repeat(64)}` }],
    ["credentialSchemaId", { credentialSchemaId: `0x${"a".repeat(64)}` }],
    ["assuranceId", { assuranceId: `0x${"a".repeat(64)}` }],
    ["semaphoreIdentityCommitment", { semaphoreIdentityCommitment: 42n }],
    ["issuedAt", { issuedAt: authorization.issuedAt + 1n }],
    ["expiresAt", { expiresAt: authorization.expiresAt + 1n }],
    ["nonce", { nonce: `0x${"a".repeat(64)}` }],
  ] as const)("binds %s", (_field, change) => {
    expect(hashEnrollmentAuthorizationV1({ ...authorization, ...change })).not.toBe(
      vector.expected.signingDigest,
    );
  });

  it("rejects unsupported versions and uses a versioned domain", () => {
    expect(ENROLLMENT_AUTHORIZATION_V1_DOMAIN).not.toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(() => hashEnrollmentAuthorizationV1({ ...authorization, version: 2 as 1 })).toThrow(
      "unsupported Enrollment Authorization version",
    );
  });

  it.each(malformedVectors.cases)("rejects malformed vector $name", ({ field, value, error }) => {
    const input: Record<string, unknown> = {
      ...vector.authorization,
      semaphoreIdentityCommitment: BigInt(vector.authorization.semaphoreIdentityCommitment),
      issuedAt: BigInt(vector.authorization.issuedAt),
      expiresAt: BigInt(vector.authorization.expiresAt),
    };
    input[field] =
      field === "semaphoreIdentityCommitment" || field === "issuedAt" || field === "expiresAt"
        ? BigInt(value)
        : value;

    expect(() => parseEnrollmentAuthorizationV1(input)).toThrow(error);
  });

  it("accepts an authorization under its configured source policy", () => {
    expect(
      validateEnrollmentAuthorizationV1ForSource(authorization, policy, authorization.issuedAt),
    ).toEqual(authorization);
  });

  it.each([
    ["source", { sourceId: `0x${"a".repeat(64)}` }],
    ["uniqueness domain", { uniquenessDomain: `0x${"a".repeat(64)}` }],
    ["Credential schema", { credentialSchemaId: `0x${"a".repeat(64)}` }],
    ["assurance", { acceptedAssuranceIds: [`0x${"a".repeat(64)}`] }],
  ] as const)("rejects the wrong configured %s", (_name, policyChange) => {
    expect(() =>
      validateEnrollmentAuthorizationV1ForSource(
        authorization,
        { ...policy, ...policyChange },
        authorization.issuedAt,
      ),
    ).toThrow();
  });

  it("rejects not-yet-valid, expired, and overlong authorizations", () => {
    expect(() =>
      validateEnrollmentAuthorizationV1ForSource(
        authorization,
        policy,
        authorization.issuedAt - 1n,
      ),
    ).toThrow("authorization is not yet valid");
    expect(() =>
      validateEnrollmentAuthorizationV1ForSource(authorization, policy, authorization.expiresAt),
    ).toThrow("authorization has expired");
    expect(() =>
      validateEnrollmentAuthorizationV1ForSource(
        authorization,
        { ...policy, maximumValiditySeconds: 3599n },
        authorization.issuedAt,
      ),
    ).toThrow("authorization validity exceeds source policy");
  });
});
