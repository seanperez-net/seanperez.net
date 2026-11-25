import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";

/**
 * The LOCAL D1 both dev servers read (apps/web's `.wrangler/state/v3`; copy of apps/web/e2e/local-d1.ts), for
 * specs that write rows through the `@seanperez/db` functions rather than raw SQL (so every
 * computed column, such as a post's search columns, is filled as the app fills it). Wrangler's
 * `getPlatformProxy` (4.165.0 `cli.d.ts` `GetPlatformProxyOptions`: `configPath`, `persist.path`)
 * with apps/web's `wrangler.jsonc` and the state path `vite.config.ts` gives. Local only: never remote.
 * Opened and disposed per use, so no workerd is left running.
 */
// apps/web's config and state: the admin dev server shares them (`vite.config.ts`, rule A13).
const APP_DIR = fileURLToPath(new URL("../../web/", import.meta.url));

export async function withLocalD1<T>(
  fn: (db: D1Database) => Promise<T>,
): Promise<T> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: `${APP_DIR}wrangler.jsonc`,
    persist: { path: `${APP_DIR}.wrangler/state/v3` },
  });
  try {
    return await fn(proxy.env.DB);
  } finally {
    await proxy.dispose();
  }
}
