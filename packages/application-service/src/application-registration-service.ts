import { createHash, randomBytes } from "node:crypto";

import {
  SNARK_SCALAR_FIELD,
  deriveApplicationRegistrationV1,
  parseApplicationRegistrationV1,
  type ApplicationRegistrationV1,
} from "@agentvisa/policy";
import { verifyProof as standardVerifyProof } from "@semaphore-protocol/proof";
import type { Hex } from "viem";

import type {
  ApplicationRegistrationResult,
  ApplicationRegistrationServiceConfiguration,
  RegistrationProof,
  SessionAuthenticationResult,
  SessionCreationResult,
} from "./types.js";

interface StandardSemaphoreProof {
  readonly merkleTreeDepth: number;
  readonly merkleTreeRoot: string;
  readonly nullifier: string;
  readonly message: string;
  readonly scope: string;
  readonly points: readonly [string, string, string, string, string, string, string, string];
}

type StandardVerifyProof = (proof: StandardSemaphoreProof) => Promise<boolean>;
const verifyStandardProof = standardVerifyProof as StandardVerifyProof;

const REQUEST_FIELDS = new Set(["registration", "groupId", "proof"]);
const REGISTRATION_FIELDS = new Set(["version", "stableApplicationId", "loginPublicKey"]);
const PROOF_FIELDS = new Set([
  "merkleTreeDepth",
  "merkleTreeRoot",
  "nullifier",
  "message",
  "scope",
  "points",
]);

interface ParsedRegistrationRequest {
  readonly registration: ApplicationRegistrationV1;
  readonly groupId: Hex;
  readonly proof: RegistrationProof;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function requireBytes32(value: unknown, name: string): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new TypeError(`${name} must be bytes32`);
  }
  return value as Hex;
}

function requireFieldElement(value: unknown, name: string, allowZero = true): bigint {
  let parsed: bigint;
  if (typeof value === "bigint") {
    parsed = value;
  } else if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) {
    parsed = BigInt(value);
  } else {
    throw new TypeError(`${name} must be a canonical non-negative integer`);
  }
  if (parsed < 0n || parsed >= SNARK_SCALAR_FIELD || (!allowZero && parsed === 0n)) {
    throw new RangeError(`${name} is outside the BN254 scalar field`);
  }
  return parsed;
}

function parseProof(input: unknown): RegistrationProof {
  if (!isRecord(input) || !hasExactFields(input, PROOF_FIELDS)) {
    throw new TypeError("proof must contain only standard Semaphore fields");
  }
  if (
    typeof input.merkleTreeDepth !== "number" ||
    !Number.isInteger(input.merkleTreeDepth) ||
    input.merkleTreeDepth < 1 ||
    input.merkleTreeDepth > 32
  ) {
    throw new RangeError("proof depth is invalid");
  }
  if (!Array.isArray(input.points) || input.points.length !== 8) {
    throw new TypeError("proof points must contain eight field elements");
  }
  const points = input.points.map((point, index) =>
    requireFieldElement(point, `proof.points[${index}]`),
  ) as unknown as RegistrationProof["points"];

  return {
    merkleTreeDepth: input.merkleTreeDepth,
    merkleTreeRoot: requireFieldElement(input.merkleTreeRoot, "proof.merkleTreeRoot"),
    nullifier: requireFieldElement(input.nullifier, "proof.nullifier", false),
    message: requireFieldElement(input.message, "proof.message"),
    scope: requireFieldElement(input.scope, "proof.scope"),
    points,
  };
}

function parseRequest(input: unknown): ParsedRegistrationRequest {
  if (!isRecord(input) || !hasExactFields(input, REQUEST_FIELDS)) {
    throw new TypeError("registration request contains unexpected fields");
  }
  if (!isRecord(input.registration) || !hasExactFields(input.registration, REGISTRATION_FIELDS)) {
    throw new TypeError("registration contains unexpected fields");
  }
  return {
    registration: parseApplicationRegistrationV1(input.registration),
    groupId: requireBytes32(input.groupId, "groupId"),
    proof: parseProof(input.proof),
  };
}

