import type { ApplicationRegistrationV1 } from "@agentvisa/policy";
import type { Hex } from "viem";

export interface RegistrationProof {
  readonly merkleTreeDepth: number;
  readonly merkleTreeRoot: bigint;
  readonly nullifier: bigint;
  readonly message: bigint;
  readonly scope: bigint;
  readonly points: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
}

export type RegistrationProofScalar = bigint | string;

export interface RegistrationProofInput {
  readonly merkleTreeDepth: number;
  readonly merkleTreeRoot: RegistrationProofScalar;
  readonly nullifier: RegistrationProofScalar;
  readonly message: RegistrationProofScalar;
  readonly scope: RegistrationProofScalar;
  readonly points: readonly [
    RegistrationProofScalar,
    RegistrationProofScalar,
    RegistrationProofScalar,
    RegistrationProofScalar,
    RegistrationProofScalar,
    RegistrationProofScalar,
    RegistrationProofScalar,
    RegistrationProofScalar,
  ];
}

export interface ApplicationRegistrationRequest {
  readonly registration: ApplicationRegistrationV1;
  readonly groupId: Hex;
  readonly proof: RegistrationProofInput;
}

export type AccountStatus = "active" | "banned";
export type RootStatus = "current" | "historical";

export interface ApplicationAccount {
  readonly accountId: Hex;
  readonly stableApplicationId: Hex;
  readonly loginPublicKey: Hex;
  readonly status: AccountStatus;
  readonly createdAt: bigint;
  readonly updatedAt: bigint;
}

export type RegistrationRejectionReason =
  | "malformed_request"
  | "wrong_application"
  | "wrong_group"
  | "unaccepted_root"
  | "wrong_message"
  | "wrong_scope"
  | "invalid_proof"
  | "store_unavailable";

export type ApplicationRegistrationResult =
  | {
      readonly status: "registered" | "existing";
      readonly account: ApplicationAccount;
      readonly rootStatus: RootStatus;
    }
  | {
      readonly status: "conflict";
      readonly reason: "login_key_substitution";
    }
  | {
      readonly status: "rejected";
      readonly reason: RegistrationRejectionReason;
    };

export interface CredentialRootPolicy {
  classify(root: bigint): RootStatus | "rejected";
}

export type RegistrationProofVerifier = (proof: RegistrationProof) => Promise<boolean>;

export interface ApplicationRegistrationServiceConfiguration {
  readonly stableApplicationId: Hex;
  readonly credentialGroupId: Hex;
  readonly rootPolicy: CredentialRootPolicy;
  readonly proofVerifier?: RegistrationProofVerifier;
  readonly store: ApplicationStore;
  readonly currentTime: () => bigint;
  readonly sessionTokenFactory?: () => string;
  readonly loginKeyAuthenticator?: LoginKeyAuthenticator;
}

export interface AtomicRegistrationInput {
  readonly stableApplicationId: Hex;
  readonly registrationNullifier: bigint;
  readonly loginPublicKey: Hex;
  readonly acceptedRoot: bigint;
  readonly rootStatus: RootStatus;
  readonly createdAt: bigint;
}

export type AtomicRegistrationResult =
  | {
      readonly status: "registered" | "existing";
      readonly account: ApplicationAccount;
      readonly rootStatus: RootStatus;
    }
  | {
      readonly status: "conflict";
      readonly reason: "login_key_substitution";
    };

export interface LoginKeyAuthenticator {
  authenticate(loginPublicKey: Hex, authentication: unknown): Promise<boolean>;
}

export type SessionCreationResult =
  | { readonly status: "created"; readonly token: string; readonly account: ApplicationAccount }
  | { readonly status: "rejected"; readonly reason: "unknown_account" | "banned" | "invalid_login" }
  | { readonly status: "unavailable" };

export type SessionAuthenticationResult =
  | { readonly status: "authenticated"; readonly account: ApplicationAccount }
  | { readonly status: "rejected"; readonly reason: "invalid_session" | "banned" };

export interface RedactedAuditEvent {
  readonly eventType: "account_registered" | "session_created" | "account_banned";
  readonly stableApplicationId: Hex;
  readonly accountId: Hex;
  readonly occurredAt: bigint;
}

export interface ApplicationStore {
  registerAtomically(input: AtomicRegistrationInput): AtomicRegistrationResult;
  getAccount(accountId: Hex): ApplicationAccount | undefined;
  createSession(accountId: Hex, tokenDigest: Hex, createdAt: bigint): boolean;
  authenticateSession(tokenDigest: Hex): ApplicationAccount | undefined;
  banAccount(accountId: Hex, bannedAt: bigint): boolean;
  listAuditEvents(): readonly RedactedAuditEvent[];
}
