import {
  hashEnrollmentAuthorizationV1,
  SNARK_SCALAR_FIELD,
  type EnrollmentAuthorizationV1,
  type EnrollmentSourcePolicyV1,
} from "@agentvisa/policy";
import { keccak256, stringToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  createSyntheticUniquenessSource,
  type SignedEnrollmentAuthorizationV1,
  type SyntheticUniquenessSource,
} from "../src/index.js";

export const SYNTHETIC_TEST_PRIVATE_KEY =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const OTHER_SYNTHETIC_TEST_PRIVATE_KEY =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const GROUP_ID = keccak256(stringToHex("agentvisa-synthetic-group-v1"));

export const policy: EnrollmentSourcePolicyV1 = {
  sourceId: keccak256(stringToHex("synthetic-source")),
  uniquenessDomain: keccak256(stringToHex("synthetic-domain")),
  credentialSchemaId: keccak256(stringToHex("agentvisa-semaphore-credential")),
  acceptedAssuranceIds: [keccak256(stringToHex("synthetic-assurance"))],
  maximumValiditySeconds: 300n,
};

export function createSource(
  privateKey: Hex = SYNTHETIC_TEST_PRIVATE_KEY,
  sourcePolicy: EnrollmentSourcePolicyV1 = policy,
): SyntheticUniquenessSource {
  return createSyntheticUniquenessSource({ privateKey, policy: sourcePolicy });
}

export async function createSignedAuthorization(
  source: SyntheticUniquenessSource,
  changes: {
    readonly subject?: string;
    readonly commitment?: bigint;
    readonly issuedAt?: bigint;
    readonly expiresAt?: bigint;
    readonly nonce?: Hex;
  } = {},
): Promise<SignedEnrollmentAuthorizationV1> {
  return source.authorize({
    opaqueSyntheticSubject: changes.subject ?? "synthetic-alex",
    semaphoreIdentityCommitment: changes.commitment ?? 123n,
    issuedAt: changes.issuedAt ?? 1_000n,
    expiresAt: changes.expiresAt ?? 1_100n,
    nonce: changes.nonce ?? keccak256(stringToHex("nonce-1")),
  });
}

export function substituteAuthorization(
  signed: SignedEnrollmentAuthorizationV1,
  change: Partial<EnrollmentAuthorizationV1>,
): SignedEnrollmentAuthorizationV1 {
  return {
    ...signed,
    authorization: { ...signed.authorization, ...change },
  };
}

export async function signAuthorization(
  authorization: EnrollmentAuthorizationV1,
  privateKey: Hex = SYNTHETIC_TEST_PRIVATE_KEY,
): Promise<SignedEnrollmentAuthorizationV1> {
  const signature = await privateKeyToAccount(privateKey).sign({
    hash: hashEnrollmentAuthorizationV1(authorization),
  });
  return { authorization, signature };
}

export const invalidCommitments = [0n, SNARK_SCALAR_FIELD] as const;
