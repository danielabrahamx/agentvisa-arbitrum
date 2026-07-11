import {
  hashEnrollmentAuthorizationV1,
  parseEnrollmentAuthorizationV1,
  validateEnrollmentAuthorizationV1ForSource,
  type EnrollmentAuthorizationV1,
} from "@agentvisa/policy";
import type { Hex } from "viem";

import type {
  CredentialIssuanceResult,
  CredentialIssuerConfiguration,
  SignedEnrollmentAuthorizationV1,
} from "./types.js";

const AUTHORIZATION_FIELDS = new Set([
  "version",
  "sourceId",
  "uniquenessDomain",
  "opaqueSubjectDigest",
  "credentialSchemaId",
  "assuranceId",
  "semaphoreIdentityCommitment",
  "issuedAt",
  "expiresAt",
  "nonce",
]);

function hasOnlyFields(value: Record<string, unknown>, fields: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => fields.has(key));
}

function parseRequest(input: unknown): SignedEnrollmentAuthorizationV1 {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Credential issuance request must be an object");
  }

  const request = input as Record<string, unknown>;
  if (
    !hasOnlyFields(request, new Set(["authorization", "signature"])) ||
    Object.keys(request).length !== 2
  ) {
    throw new TypeError("Credential issuance request contains unexpected fields");
  }
  if (
    typeof request.authorization !== "object" ||
    request.authorization === null ||
    Array.isArray(request.authorization) ||
    !hasOnlyFields(request.authorization as Record<string, unknown>, AUTHORIZATION_FIELDS)
  ) {
    throw new TypeError("Enrollment Authorization contains unexpected fields");
  }
  if (typeof request.signature !== "string" || !/^0x[0-9a-fA-F]*$/.test(request.signature)) {
    throw new RangeError("source signature must be hexadecimal");
  }

  return {
    authorization: request.authorization as EnrollmentAuthorizationV1,
    signature: request.signature as Hex,
  };
}

function equalsHex(left: Hex, right: Hex): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function requireBytes32(value: Hex, name: string): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value) || /^0x0{64}$/i.test(value)) {
    throw new RangeError(`${name} must be a nonzero bytes32 value`);
  }
  return value;
}

export class CredentialIssuer {
  readonly #configuration: CredentialIssuerConfiguration;

  constructor(configuration: CredentialIssuerConfiguration) {
    requireBytes32(configuration.groupId, "groupId");
    if (!equalsHex(configuration.sourcePolicy.sourceId, configuration.sourceVerifier.sourceId)) {
      throw new RangeError("source verifier does not match source policy");
    }
    this.#configuration = configuration;
  }

  async issue(input: unknown): Promise<CredentialIssuanceResult> {
    let request: SignedEnrollmentAuthorizationV1;
    try {
      request = parseRequest(input);
    } catch {
      return { status: "rejected", reason: "malformed_request" };
    }

    let authorization: EnrollmentAuthorizationV1;
    try {
      authorization = parseEnrollmentAuthorizationV1(request.authorization);
    } catch {
      return { status: "rejected", reason: "malformed_authorization" };
    }

    const authorizationDigest = hashEnrollmentAuthorizationV1(authorization);
    if (
      !(await this.#configuration.sourceVerifier.verify(authorizationDigest, request.signature))
    ) {
      return { status: "rejected", reason: "invalid_signature" };
    }

    try {
      const existing = this.#configuration.store.findExisting(authorizationDigest);
      if (existing !== undefined) return existing;
    } catch {
      return { status: "rejected", reason: "store_unavailable" };
    }

    const currentTime = this.#configuration.currentTime();
    try {
      authorization = validateEnrollmentAuthorizationV1ForSource(
        authorization,
        this.#configuration.sourcePolicy,
        currentTime,
      );
    } catch {
      return { status: "rejected", reason: "source_policy" };
    }

    try {
      return this.#configuration.store.issueAtomically({
        authorization,
        authorizationDigest,
        groupId: this.#configuration.groupId,
        consumedAt: currentTime,
      });
    } catch {
      return { status: "rejected", reason: "store_unavailable" };
    }
  }
}
