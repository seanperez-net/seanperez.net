// Departure (QWIK-DEFAULTS.md 2026-11-24, "live nodes"): the adapter writes this file into dist/
// only when it does not exist, with `fetch` alone. The Durable Object class `NodeHub` must also
// be exported from the Worker's main module (wrangler.jsonc `main`). Kept out of the static
// assets by `.assetsignore`.
import { fetch, NodeHub } from "../server/entry.cloudflare-pages";
export default { fetch };
export { NodeHub };
