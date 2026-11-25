/**
 * The owner's profile in D1 (binding `DB`, table `profile`, ONE row with id = 1,
 * `migrations/0002_create_profile.sql`), through Drizzle (port 2026-11-25). Written only from the admin app's Profile (behind Access).
 *
 * Defaults are merged PER FIELD: a NULL / empty column shows the default from
 * `profile-seed.ts` (the bio is the résumé summary, the links are its Links, the name the
 * site's), so an empty table, or a half-filled one, never blanks the page. `links` NULL means "the
 * résumé's links"; a saved empty list `[]` means "no links".
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "../client.ts";
import { profile as profileTable } from "../schema.ts";
import { PROFILE_MAX } from "./limits.ts";
import { PROFILE_SEED } from "./profile-seed.ts";
import {
  describeLink,
  safeLinkHref,
  type Profile,
  type ProfileLink,
} from "./profile.ts";

/** The defaults: nothing is invented (headline and location stay empty for the owner). */
export const PROFILE_DEFAULTS: Profile = {
  name: PROFILE_SEED.name,
  headline: "",
  location: "",
  bio: PROFILE_SEED.summary,
  links: PROFILE_SEED.links.map((link) => ({
    label: link.label,
    href: link.href,
    detail: link.detail,
    ...(link.brand ? { brand: link.brand } : {}),
    ...(link.me ? { me: true } : {}),
  })),
};

interface ProfileRow {
  name: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  links: string | null;
  updated_at: string;
}

/** The stored links, checked again on read (only known keys, only http(s), within limits). */
function parseLinks(json: string | null): ProfileLink[] | null {
  if (json === null) return null;
  try {
    const data: unknown = JSON.parse(json);
    if (!Array.isArray(data)) return null;
    const links: ProfileLink[] = [];
    for (const item of data.slice(0, PROFILE_MAX.links)) {
      const label =
        typeof item?.label === "string"
          ? item.label.trim().slice(0, PROFILE_MAX.linkLabel)
          : "";
      const href =
        typeof item?.href === "string" ? safeLinkHref(item.href) : null;
      if (label && href) links.push(describeLink(label, href));
    }
    return links;
  } catch {
    return null;
  }
}

const orDefault = (value: string | null, fallback: string) =>
  value?.trim() ? value : fallback;

/** The stored row, or null when there is none (or the table is missing). */
async function readRow(db: D1Database): Promise<ProfileRow | null> {
  return (
    (await getDb(db)
      .select({
        name: profileTable.name,
        headline: profileTable.headline,
        location: profileTable.location,
        bio: profileTable.bio,
        links: profileTable.links,
        updated_at: profileTable.updated_at,
      })
      .from(profileTable)
      .where(eq(profileTable.id, 1))
      .get()) ?? null
  );
}

/**
 * The public profile, kept in THIS isolate's memory for `PROFILE_TTL_MS` (2026-11-24, social icon
 * row). The Contact me companion shows the profile's links on every route, so the root layout
 * reads it on every page view and navigation; this keeps that to one D1 read per isolate per
 * minute. Why memory and not the Cache API (second agent, 2026-11-24): the Cache API is per data
 * centre, and its `delete` would run on the /admin save, which is behind Cloudflare Access, where
 * Cloudflare's docs say the Cache API is not available (developers.cloudflare.com/workers/
 * runtime-apis/cache/, read 2026-11-24); the router's loader `cacheKey` caches loader JSON only,
 * per path, with no TTL. A save clears this isolate's copy (`forgetProfile`); other isolates show
 * the old links for at most a minute. A failed read is not kept, so the next request tries again.
 */
const PROFILE_TTL_MS = 60_000;
let memo: { profile: Profile; at: number } | null = null;

/** Drop the memo (after a save or a reset). */
export const forgetProfile = () => {
  memo = null;
};

/**
 * The profile as the public pages show it. A database error (the table not created yet, when
 * the code is deployed before the migration) is logged and shows the defaults, never a 500.
 */
export async function getProfile(db: D1Database): Promise<Profile> {
  if (memo && Date.now() - memo.at < PROFILE_TTL_MS) return memo.profile;
  let row: ProfileRow | null;
  try {
    row = await readRow(db);
  } catch (error) {
    console.error("profile: read failed", error);
    return PROFILE_DEFAULTS;
  }
  const profile = toProfile(row);
  memo = { profile, at: Date.now() };
  return profile;
}

function toProfile(row: ProfileRow | null): Profile {
  if (!row) return PROFILE_DEFAULTS;
  return {
    name: orDefault(row.name, PROFILE_DEFAULTS.name),
    headline: orDefault(row.headline, PROFILE_DEFAULTS.headline),
    location: orDefault(row.location, PROFILE_DEFAULTS.location),
    bio: orDefault(row.bio, PROFILE_DEFAULTS.bio),
    links: parseLinks(row.links) ?? PROFILE_DEFAULTS.links,
  };
}

// --- /admin only (behind `requireAdmin`) ---------------------------------------------------

/** What the form edits: the stored values (empty = default), and when it was last saved. */
export interface ProfileForm {
  name: string;
  headline: string;
  location: string;
  bio: string;
  /** The stored (or default) links, in order; the form adds and removes rows itself. */
  links: { label: string; href: string }[];
  /** True while `links` is NULL: the page shows the résumé's links. */
  linksDefault: boolean;
  updatedAt: string | null;
  /** The name shown while `name` is empty (a constant in a `.server.ts` cannot reach the client). */
  defaultName: string;
}

/** The form's starting values. Throws when the table is missing (the page says so). */
export async function getProfileForm(db: D1Database): Promise<ProfileForm> {
  const row = await readRow(db);
  const stored = parseLinks(row?.links ?? null);
  return {
    name: row?.name ?? "",
    headline: row?.headline ?? "",
    location: row?.location ?? "",
    bio: row?.bio ?? "",
    links: (stored ?? PROFILE_DEFAULTS.links).map(({ label, href }) => ({
      label,
      href,
    })),
    linksDefault: stored === null,
    updatedAt: row?.updated_at ?? null,
    defaultName: PROFILE_DEFAULTS.name,
  };
}

export interface ProfileInput {
  name: string;
  headline: string;
  location: string;
  bio: string;
  links: { label: string; href: string }[];
}

/** NULL for a cleared field (= the default). */
const nullIfEmpty = (value: string) => (value.trim() ? value.trim() : null);

/** Insert or replace the one row (`ON CONFLICT(id) DO UPDATE`, SQLite upsert). */
export async function saveProfile(
  db: D1Database,
  input: ProfileInput,
): Promise<void> {
  await getDb(db)
    .insert(profileTable)
    .values({
      id: 1,
      name: nullIfEmpty(input.name),
      headline: nullIfEmpty(input.headline),
      location: nullIfEmpty(input.location),
      // The bio keeps its line breaks; only the ends are trimmed.
      bio: nullIfEmpty(input.bio),
      links: JSON.stringify(input.links),
      updated_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: profileTable.id,
      set: {
        name: sql`excluded.name`,
        headline: sql`excluded.headline`,
        location: sql`excluded.location`,
        bio: sql`excluded.bio`,
        links: sql`excluded.links`,
        updated_at: sql`excluded.updated_at`,
      },
    });
  forgetProfile();
}

/** Back to the defaults: the row is removed. */
export async function resetProfile(db: D1Database): Promise<void> {
  await getDb(db).delete(profileTable).where(eq(profileTable.id, 1));
  forgetProfile();
}
