// Departure (QWIK-DEFAULTS.md 2026-11-24, "live nodes", and 2026-11-25, "inbound mail"): the
// adapter writes this file into dist/ only when it does not exist, with `fetch` alone. The
// Durable Object class `NodeHub` must also be exported from the Worker's main module
// (wrangler.jsonc `main`), and Email Routing calls the default export's `email` handler (mail to
// sean@seanperez.net, `src/mail/inbound.server.ts`). Kept out of the static assets by
// `.assetsignore`.
import { fetch, email, NodeHub } from "../server/entry.cloudflare-pages";
export default { fetch, email };
export { NodeHub };
