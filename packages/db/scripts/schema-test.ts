/**
 * No drift between `src/schema.ts` and the migrations (2026-11-25, second agent's design, plan
 * `.claude/notes/drizzle-port-plan-2026-11-25.md` section 11): the SQL drizzle-kit itself makes
 * from `schema.ts` (`drizzle-kit/api`, from an empty database) and `migrations/*.sql` applied in
 * order must build the same tables in a real local D1: columns (type, NOT NULL, DEFAULT, primary
 * key), AUTOINCREMENT, indexes, foreign keys and CHECK clauses.
 *
 * Two differences are KNOWN and allowed, both from drizzle-kit 0.31.11 (read in its `bin.cjs`):
 * - `primaryKey()` always adds NOT NULL; 0001-0004 declare their keys without it (the columns in
 *   `PK_NOT_NULL`).
 * - kit makes every sqlite UNIQUE a `CREATE UNIQUE INDEX <name>`; 0001 / 0004 wrote inline UNIQUE
 *   (an `sqlite_autoindex_*`). Same uniqueness; the columns in `INLINE_UNIQUE`. A generated
 *   migration that drops or changes one of these needs a hand edit (`.claude/rules/db.md`).
 * Fails when a schema edit has no migration, or a migration has no schema edit.
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from "drizzle-kit/api";
import * as schema from "../src/schema.ts";
import {
  applyMigrations,
  applySql,
  createTestD1,
  migrationStatements,
} from "../src/testing/d1.ts";

const PK_NOT_NULL = [
  "contact_account.id",
  "contact_session.token_hash",
  "message.id",
  "message_reply.id",
  "post.id",
  "profile.id",
  "verify_token.link_hash",
];
const INLINE_UNIQUE = ["contact_account(email)", "post(slug)"];

const test1 = await createTestD1({ migrate: false });
after(() => test1.dispose());
const db = test1.db;

async function rows<T>(q: string): Promise<T[]> {
  return (await db.prepare(q).all<T>()).results;
}

/** The CHECK clauses in a CREATE TABLE text, whitespace collapsed. */
function checks(createSql: string): string[] {
  const out: string[] = [];
  const re = /CHECK\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(createSql))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < createSql.length && depth > 0; i++) {
      if (createSql[i] === "(") depth++;
      else if (createSql[i] === ")") depth--;
    }
    out.push(createSql.slice(start, i - 1).replace(/\s+/g, " ").trim());
  }
  return out.sort();
}

interface Shape {
  tables: Record<string, unknown>;
  pkNotNull: string[];
  uniqueIndexes: string[];
}

async function shape(): Promise<Shape> {
  const tables: Record<string, unknown> = {};
  const pkNotNull: string[] = [];
  const uniqueIndexes: string[] = [];
  const list = await rows<{ name: string; sql: string }>(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
  );
  for (const { name, sql } of list) {
    const columns = (
      await rows<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>(`PRAGMA table_xinfo(${name})`)
    ).map((c) => {
      if (c.pk && c.notnull) pkNotNull.push(`${name}.${c.name}`);
      return {
        name: c.name,
        type: c.type.toUpperCase(),
        // Known difference 1: a primary key's NOT NULL is not compared.
        notnull: c.pk ? "pk" : c.notnull,
        dflt: c.dflt_value,
        pk: c.pk,
      };
    });
    const indexes = [];
    for (const ix of await rows<{
      name: string;
      unique: number;
      origin: string;
    }>(`PRAGMA index_list(${name})`)) {
      const cols = (
        await rows<{ name: string }>(`PRAGMA index_info(${ix.name})`)
      ).map((c) => c.name);
      if (ix.origin === "pk") continue; // the primary key, compared above
      if (ix.unique && (ix.origin === "u" || ix.name.endsWith("_unique"))) {
        // Known difference 2: inline UNIQUE vs a named unique index.
        uniqueIndexes.push(`${name}(${cols.join(",")})`);
        continue;
      }
      indexes.push(`${ix.name}:${ix.unique}:${cols.join(",")}`);
    }
    const fks = (
      await rows<{
        table: string;
        from: string;
        to: string;
        on_update: string;
        on_delete: string;
      }>(`PRAGMA foreign_key_list(${name})`)
    ).map(
      (f) =>
        `${f.from}->${f.table}.${f.to} update:${f.on_update.toUpperCase()} delete:${f.on_delete.toUpperCase()}`,
    );
    tables[name] = {
      columns,
      autoincrement: /AUTOINCREMENT/i.test(sql),
      indexes: indexes.sort(),
      fks: fks.sort(),
      checks: checks(sql),
    };
  }
  return {
    tables,
    pkNotNull: pkNotNull.sort(),
    uniqueIndexes: uniqueIndexes.sort(),
  };
}

async function dropAll() {
  const list = await rows<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
  );
  await db.batch([
    db.prepare("PRAGMA defer_foreign_keys = true"),
    ...list.map(({ name }) => db.prepare(`DROP TABLE ${name}`)),
  ]);
}

test("schema.ts (through drizzle-kit) builds what migrations 0001-0006 build", async () => {
  await applyMigrations(db);
  const fromMigrations = await shape();

  await dropAll();
  const empty = await generateSQLiteDrizzleJson({});
  const current = await generateSQLiteDrizzleJson(schema);
  const kitSql = await generateSQLiteMigration(empty, current);
  await applySql(db, kitSql.flatMap(migrationStatements));
  const fromSchema = await shape();

  assert.deepEqual(fromSchema.tables, fromMigrations.tables);
  // The known differences are exactly the listed ones, nothing more.
  assert.deepEqual(fromMigrations.pkNotNull, []);
  assert.deepEqual(fromSchema.pkNotNull, PK_NOT_NULL);
  assert.deepEqual(fromMigrations.uniqueIndexes, INLINE_UNIQUE);
  assert.deepEqual(fromSchema.uniqueIndexes, INLINE_UNIQUE);
});