function equalsHex(left: Hex, right: Hex): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function verifyWithStandardSemaphore(proof: RegistrationProof): Promise<boolean> {
  const standardProof: StandardSemaphoreProof = {
    merkleTreeDepth: proof.merkleTreeDepth,
    merkleTreeRoot: proof.merkleTreeRoot.toString(),
    nullifier: proof.nullifier.toString(),
    message: proof.message.toString(),
    scope: proof.scope.toString(),
    points: [
      proof.points[0].toString(),
      proof.points[1].toString(),
      proof.points[2].toString(),
      proof.points[3].toString(),
      proof.points[4].toString(),
      proof.points[5].toString(),
      proof.points[6].toString(),
      proof.points[7].toString(),
    ],
  };
  return verifyStandardProof(standardProof);
}

function tokenDigest(token: string): Hex {
  return `0x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

export class ApplicationRegistrationService {
  readonly #configuration: ApplicationRegistrationServiceConfiguration;

  constructor(configuration: ApplicationRegistrationServiceConfiguration) {
    requireBytes32(configuration.stableApplicationId, "stableApplicationId");
    requireBytes32(configuration.credentialGroupId, "credentialGroupId");
    this.#configuration = configuration;
  }

  async register(input: unknown): Promise<ApplicationRegistrationResult> {
    let request: ParsedRegistrationRequest;
    try {
      request = parseRequest(input);
    } catch {
      return { status: "rejected", reason: "malformed_request" };
    }

    const preflight = this.#validatePublicInputs(request);
    if (preflight !== undefined) {
      return preflight;
    }
    const rootStatus = this.#configuration.rootPolicy.classify(request.proof.merkleTreeRoot);
    if (rootStatus === "rejected") {
      return { status: "rejected", reason: "unaccepted_root" };
    }

    const verifier = this.#configuration.proofVerifier ?? verifyWithStandardSemaphore;
    try {
      if (!(await verifier(request.proof))) {
        return { status: "rejected", reason: "invalid_proof" };
      }
    } catch {
      return { status: "rejected", reason: "invalid_proof" };
    }

    try {
      return this.#configuration.store.registerAtomically({
        stableApplicationId: request.registration.stableApplicationId,
        registrationNullifier: request.proof.nullifier,
        loginPublicKey: request.registration.loginPublicKey,
        acceptedRoot: request.proof.merkleTreeRoot,
        rootStatus,
        createdAt: this.#configuration.currentTime(),
      });
    } catch {
      return { status: "rejected", reason: "store_unavailable" };
    }
  }

  async createSession(accountId: Hex, authentication: unknown): Promise<SessionCreationResult> {
    const account = this.#configuration.store.getAccount(accountId);
    if (account === undefined) {
      return { status: "rejected", reason: "unknown_account" };
    }
    if (account.status === "banned") {
      return { status: "rejected", reason: "banned" };
    }
    const authenticator = this.#configuration.loginKeyAuthenticator;
    if (
      authenticator === undefined ||
      !(await authenticator.authenticate(account.loginPublicKey, authentication))
    ) {
      return { status: "rejected", reason: "invalid_login" };
    }

    const token =
      this.#configuration.sessionTokenFactory?.() ?? randomBytes(32).toString("base64url");
    try {
      if (
        !this.#configuration.store.createSession(
          account.accountId,
          tokenDigest(token),
          this.#configuration.currentTime(),
        )
      ) {
        return { status: "rejected", reason: "banned" };
      }
      return { status: "created", token, account };
    } catch {
      return { status: "unavailable" };
    }
  }

  authenticateSession(token: string): SessionAuthenticationResult {
    const account = this.#configuration.store.authenticateSession(tokenDigest(token));
    if (account === undefined) {
      return { status: "rejected", reason: "invalid_session" };
    }
    return account.status === "banned"
      ? { status: "rejected", reason: "banned" }
      : { status: "authenticated", account };
  }

  banAccount(accountId: Hex): boolean {
    try {
      return this.#configuration.store.banAccount(accountId, this.#configuration.currentTime());
    } catch {
      return false;
    }
  }

  #validatePublicInputs(
    request: ParsedRegistrationRequest,
  ): ApplicationRegistrationResult | undefined {
    if (
      !equalsHex(request.registration.stableApplicationId, this.#configuration.stableApplicationId)
    ) {
      return { status: "rejected", reason: "wrong_application" };
    }
    if (!equalsHex(request.groupId, this.#configuration.credentialGroupId)) {
      return { status: "rejected", reason: "wrong_group" };
    }
    const expected = deriveApplicationRegistrationV1(request.registration);
    if (request.proof.message !== expected.message) {
      return { status: "rejected", reason: "wrong_message" };
    }
    if (request.proof.scope !== expected.scope) {
      return { status: "rejected", reason: "wrong_scope" };
    }
    return undefined;
  }
}
