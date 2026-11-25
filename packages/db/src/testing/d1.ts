/**
 * A REAL local D1 for the unit tests (`node --test`): wrangler's `getPlatformProxy` with
 * `persist: false` (in memory, gone on `dispose()`), config `wrangler.test.jsonc`, every
 * `migrations/*.sql` applied in order. Chosen over an SQLite shim or better-sqlite3 (2026-11-25,
 * `.claude/notes/drizzle-port-plan-2026-11-25.md` section 7): no native build of our own (workerd is
 * already in `allowBuilds`), drizzle's D1 driver runs unchanged (`raw()`, `batch`), and D1's own
 * limits apply (it refuses more than 100 bound parameters). Measured: start ~0.5 s, migrations
 * ~0.2 s, `reset()` ~30 ms.
 *
 * Tests only: never import it from app or package runtime code.
 */
import { readdirSync, readFileSync } from "node:fs";
import { getPlatformProxy } from "wrangler";

const MIGRATIONS = new URL("../../migrations/", import.meta.url);

/**
 * The statements of one migration file. Comments go first (the files have `;` inside comments,
 * and drizzle-kit's `--> statement-breakpoint` is a comment too); no string literal in our
 * migrations contains `--`.
 */
export function migrationStatements(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `migrations/*.sql` file names, in the order wrangler applies them (name order). */
export const migrationFiles = () =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();

/** Apply SQL statements as one batch (one transaction, as wrangler applies a file). */
export async function applySql(db: D1Database, statements: string[]) {
  if (statements.length)
    await db.batch(statements.map((s) => db.prepare(s)));
}

export async function applyMigrations(db: D1Database) {
  for (const file of migrationFiles()) {
    await applySql(
      db,
      migrationStatements(readFileSync(new URL(file, MIGRATIONS), "utf8")),
    );
  }
}

/** Children before parents, so the deletes never trip a foreign key. */
const TABLES = [
  "message_reply",
  "verify_token",
  "contact_session",
  "message",
  "contact_account",
  "post",
  "profile",
  ];

export interface TestD1 {
  db: D1Database;
  /** Empty every table and restart the AUTOINCREMENT ids (a fresh database, ~30 ms). */
  reset(): Promise<D1Database>;
  dispose(): Promise<void>;
}

/** One migrated in-memory D1 per test file; `reset()` before each test. */
export async function createTestD1(
  options: { migrate?: boolean } = {},
): Promise<TestD1> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: new URL("../../wrangler.test.jsonc", import.meta.url).pathname,
    persist: false,
  });
  const db = proxy.env.DB;
  if (options.migrate !== false) await applyMigrations(db);
  return {
    db,
    async reset() {
      await db.batch([
        ...TABLES.map((t) => db.prepare(`DELETE FROM ${t}`)),
        db.prepare("DELETE FROM sqlite_sequence"),
      ]);
      return db;
    },
    dispose: () => proxy.dispose(),
  };
}
