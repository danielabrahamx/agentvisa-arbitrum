import { DatabaseSync } from "node:sqlite";

import { Group } from "@semaphore-protocol/group";
import { encodeAbiParameters, keccak256, stringToHex, type Hex } from "viem";

import type {
  AgentVisaSemaphoreCredential,
  AtomicIssuanceInput,
  CredentialIssuanceResult,
  CredentialIssuanceStore,
} from "./types.js";

const CREDENTIAL_ID_DOMAIN = keccak256(stringToHex("agentvisa.semaphore-credential-id.v1"));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS enrollment_authorizations (
  authorization_digest TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  uniqueness_domain TEXT NOT NULL,
  opaque_subject_digest TEXT NOT NULL,
  credential_schema_id TEXT NOT NULL,
  assurance_id TEXT NOT NULL,
  identity_commitment TEXT NOT NULL,
  nonce TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  UNIQUE (source_id, nonce),
  UNIQUE (source_id, uniqueness_domain, opaque_subject_digest)
) STRICT;

CREATE TABLE IF NOT EXISTS credentials (
  credential_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  identity_commitment TEXT NOT NULL,
  source_id TEXT NOT NULL,
  uniqueness_domain TEXT NOT NULL,
  credential_schema_id TEXT NOT NULL,
  assurance_id TEXT NOT NULL,
  authorization_digest TEXT NOT NULL UNIQUE
    REFERENCES enrollment_authorizations(authorization_digest),
  issued_at TEXT NOT NULL,
  membership_index INTEGER NOT NULL CHECK (membership_index >= 0),
  UNIQUE (group_id, identity_commitment),
  UNIQUE (group_id, membership_index)
) STRICT;

