import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit 0.31.11 (`pnpm --filter @seanperez/db db:generate` / `db:check`). Generate and check
 * need no database, so there is NO `driver` and no credentials: the migrations are applied with
 * wrangler (`wrangler d1 migrations apply seanperez-net --local` from apps/web; `--remote` by the
 * owner), never with `drizzle-kit migrate` / `push`.
 *
 * `out` is the folder both apps' `wrangler.jsonc` `migrations_dir` point at. Since the pre-launch
 * squash (2026-11-25) it starts with ONE generated baseline, `0000_init.sql` (+ `meta/`); every later
 * file is generated the same way (kit numbers from the last journal entry; wrangler reads
 * `migrations/*.sql` in name order and ignores `meta/`). Rules: `.claude/rules/db.md`.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
});
