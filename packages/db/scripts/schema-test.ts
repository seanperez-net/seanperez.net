/**
 * No drift between `src/schema.ts` and the migrations: the SQL drizzle-kit itself makes from
 * `schema.ts` (`drizzle-kit/api`, from an empty database) and `migrations/*.sql` applied in order
 * (as wrangler applies them) must build the same tables in a real local D1: columns (type,
 * NOT NULL, DEFAULT, primary key), AUTOINCREMENT, indexes (name, unique, columns), foreign keys and
 * CHECK clauses. No known differences are allowed since the pre-launch squash (2026-11-25): the
 * baseline `0000_init.sql` is kit's own SQL. Fails when a schema edit has no migration, or a
 * migration has no schema edit. `db:check` (`drizzle-kit check`) checks the snapshots.
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
    out.push(
      createSql
        .slice(start, i - 1)
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return out.sort();
}

async function shape(): Promise<Record<string, unknown>> {
  const tables: Record<string, unknown> = {};
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
    ).map((c) => ({
      name: c.name,
      type: c.type.toUpperCase(),
      notnull: c.notnull,
      dflt: c.dflt_value,
      pk: c.pk,
    }));
    const indexes = [];
    for (const ix of await rows<{
      name: string;
      unique: number;
      origin: string;
    }>(`PRAGMA index_list(${name})`)) {
      if (ix.origin === "pk") continue; // the primary key, compared above
      const cols = (
        await rows<{ name: string }>(`PRAGMA index_info(${ix.name})`)
      ).map((c) => c.name);
      indexes.push(`${ix.origin}:${ix.name}:${ix.unique}:${cols.join(",")}`);
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
  return tables;
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

test("schema.ts (through drizzle-kit) builds what the migrations build", async () => {
  await applyMigrations(db);
  const fromMigrations = await shape();
  assert.ok(Object.keys(fromMigrations).length > 0, "no tables migrated");

  await dropAll();
  const empty = await generateSQLiteDrizzleJson({});
  const current = await generateSQLiteDrizzleJson(schema);
  const kitSql = await generateSQLiteMigration(empty, current);
  await applySql(db, kitSql.flatMap(migrationStatements));

  assert.deepEqual(await shape(), fromMigrations);
});
