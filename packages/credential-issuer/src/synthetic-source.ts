import {
  hashEnrollmentAuthorizationV1,
  parseEnrollmentAuthorizationV1,
  type EnrollmentAuthorizationV1,
  type EnrollmentSourcePolicyV1,
} from "@agentvisa/policy";
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  recoverAddress,
  stringToHex,
  type Hex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

import type {
  EnrollmentSourceSignatureVerifier,
  SignedEnrollmentAuthorizationV1,
} from "./types.js";

const SYNTHETIC_SUBJECT_DOMAIN = keccak256(stringToHex("agentvisa.synthetic-opaque-subject.v1"));

export type SyntheticSubjectInput =
  | {
      readonly opaqueSyntheticSubject: string;
      readonly opaqueSubjectDigest?: never;
    }
  | {
      readonly opaqueSyntheticSubject?: never;
      readonly opaqueSubjectDigest: Hex;
    };

export type SyntheticAuthorizationInput = SyntheticSubjectInput & {
  readonly semaphoreIdentityCommitment: bigint;
  readonly issuedAt: bigint;
  readonly expiresAt: bigint;
  readonly nonce: Hex;
};

export interface SyntheticUniquenessSourceConfiguration {
  readonly privateKey: Hex;
  readonly policy: EnrollmentSourcePolicyV1;
}

export interface SyntheticUniquenessSource {
  readonly verifier: EnrollmentSourceSignatureVerifier;
  authorize(input: SyntheticAuthorizationInput): Promise<SignedEnrollmentAuthorizationV1>;
}

export function deriveSyntheticOpaqueSubjectDigest(opaqueSyntheticSubject: string): Hex {
  if (
    opaqueSyntheticSubject.length === 0 ||
    opaqueSyntheticSubject.trim() !== opaqueSyntheticSubject ||
    opaqueSyntheticSubject.length > 256
  ) {
    throw new RangeError("opaque synthetic subject must be 1 to 256 trimmed characters");
  }

  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "string" }],
      [SYNTHETIC_SUBJECT_DOMAIN, opaqueSyntheticSubject],
    ),
  );
}

function createVerifier(sourceId: Hex, signerAddress: Hex): EnrollmentSourceSignatureVerifier {
  const expectedAddress = getAddress(signerAddress);

  return Object.freeze({
    sourceId,
    async verify(digest: Hex, signature: Hex): Promise<boolean> {
      try {
        const recoveredAddress = await recoverAddress({ hash: digest, signature });
        return getAddress(recoveredAddress) === expectedAddress;
      } catch {
        return false;
      }
    },
  });
}

class LocalSyntheticUniquenessSource implements SyntheticUniquenessSource {
  readonly verifier: EnrollmentSourceSignatureVerifier;
  readonly #account: PrivateKeyAccount;
  readonly #policy: EnrollmentSourcePolicyV1;

  constructor(configuration: SyntheticUniquenessSourceConfiguration) {
    if (configuration.policy.acceptedAssuranceIds.length === 0) {
      throw new RangeError("synthetic source policy must accept at least one assurance");
    }

    this.#account = privateKeyToAccount(configuration.privateKey);
    this.#policy = Object.freeze({
      ...configuration.policy,
      acceptedAssuranceIds: Object.freeze([...configuration.policy.acceptedAssuranceIds]),
    });
    this.verifier = createVerifier(configuration.policy.sourceId, this.#account.address);
  }

  async authorize(input: SyntheticAuthorizationInput): Promise<SignedEnrollmentAuthorizationV1> {
    const opaqueSubjectDigest =
      input.opaqueSubjectDigest ?? deriveSyntheticOpaqueSubjectDigest(input.opaqueSyntheticSubject);
    const assuranceId = this.#policy.acceptedAssuranceIds[0];

    if (assuranceId === undefined) {
      throw new RangeError("synthetic source policy must accept at least one assurance");
    }

    const authorization = parseEnrollmentAuthorizationV1({
      version: 1,
      sourceId: this.#policy.sourceId,
      uniquenessDomain: this.#policy.uniquenessDomain,
      opaqueSubjectDigest,
      credentialSchemaId: this.#policy.credentialSchemaId,
      assuranceId,
      semaphoreIdentityCommitment: input.semaphoreIdentityCommitment,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      nonce: input.nonce,
    } satisfies EnrollmentAuthorizationV1);
    const digest = hashEnrollmentAuthorizationV1(authorization);
    const signature = await this.#account.sign({ hash: digest });

    return Object.freeze({
      authorization: Object.freeze(authorization),
      signature,
    });
  }
}

export function createSyntheticUniquenessSource(
  configuration: SyntheticUniquenessSourceConfiguration,
): SyntheticUniquenessSource {
  return new LocalSyntheticUniquenessSource(configuration);
}
