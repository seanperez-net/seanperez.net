# seanperez.net

Personal site and resume. pnpm monorepo.

- `apps/web`: Qwik v2 (`@qwik.dev/core`, `@qwik.dev/router`) with Tailwind v4, deployed to Cloudflare Workers.
- `apps/admin`: the owner's admin app, its own Worker behind Cloudflare Access, same D1 database.
- `packages/ui`: Material 3 component library (Qwik, `tailwind-variants`), with a playground.
- `packages/chat`: the Messages app's chat UI.
- `packages/db`: Drizzle ORM schema, queries and migrations for Cloudflare D1.
- `packages/server`: server-only code both apps share (mail, Access check, rate limits, Turnstile).

## Commands

```sh
pnpm install
pnpm dev        # dev server
pnpm build      # client + Cloudflare Workers server build
pnpm deploy     # wrangler deploy (run `pnpm --filter @seanperez/web exec wrangler login` first)
```
