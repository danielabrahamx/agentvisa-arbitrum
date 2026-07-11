import { DatabaseSync } from "node:sqlite";

import { getAddress, type Hex } from "viem";

import type {
  ApplicationResultRecord,
  IssuedRewardClaimRecord,
  RewardClaimStore,
} from "./reward-authorizer.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS application_results (
  result_id TEXT PRIMARY KEY,
  stable_application_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  win_index INTEGER NOT NULL CHECK (win_index >= 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  UNIQUE (account_id, win_index)
) STRICT;

CREATE TABLE IF NOT EXISTS issued_reward_claims (
  claim_id TEXT PRIMARY KEY,
  result_id TEXT NOT NULL UNIQUE,
  stable_application_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  amount TEXT NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at >= 0),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  FOREIGN KEY (result_id) REFERENCES application_results(result_id)
) STRICT;
`;

interface ResultRow {
  readonly resultId: string;
  readonly stableApplicationId: string;
  readonly accountId: string;
  readonly winIndex: number;
  readonly createdAt: number | bigint;
}

interface ClaimRow {
  readonly claimId: string;
  readonly resultId: string;
  readonly stableApplicationId: string;
  readonly accountId: string;
  readonly recipient: string;
  readonly amount: string;
  readonly expiresAt: number | bigint;
  readonly issuedAt: number | bigint;
}

export class SqliteRewardClaimStore implements RewardClaimStore {
  readonly #database: DatabaseSync;
  #isClosed = false;

  constructor(configuration: { readonly databasePath: string }) {
    this.#database = new DatabaseSync(configuration.databasePath, {
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      allowExtension: false,
    });
    this.#database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    this.#database.exec(SCHEMA);
  }

  getResult(resultId: Hex): ApplicationResultRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT result_id AS resultId, stable_application_id AS stableApplicationId,
                account_id AS accountId, win_index AS winIndex, created_at AS createdAt
         FROM application_results WHERE result_id = ?`,
      )
      .get(resultId.toLowerCase()) as unknown as ResultRow | undefined;
    return row === undefined ? undefined : rowToResult(row);
  }

  getResultByAccountWin(accountId: Hex, winIndex: number): ApplicationResultRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT result_id AS resultId, stable_application_id AS stableApplicationId,
                account_id AS accountId, win_index AS winIndex, created_at AS createdAt
         FROM application_results WHERE account_id = ? AND win_index = ?`,
      )
      .get(accountId.toLowerCase(), winIndex) as unknown as ResultRow | undefined;
    return row === undefined ? undefined : rowToResult(row);
  }

  putResult(result: ApplicationResultRecord): void {
    this.#database
      .prepare(
        `INSERT INTO application_results (
           result_id, stable_application_id, account_id, win_index, created_at
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(result_id) DO UPDATE SET
           stable_application_id = excluded.stable_application_id,
           account_id = excluded.account_id,
           win_index = excluded.win_index,
           created_at = excluded.created_at`,
      )
      .run(
        result.resultId.toLowerCase(),
        result.stableApplicationId.toLowerCase(),
        result.accountId.toLowerCase(),
        result.winIndex,
        Number(result.createdAt),
      );
  }

  getClaimByResult(resultId: Hex): IssuedRewardClaimRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT claim_id AS claimId, result_id AS resultId,
                stable_application_id AS stableApplicationId, account_id AS accountId,
                recipient, amount, expires_at AS expiresAt, issued_at AS issuedAt
         FROM issued_reward_claims WHERE result_id = ?`,
      )
      .get(resultId.toLowerCase()) as unknown as ClaimRow | undefined;
    return row === undefined ? undefined : rowToClaim(row);
  }

  getClaim(claimId: Hex): IssuedRewardClaimRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT claim_id AS claimId, result_id AS resultId,
                stable_application_id AS stableApplicationId, account_id AS accountId,
                recipient, amount, expires_at AS expiresAt, issued_at AS issuedAt
         FROM issued_reward_claims WHERE claim_id = ?`,
      )
      .get(claimId.toLowerCase()) as unknown as ClaimRow | undefined;
    return row === undefined ? undefined : rowToClaim(row);
  }

  putClaim(claim: IssuedRewardClaimRecord): void {
    this.#database
      .prepare(
        `INSERT INTO issued_reward_claims (
           claim_id, result_id, stable_application_id, account_id,
           recipient, amount, expires_at, issued_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(claim_id) DO UPDATE SET
           result_id = excluded.result_id,
           stable_application_id = excluded.stable_application_id,
           account_id = excluded.account_id,
           recipient = excluded.recipient,
           amount = excluded.amount,
           expires_at = excluded.expires_at,
           issued_at = excluded.issued_at`,
      )
      .run(
        claim.claimId.toLowerCase(),
        claim.resultId.toLowerCase(),
        claim.stableApplicationId.toLowerCase(),
        claim.accountId.toLowerCase(),
        getAddress(claim.recipient).toLowerCase(),
        claim.amount.toString(),
        Number(claim.expiresAt),
        Number(claim.issuedAt),
      );
  }

  close(): void {
    if (this.#isClosed) return;
    this.#database.close();
    this.#isClosed = true;
  }
}

function rowToResult(row: ResultRow): ApplicationResultRecord {
  return {
    resultId: row.resultId as Hex,
    stableApplicationId: row.stableApplicationId as Hex,
    accountId: row.accountId as Hex,
    winIndex: row.winIndex,
    createdAt: BigInt(row.createdAt),
  };
}

function rowToClaim(row: ClaimRow): IssuedRewardClaimRecord {
  return {
    claimId: row.claimId as Hex,
    resultId: row.resultId as Hex,
    stableApplicationId: row.stableApplicationId as Hex,
    accountId: row.accountId as Hex,
    recipient: getAddress(row.recipient),
    amount: BigInt(row.amount),
    expiresAt: BigInt(row.expiresAt),
    issuedAt: BigInt(row.issuedAt),
  };
}
