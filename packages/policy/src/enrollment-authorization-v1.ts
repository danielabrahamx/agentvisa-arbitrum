import { encodeAbiParameters, keccak256, stringToHex, type Hex } from "viem";

import { SNARK_SCALAR_FIELD } from "./field.js";
import {
  requireNonzeroBytes32,
  requireRecord,
  requireUint,
  requireVersionOne,
} from "./fixed-width.js";

export const ENROLLMENT_AUTHORIZATION_V1_DOMAIN_TEXT = "agentvisa.enrollment-authorization.v1";
export const ENROLLMENT_AUTHORIZATION_V1_DOMAIN = keccak256(
  stringToHex(ENROLLMENT_AUTHORIZATION_V1_DOMAIN_TEXT),
);

export interface EnrollmentAuthorizationV1 {
  readonly version: 1;
  readonly sourceId: Hex;
  readonly uniquenessDomain: Hex;
  readonly opaqueSubjectDigest: Hex;
  readonly credentialSchemaId: Hex;
  readonly assuranceId: Hex;
  readonly semaphoreIdentityCommitment: bigint;
  readonly issuedAt: bigint;
  readonly expiresAt: bigint;
  readonly nonce: Hex;
}

export interface EnrollmentSourcePolicyV1 {
  readonly sourceId: Hex;
  readonly uniquenessDomain: Hex;
  readonly credentialSchemaId: Hex;
  readonly acceptedAssuranceIds: readonly Hex[];
  readonly maximumValiditySeconds: bigint;
}

function requireIdentityCommitment(value: unknown): bigint {
  if (typeof value !== "bigint" || value <= 0n || value >= SNARK_SCALAR_FIELD) {
    throw new RangeError("semaphoreIdentityCommitment must be inside the BN254 scalar field");
  }

  return value;
}

export function parseEnrollmentAuthorizationV1(input: unknown): EnrollmentAuthorizationV1 {
  const value = requireRecord(input, "Enrollment Authorization");
  const issuedAt = requireUint(value.issuedAt, 64, "issuedAt");
  const expiresAt = requireUint(value.expiresAt, 64, "expiresAt");

  if (expiresAt <= issuedAt) {
    throw new RangeError("expiresAt must be later than issuedAt");
  }

  return {
    version: requireVersionOne(value.version, "Enrollment Authorization"),
    sourceId: requireNonzeroBytes32(value.sourceId, "sourceId"),
    uniquenessDomain: requireNonzeroBytes32(value.uniquenessDomain, "uniquenessDomain"),
    opaqueSubjectDigest: requireNonzeroBytes32(value.opaqueSubjectDigest, "opaqueSubjectDigest"),
    credentialSchemaId: requireNonzeroBytes32(value.credentialSchemaId, "credentialSchemaId"),
    assuranceId: requireNonzeroBytes32(value.assuranceId, "assuranceId"),
    semaphoreIdentityCommitment: requireIdentityCommitment(value.semaphoreIdentityCommitment),
    issuedAt,
    expiresAt,
    nonce: requireNonzeroBytes32(value.nonce, "nonce"),
  };
}

export function hashEnrollmentAuthorizationV1(input: EnrollmentAuthorizationV1): Hex {
  const authorization = parseEnrollmentAuthorizationV1(input);

  // ABI encoding gives every fixed-width value its own slot and prevents
  // concatenation ambiguity across source-controlled inputs.
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint8" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint64" },
        { type: "uint64" },
        { type: "bytes32" },
      ],
      [
        ENROLLMENT_AUTHORIZATION_V1_DOMAIN,
        authorization.version,
        authorization.sourceId,
        authorization.uniquenessDomain,
        authorization.opaqueSubjectDigest,
        authorization.credentialSchemaId,
        authorization.assuranceId,
        authorization.semaphoreIdentityCommitment,
        authorization.issuedAt,
        authorization.expiresAt,
        authorization.nonce,
      ],
    ),
  );
}

function equalsHex(left: Hex, right: Hex): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function parseSourcePolicy(policy: EnrollmentSourcePolicyV1): EnrollmentSourcePolicyV1 {
  const acceptedAssuranceIds = policy.acceptedAssuranceIds.map((assuranceId) =>
    requireNonzeroBytes32(assuranceId, "acceptedAssuranceIds"),
  );
  const maximumValiditySeconds = requireUint(
    policy.maximumValiditySeconds,
    64,
    "maximumValiditySeconds",
  );

  if (acceptedAssuranceIds.length === 0) {
    throw new RangeError("acceptedAssuranceIds must not be empty");
  }
  if (maximumValiditySeconds === 0n) {
    throw new RangeError("maximumValiditySeconds must be greater than zero");
  }

  return {
    sourceId: requireNonzeroBytes32(policy.sourceId, "policy.sourceId"),
    uniquenessDomain: requireNonzeroBytes32(policy.uniquenessDomain, "policy.uniquenessDomain"),
    credentialSchemaId: requireNonzeroBytes32(
      policy.credentialSchemaId,
      "policy.credentialSchemaId",
    ),
    acceptedAssuranceIds,
    maximumValiditySeconds,
  };
}

export function validateEnrollmentAuthorizationV1ForSource(
  input: EnrollmentAuthorizationV1,
  inputPolicy: EnrollmentSourcePolicyV1,
  currentTime: bigint,
): EnrollmentAuthorizationV1 {
  const authorization = parseEnrollmentAuthorizationV1(input);
  const policy = parseSourcePolicy(inputPolicy);
  const now = requireUint(currentTime, 64, "currentTime");

  if (!equalsHex(authorization.sourceId, policy.sourceId)) {
    throw new RangeError("authorization source is not accepted");
  }
  if (!equalsHex(authorization.uniquenessDomain, policy.uniquenessDomain)) {
    throw new RangeError("authorization uniqueness domain is not accepted");
  }
  if (!equalsHex(authorization.credentialSchemaId, policy.credentialSchemaId)) {
    throw new RangeError("authorization Credential schema is not accepted");
  }
  if (
    !policy.acceptedAssuranceIds.some((assuranceId) =>
      equalsHex(authorization.assuranceId, assuranceId),
    )
  ) {
    throw new RangeError("authorization assurance is not accepted");
  }
  if (authorization.expiresAt - authorization.issuedAt > policy.maximumValiditySeconds) {
    throw new RangeError("authorization validity exceeds source policy");
  }
  if (authorization.issuedAt > now) {
    throw new RangeError("authorization is not yet valid");
  }
  if (authorization.expiresAt <= now) {
    throw new RangeError("authorization has expired");
  }

  return authorization;
}