CREATE TABLE IF NOT EXISTS group_memberships (
  group_id TEXT NOT NULL,
  leaf_index INTEGER NOT NULL CHECK (leaf_index >= 0),
  identity_commitment TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE REFERENCES credentials(credential_id),
  PRIMARY KEY (group_id, leaf_index),
  UNIQUE (group_id, identity_commitment)
) STRICT;
`;

interface SqliteCredentialIssuanceStoreConfiguration {
  readonly databasePath: string;
}

interface CredentialRow {
  readonly credentialId: string;
  readonly groupId: string;
  readonly identityCommitment: string;
  readonly sourceId: string;
  readonly uniquenessDomain: string;
  readonly credentialSchemaId: string;
  readonly assuranceId: string;
  readonly authorizationDigest: string;
  readonly issuedAt: string;
  readonly membershipIndex: number;
}

interface MembershipRow {
  readonly identityCommitment: string;
}

interface CountRow {
  readonly count: number;
}

function normalizeHex(value: Hex): string {
  return value.toLowerCase();
}

function deriveCredentialId(groupId: Hex, authorizationDigest: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      [CREDENTIAL_ID_DOMAIN, groupId, authorizationDigest],
    ),
  );
}

function rowToCredential(row: CredentialRow): AgentVisaSemaphoreCredential {
  return {
    credentialId: row.credentialId as Hex,
    groupId: row.groupId as Hex,
    semaphoreIdentityCommitment: BigInt(row.identityCommitment),
    sourceId: row.sourceId as Hex,
    uniquenessDomain: row.uniquenessDomain as Hex,
    credentialSchemaId: row.credentialSchemaId as Hex,
    assuranceId: row.assuranceId as Hex,
    authorizationDigest: row.authorizationDigest as Hex,
    issuedAt: BigInt(row.issuedAt),
    membershipIndex: row.membershipIndex,
  };
}

export class SqliteCredentialIssuanceStore implements CredentialIssuanceStore {
  readonly #database: DatabaseSync;
  #isClosed = false;

  constructor(configuration: SqliteCredentialIssuanceStoreConfiguration) {
    this.#database = new DatabaseSync(configuration.databasePath, {
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      allowExtension: false,
    });
    this.#database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    this.#database.exec(SCHEMA);
  }

  findExisting(
    authorizationDigest: Hex,
  ): Extract<CredentialIssuanceResult, { readonly status: "issued" | "existing" }> | undefined {
    const credential = this.#findCredentialByAuthorizationDigest(normalizeHex(authorizationDigest));
    return credential === undefined ? undefined : this.#credentialResult("existing", credential);
  }

  issueAtomically(input: AtomicIssuanceInput): CredentialIssuanceResult {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.#issueInsideTransaction(input);
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  reconstructGroup(groupId: Hex): Group {
    const rows = this.#database
      .prepare(
        `SELECT identity_commitment AS identityCommitment
         FROM group_memberships
         WHERE group_id = ?
         ORDER BY leaf_index ASC`,
      )
      .all(normalizeHex(groupId)) as unknown as MembershipRow[];

    return new Group(rows.map((row) => BigInt(row.identityCommitment)));
  }

  getGroupSnapshot(groupId: Hex): {
    readonly members: readonly bigint[];
    readonly root: bigint;
    readonly size: number;
  } {
    const group = this.reconstructGroup(groupId);
    return Object.freeze({
      members: Object.freeze([...group.members]),
      root: group.root,
      size: group.size,
    });
  }

  close(): void {
    if (!this.#isClosed) {
      this.#database.close();
      this.#isClosed = true;
    }
  }

  #issueInsideTransaction(input: AtomicIssuanceInput): CredentialIssuanceResult {
    const sourceId = normalizeHex(input.authorization.sourceId);
    const authorizationDigest = normalizeHex(input.authorizationDigest);
    const existing = this.#findCredentialByAuthorizationDigest(authorizationDigest);
    if (existing !== undefined) {
      return this.#credentialResult("existing", existing);
    }

    const nonceOwner = this.#database
      .prepare(
        `SELECT authorization_digest
         FROM enrollment_authorizations
         WHERE source_id = ? AND nonce = ?`,
      )
      .get(sourceId, normalizeHex(input.authorization.nonce));
    if (nonceOwner !== undefined) {
      return { status: "conflict", conflict: "nonce" };
    }

    const subjectOwner = this.#database
      .prepare(
        `SELECT authorization_digest
         FROM enrollment_authorizations
         WHERE source_id = ?
           AND uniqueness_domain = ?
           AND opaque_subject_digest = ?`,
      )
      .get(
        sourceId,
        normalizeHex(input.authorization.uniquenessDomain),
        normalizeHex(input.authorization.opaqueSubjectDigest),
      );
    if (subjectOwner !== undefined) {
      return { status: "conflict", conflict: "subject" };
    }

    const groupId = normalizeHex(input.groupId);
    const identityCommitment = input.authorization.semaphoreIdentityCommitment.toString();
    const commitmentOwner = this.#database
      .prepare(
        `SELECT credential_id
         FROM credentials
         WHERE group_id = ? AND identity_commitment = ?`,
      )
      .get(groupId, identityCommitment);
    if (commitmentOwner !== undefined) {
      return { status: "conflict", conflict: "commitment" };
    }

    const countRow = this.#database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM group_memberships
         WHERE group_id = ?`,
      )
      .get(groupId) as unknown as CountRow;
    const membershipIndex = countRow.count;
    const credentialId = normalizeHex(deriveCredentialId(input.groupId, input.authorizationDigest));

    this.#database
      .prepare(
        `INSERT INTO enrollment_authorizations (
           authorization_digest, source_id, uniqueness_domain,
           opaque_subject_digest, credential_schema_id, assurance_id,
           identity_commitment, nonce, issued_at, expires_at, consumed_at,
           credential_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        authorizationDigest,
        sourceId,
        normalizeHex(input.authorization.uniquenessDomain),
        normalizeHex(input.authorization.opaqueSubjectDigest),
        normalizeHex(input.authorization.credentialSchemaId),
        normalizeHex(input.authorization.assuranceId),
        identityCommitment,
        normalizeHex(input.authorization.nonce),
        input.authorization.issuedAt.toString(),
        input.authorization.expiresAt.toString(),
        input.consumedAt.toString(),
        credentialId,
      );

    this.#database
      .prepare(
        `INSERT INTO credentials (
           credential_id, group_id, identity_commitment, source_id,
           uniqueness_domain, credential_schema_id, assurance_id,
           authorization_digest, issued_at, membership_index
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        credentialId,
        groupId,
        identityCommitment,
        sourceId,
        normalizeHex(input.authorization.uniquenessDomain),
        normalizeHex(input.authorization.credentialSchemaId),
        normalizeHex(input.authorization.assuranceId),
        authorizationDigest,
        input.consumedAt.toString(),
        membershipIndex,
      );

    this.#database
      .prepare(
        `INSERT INTO group_memberships (
           group_id, leaf_index, identity_commitment, credential_id
         ) VALUES (?, ?, ?, ?)`,
      )
      .run(groupId, membershipIndex, identityCommitment, credentialId);

    const credential = this.#findCredentialByAuthorizationDigest(authorizationDigest);
    if (credential === undefined) {
      throw new Error("atomic issuance did not create a Credential");
    }
    return this.#credentialResult("issued", credential);
  }

  #findCredentialByAuthorizationDigest(
    authorizationDigest: string,
  ): AgentVisaSemaphoreCredential | undefined {
    const row = this.#database
      .prepare(
        `SELECT
           credential_id AS credentialId,
           group_id AS groupId,
           identity_commitment AS identityCommitment,
           source_id AS sourceId,
           uniqueness_domain AS uniquenessDomain,
           credential_schema_id AS credentialSchemaId,
           assurance_id AS assuranceId,
           authorization_digest AS authorizationDigest,
           issued_at AS issuedAt,
           membership_index AS membershipIndex
         FROM credentials
         WHERE authorization_digest = ?`,
      )
      .get(authorizationDigest) as unknown as CredentialRow | undefined;

    return row === undefined ? undefined : rowToCredential(row);
  }

  #credentialResult(
    status: "issued" | "existing",
    credential: AgentVisaSemaphoreCredential,
  ): Extract<CredentialIssuanceResult, { readonly status: "issued" | "existing" }> {
    const group = this.getGroupSnapshot(credential.groupId);
    return {
      status,
      credential,
      group,
    };
  }
}
