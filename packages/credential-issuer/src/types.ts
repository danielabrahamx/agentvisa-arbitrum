import type { EnrollmentAuthorizationV1, EnrollmentSourcePolicyV1 } from "@agentvisa/policy";
import type { Hex } from "viem";

export interface SignedEnrollmentAuthorizationV1 {
  readonly authorization: EnrollmentAuthorizationV1;
  readonly signature: Hex;
}

export interface EnrollmentSourceSignatureVerifier {
  readonly sourceId: Hex;
  verify(digest: Hex, signature: Hex): Promise<boolean>;
}

export interface AgentVisaSemaphoreCredential {
  readonly credentialId: Hex;
  readonly groupId: Hex;
  readonly semaphoreIdentityCommitment: bigint;
  readonly sourceId: Hex;
  readonly uniquenessDomain: Hex;
  readonly credentialSchemaId: Hex;
  readonly assuranceId: Hex;
  readonly authorizationDigest: Hex;
  readonly issuedAt: bigint;
  readonly membershipIndex: number;
}

export interface CredentialGroupSnapshot {
  readonly members: readonly bigint[];
  readonly root: bigint;
  readonly size: number;
}

export type IssuanceConflict = "nonce" | "subject" | "commitment";

export type IssuanceRejectionReason =
  | "malformed_request"
  | "malformed_authorization"
  | "source_policy"
  | "invalid_signature"
  | "store_unavailable";

export type CredentialIssuanceResult =
  | {
      readonly status: "issued" | "existing";
      readonly credential: AgentVisaSemaphoreCredential;
      readonly group: CredentialGroupSnapshot;
    }
  | {
      readonly status: "conflict";
      readonly conflict: IssuanceConflict;
    }
  | {
      readonly status: "rejected";
      readonly reason: IssuanceRejectionReason;
    };

export interface CredentialIssuerConfiguration {
  readonly sourcePolicy: EnrollmentSourcePolicyV1;
  readonly sourceVerifier: EnrollmentSourceSignatureVerifier;
  readonly groupId: Hex;
  readonly store: CredentialIssuanceStore;
  readonly currentTime: () => bigint;
}

export interface AtomicIssuanceInput {
  readonly authorization: EnrollmentAuthorizationV1;
  readonly authorizationDigest: Hex;
  readonly groupId: Hex;
  readonly consumedAt: bigint;
}

export interface CredentialIssuanceStore {
  findExisting(
    authorizationDigest: Hex,
  ): Extract<CredentialIssuanceResult, { readonly status: "issued" | "existing" }> | undefined;
  issueAtomically(input: AtomicIssuanceInput): CredentialIssuanceResult;
}
