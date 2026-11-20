# seanperez.net

Personal site and resume. pnpm monorepo.

- `apps/web`: Qwik v2 (`@qwik.dev/core`, `@qwik.dev/router`) with Tailwind v4, deployed to Cloudflare Workers.
- `packages/*`: shared packages (none yet).

## Commands

```sh
pnpm install
pnpm dev        # dev server
pnpm build      # client + Cloudflare Workers server build
pnpm deploy     # wrangler deploy (run `pnpm --filter @seanperez/web exec wrangler login` first)
```
