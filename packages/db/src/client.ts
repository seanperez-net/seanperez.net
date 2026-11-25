import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";

/**
 * The Drizzle handle for a D1 binding (`drizzle-orm/d1`, 0.45.4; orm.drizzle.team
 * "connect-cloudflare-d1": `drizzle(env.DB)`). ONE handle per binding OBJECT, kept in a WeakMap
 * (e-store's `cachedPerBinding` rule, adopted 2026-11-25): call `getDb(db)` freely; a new binding
 * object (another request) is a miss, never a wrong database, and the entry goes with the binding.
 *
 * - No options (no `schema`: no relational queries are used; no `casing`: the schema's JS keys
 *   are the column names; no logger). A different configuration would need its own cache.
 * - The handle is stateless: never assign onto it.
 */
const handles = new WeakMap<D1Database, DrizzleD1Database>();

export function getDb(binding: D1Database): DrizzleD1Database {
  let db = handles.get(binding);
  if (!db) {
    db = drizzle(binding);
    handles.set(binding, db);
  }
  return db;
}
