import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit 0.31.11 (`pnpm --filter @seanperez/db db:generate` / `db:check`). Generate and check
 * need no database, so there is NO `driver` and no credentials: the migrations are applied with
 * wrangler (`wrangler d1 migrations apply seanperez-net --local` from apps/web; `--remote` by the
 * owner), never with `drizzle-kit migrate` / `push`.
 *
 * `out` is the folder both apps' `wrangler.jsonc` `migrations_dir` point at. 0001-0006 were written
 * by hand before Drizzle and stay as they are; `meta/0006_snapshot.json` (generated from
 * `src/schema.ts`, checked by `scripts/schema-test.ts`) and `meta/_journal.json` (entries idx 1-6)
 * are the baseline, so the next generated file is `0007_<name>.sql` (kit numbers from the last
 * journal entry; wrangler reads `migrations/*.sql` and ignores `meta/`). Rules: `.claude/rules/db.md`.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
});
