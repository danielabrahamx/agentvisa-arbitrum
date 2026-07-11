import { DatabaseSync } from "node:sqlite";

import type { Hex } from "viem";

import type { RobotRallyAccountState, RobotRallyStateStore } from "./robot-rally-adapter.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS robot_rally_state (
  account_id TEXT PRIMARY KEY,
  plays INTEGER NOT NULL CHECK (plays >= 0),
  wins INTEGER NOT NULL CHECK (wins >= 0),
  is_manually_flagged_bot INTEGER NOT NULL CHECK (is_manually_flagged_bot IN (0, 1)),
  is_banned INTEGER NOT NULL CHECK (is_banned IN (0, 1)),
  latest_username TEXT,
  latest_wallet TEXT
) STRICT;
`;

interface RobotRallyRow {
  readonly accountId: string;
  readonly plays: number;
  readonly wins: number;
  readonly isManuallyFlaggedBot: number;
  readonly isBanned: number;
  readonly latestUsername: string | null;
  readonly latestWallet: string | null;
}

export class SqliteRobotRallyStore implements RobotRallyStateStore {
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

  get(accountId: Hex): RobotRallyAccountState | undefined {
    const row = this.#database
      .prepare(
        `SELECT account_id AS accountId, plays, wins,
                is_manually_flagged_bot AS isManuallyFlaggedBot,
                is_banned AS isBanned,
                latest_username AS latestUsername,
                latest_wallet AS latestWallet
         FROM robot_rally_state
         WHERE account_id = ?`,
      )
      .get(accountId.toLowerCase()) as unknown as RobotRallyRow | undefined;
    return row === undefined ? undefined : rowToState(row);
  }

  put(state: RobotRallyAccountState): void {
    this.#database
      .prepare(
        `INSERT INTO robot_rally_state (
           account_id, plays, wins, is_manually_flagged_bot, is_banned,
           latest_username, latest_wallet
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           plays = excluded.plays,
           wins = excluded.wins,
           is_manually_flagged_bot = excluded.is_manually_flagged_bot,
           is_banned = excluded.is_banned,
           latest_username = excluded.latest_username,
           latest_wallet = excluded.latest_wallet`,
      )
      .run(
        state.accountId.toLowerCase(),
        state.plays,
        state.wins,
        state.isManuallyFlaggedBot ? 1 : 0,
        state.isBanned ? 1 : 0,
        state.latestUsername ?? null,
        state.latestWallet ?? null,
      );
  }

  list(): readonly RobotRallyAccountState[] {
    const rows = this.#database
      .prepare(
        `SELECT account_id AS accountId, plays, wins,
                is_manually_flagged_bot AS isManuallyFlaggedBot,
                is_banned AS isBanned,
                latest_username AS latestUsername,
                latest_wallet AS latestWallet
         FROM robot_rally_state
         ORDER BY account_id ASC`,
      )
      .all() as unknown as RobotRallyRow[];
    return rows.map(rowToState);
  }

  close(): void {
    if (!this.#isClosed) {
      this.#database.close();
      this.#isClosed = true;
    }
  }
}

function rowToState(row: RobotRallyRow): RobotRallyAccountState {
  return {
    accountId: row.accountId as Hex,
    plays: row.plays,
    wins: row.wins,
    isManuallyFlaggedBot: row.isManuallyFlaggedBot === 1,
    isBanned: row.isBanned === 1,
    ...(row.latestUsername === null ? {} : { latestUsername: row.latestUsername }),
    ...(row.latestWallet === null ? {} : { latestWallet: row.latestWallet }),
  };
}
