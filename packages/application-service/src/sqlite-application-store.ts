import { DatabaseSync } from "node:sqlite";

import { encodeAbiParameters, keccak256, stringToHex, type Hex } from "viem";

import type {
  ApplicationAccount,
  ApplicationStore,
  AtomicRegistrationInput,
  AtomicRegistrationResult,
  RedactedAuditEvent,
} from "./types.js";

const ACCOUNT_ID_DOMAIN = keccak256(stringToHex("agentvisa.application-account-id.v1"));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS application_accounts (
  account_id TEXT PRIMARY KEY,
  stable_application_id TEXT NOT NULL,
  registration_nullifier TEXT NOT NULL,
  login_public_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'banned')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (stable_application_id, registration_nullifier)
) STRICT;

CREATE TABLE IF NOT EXISTS application_sessions (
  token_digest TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES application_accounts(account_id),
  created_at TEXT NOT NULL,
  is_valid INTEGER NOT NULL CHECK (is_valid IN (0, 1))
) STRICT;

CREATE INDEX IF NOT EXISTS application_sessions_account
  ON application_sessions (account_id);

CREATE TABLE IF NOT EXISTS audit_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('account_registered', 'session_created', 'account_banned')
  ),
  stable_application_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL
) STRICT;
`;

interface SqliteApplicationStoreConfiguration {
  readonly databasePath: string;
}

interface AccountRow {
  readonly accountId: string;
  readonly stableApplicationId: string;
  readonly loginPublicKey: string;
  readonly status: "active" | "banned";
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AuditRow {
  readonly eventType: RedactedAuditEvent["eventType"];
  readonly stableApplicationId: string;
  readonly accountId: string;
  readonly occurredAt: string;
}

function normalizeHex(value: Hex): Hex {
  return value.toLowerCase() as Hex;
}

function rowToAccount(row: AccountRow): ApplicationAccount {
  return {
    accountId: row.accountId as Hex,
    stableApplicationId: row.stableApplicationId as Hex,
    loginPublicKey: row.loginPublicKey as Hex,
    status: row.status,
    createdAt: BigInt(row.createdAt),
    updatedAt: BigInt(row.updatedAt),
  };
}

function deriveAccountId(stableApplicationId: Hex, registrationNullifier: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
      [ACCOUNT_ID_DOMAIN, stableApplicationId, registrationNullifier],
    ),
  );
}

export class SqliteApplicationStore implements ApplicationStore {
  readonly #database: DatabaseSync;
  #isClosed = false;

  constructor(configuration: SqliteApplicationStoreConfiguration) {
    this.#database = new DatabaseSync(configuration.databasePath, {
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      allowExtension: false,
    });
    this.#database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    this.#database.exec(SCHEMA);
  }

  registerAtomically(input: AtomicRegistrationInput): AtomicRegistrationResult {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.#findByNullifier(
        input.stableApplicationId,
        input.registrationNullifier,
      );
      if (existing !== undefined) {
        this.#database.exec("COMMIT");
        return normalizeHex(existing.loginPublicKey) === normalizeHex(input.loginPublicKey)
          ? { status: "existing", account: existing, rootStatus: input.rootStatus }
          : { status: "conflict", reason: "login_key_substitution" };
      }

      const stableApplicationId = normalizeHex(input.stableApplicationId);
      const accountId = deriveAccountId(stableApplicationId, input.registrationNullifier);
      this.#database
        .prepare(
          `INSERT INTO application_accounts (
             account_id, stable_application_id, registration_nullifier,
             login_public_key, status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, 'active', ?, ?)`,
        )
        .run(
          accountId,
          stableApplicationId,
          input.registrationNullifier.toString(),
          normalizeHex(input.loginPublicKey),
          input.createdAt.toString(),
          input.createdAt.toString(),
        );
      this.#insertAudit("account_registered", stableApplicationId, accountId, input.createdAt);
      const account = this.getAccount(accountId);
      if (account === undefined) {
        throw new Error("atomic registration did not create an account");
      }
      this.#database.exec("COMMIT");
      return { status: "registered", account, rootStatus: input.rootStatus };
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  getAccount(accountId: Hex): ApplicationAccount | undefined {
    const row = this.#database
      .prepare(
        `SELECT account_id AS accountId,
                stable_application_id AS stableApplicationId,
                login_public_key AS loginPublicKey,
                status, created_at AS createdAt, updated_at AS updatedAt
         FROM application_accounts
         WHERE account_id = ?`,
      )
      .get(normalizeHex(accountId)) as unknown as AccountRow | undefined;
    return row === undefined ? undefined : rowToAccount(row);
  }

  createSession(accountId: Hex, tokenDigest: Hex, createdAt: bigint): boolean {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const account = this.getAccount(accountId);
      if (account === undefined || account.status === "banned") {
        this.#database.exec("COMMIT");
        return false;
      }
      this.#database
        .prepare(
          `INSERT INTO application_sessions (
             token_digest, account_id, created_at, is_valid
           ) VALUES (?, ?, ?, 1)`,
        )
        .run(normalizeHex(tokenDigest), normalizeHex(accountId), createdAt.toString());
      this.#insertAudit(
        "session_created",
        account.stableApplicationId,
        account.accountId,
        createdAt,
      );
      this.#database.exec("COMMIT");
      return true;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  authenticateSession(tokenDigest: Hex): ApplicationAccount | undefined {
    const row = this.#database
      .prepare(
        `SELECT a.account_id AS accountId,
                a.stable_application_id AS stableApplicationId,
                a.login_public_key AS loginPublicKey,
                a.status, a.created_at AS createdAt, a.updated_at AS updatedAt
         FROM application_sessions s
         JOIN application_accounts a ON a.account_id = s.account_id
         WHERE s.token_digest = ? AND s.is_valid = 1`,
      )
      .get(normalizeHex(tokenDigest)) as unknown as AccountRow | undefined;
    return row === undefined ? undefined : rowToAccount(row);
  }

  banAccount(accountId: Hex, bannedAt: bigint): boolean {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const account = this.getAccount(accountId);
      if (account === undefined) {
        this.#database.exec("COMMIT");
        return false;
      }
      if (account.status === "active") {
        this.#database
          .prepare(
            `UPDATE application_accounts
             SET status = 'banned', updated_at = ?
             WHERE account_id = ?`,
          )
          .run(bannedAt.toString(), normalizeHex(accountId));
        this.#database
          .prepare("UPDATE application_sessions SET is_valid = 0 WHERE account_id = ?")
          .run(normalizeHex(accountId));
        this.#insertAudit(
          "account_banned",
          account.stableApplicationId,
          account.accountId,
          bannedAt,
        );
      }
      this.#database.exec("COMMIT");
      return true;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  listAuditEvents(): readonly RedactedAuditEvent[] {
    const rows = this.#database
      .prepare(
        `SELECT event_type AS eventType,
                stable_application_id AS stableApplicationId,
                account_id AS accountId,
                occurred_at AS occurredAt
         FROM audit_events
         ORDER BY sequence ASC`,
      )
      .all() as unknown as AuditRow[];
    return rows.map((row) => ({
      eventType: row.eventType,
      stableApplicationId: row.stableApplicationId as Hex,
      accountId: row.accountId as Hex,
      occurredAt: BigInt(row.occurredAt),
    }));
  }

  close(): void {
    if (!this.#isClosed) {
      this.#database.close();
      this.#isClosed = true;
    }
  }

  #findByNullifier(
    stableApplicationId: Hex,
    registrationNullifier: bigint,
  ): ApplicationAccount | undefined {
    const row = this.#database
      .prepare(
        `SELECT account_id AS accountId,
                stable_application_id AS stableApplicationId,
                login_public_key AS loginPublicKey,
                status, created_at AS createdAt, updated_at AS updatedAt
         FROM application_accounts
         WHERE stable_application_id = ? AND registration_nullifier = ?`,
      )
      .get(normalizeHex(stableApplicationId), registrationNullifier.toString()) as unknown as
      AccountRow | undefined;
    return row === undefined ? undefined : rowToAccount(row);
  }

  #insertAudit(
    eventType: RedactedAuditEvent["eventType"],
    stableApplicationId: Hex,
    accountId: Hex,
    occurredAt: bigint,
  ): void {
    this.#database
      .prepare(
        `INSERT INTO audit_events (
           event_type, stable_application_id, account_id, occurred_at
         ) VALUES (?, ?, ?, ?)`,
      )
      .run(eventType, stableApplicationId, accountId, occurredAt.toString());
  }
}
