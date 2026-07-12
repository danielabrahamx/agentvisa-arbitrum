import { DatabaseSync } from "node:sqlite";

/**
 * Pins Enrollment Authorization `issuedAt` per Semaphore identity commitment so
 * Create-or-retry stays idempotent across process restarts and clock movement.
 */
export class SqliteDemoJourneyStore {
  readonly #database: DatabaseSync;
  #isClosed = false;

  constructor(databasePath: string) {
    this.#database = new DatabaseSync(databasePath, {
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      allowExtension: false,
    });
    this.#database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS enrollment_issued_at (
        commitment_key TEXT PRIMARY KEY,
        issued_at TEXT NOT NULL
      ) STRICT;
    `);
  }

  getOrCreateIssuedAt(commitmentKey: string, currentTime: bigint): bigint {
    this.#database
      .prepare(
        `INSERT INTO enrollment_issued_at (commitment_key, issued_at)
         VALUES (?, ?)
         ON CONFLICT(commitment_key) DO NOTHING`,
      )
      .run(commitmentKey, currentTime.toString());
    const row = this.#database
      .prepare("SELECT issued_at AS issuedAt FROM enrollment_issued_at WHERE commitment_key = ?")
      .get(commitmentKey) as unknown as { readonly issuedAt: string };
    return BigInt(row.issuedAt);
  }

  close(): void {
    if (!this.#isClosed) {
      this.#database.close();
      this.#isClosed = true;
    }
  }
}
