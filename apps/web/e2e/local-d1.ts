import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";

/**
 * The dev server's LOCAL D1 (apps/web's `.wrangler/state/v3`, which `pnpm dev:admin` shares), for
 * specs that write rows through the `@seanperez/db` functions rather than raw SQL (so every
 * computed column, such as a post's search columns, is filled as the app fills it). Wrangler's
 * `getPlatformProxy` (4.165.0 `cli.d.ts` `GetPlatformProxyOptions`: `configPath`, `persist.path`)
 * with this app's `wrangler.jsonc`, the same call `vite.config.ts` makes. Local only: never remote.
 * Opened and disposed per use, so no workerd is left running.
 */
const APP_DIR = fileURLToPath(new URL("..", import.meta.url));

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
