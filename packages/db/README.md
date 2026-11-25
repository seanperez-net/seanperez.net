# @seanperez/db

The D1 database code shared by the site (`apps/web`) and the admin (`apps/admin`): the schema in
[Drizzle ORM](https://orm.drizzle.team) (`src/schema.ts`), the queries, and the migrations that
`wrangler d1 migrations apply` runs (`migrations/`). Source-only and server-only: the apps' Vite
builds compile it.

- `getDb(env.DB)` (`src/client.ts`) gives the Drizzle handle for a D1 binding.
- Migrations are generated: edit `src/schema.ts`, then `pnpm db:generate --name <what>`.
  `migrations/0000_init.sql` is the one baseline (the pre-launch history was squashed into it).
- `pnpm test` runs the unit tests on a real local D1 (wrangler's `getPlatformProxy`, in memory),
  including a check that `src/schema.ts` and the migrations build the same tables.
