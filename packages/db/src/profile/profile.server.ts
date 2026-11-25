/**
 * The owner's profile in D1 (binding `DB`, table `profile`, ONE row with id = 1,
 * `migrations/0000_init.sql`), through Drizzle (port 2026-11-25). Written only from the admin app's Profile (behind Access).
 *
 * Defaults are merged PER FIELD: a NULL / empty column shows the default from
 * `profile-seed.ts` (the bio is the seed summary, the links are its Links, the name the
 * site's), so an empty table, or a half-filled one, never blanks the page. `links` NULL means "the
 * default links"; a saved empty list `[]` means "no links".
 *
 * `sections` (2026-11-25, `migrations/0002_profile_sections.sql`): the profile's Work, Education,
 * Skills, ... and custom sections, as Google's profile has them, one JSON document checked on every
 * read (`profile-sections.ts`). The public profile carries them with hidden sections and entries
 * already REMOVED (never sent). NULL = no sections. Saved by its own write (`saveSections`), so the
 * profile form and the sections editor never overwrite each other.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import * as v from "valibot";
import { getDb } from "../client.ts";
import { profile as profileTable } from "../schema.ts";
import { PROFILE_MAX } from "./limits.ts";
import {
  EMPTY_SECTIONS,
  ProfileSectionsSchema,
  parseStoredSections,
  toPublicSections,
  type ProfileSectionsDoc,
} from "./profile-sections.ts";
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
  sections: [],
};

interface ProfileRow {
  name: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  links: string | null;
  sections: string | null;
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
        sections: profileTable.sections,
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
    sections: publicSections(row.sections),
  };
}

/** The stored sections as the site shows them (hidden parts removed); none when broken. */
function publicSections(json: string | null) {
  if (json === null) return [];
  const parsed = parseStoredSections(json);
  if (!parsed.doc) console.error("profile: stored sections do not parse");
  if (parsed.dropped) {
    console.error(`profile: ${parsed.dropped} section records dropped on read`);
  }
  return parsed.doc ? toPublicSections(parsed.doc) : [];
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
  /** True while `links` is NULL: the page shows the default links. */
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

/**
 * Back to the defaults: the profile form's fields are cleared (NULL = default). The sections are
 * KEPT (they have their own editor; a profile reset is not a sections delete); with none, the row
 * is removed, as before the sections.
 */
export async function resetProfile(db: D1Database): Promise<void> {
  const orm = getDb(db);
  await orm.batch([
    orm
      .update(profileTable)
      .set({
        name: null,
        headline: null,
        location: null,
        bio: null,
        links: null,
        updated_at: new Date().toISOString(),
      })
      .where(eq(profileTable.id, 1)),
    orm
      .delete(profileTable)
      .where(and(eq(profileTable.id, 1), isNull(profileTable.sections))),
  ]);
  forgetProfile();
}

// --- the sections (admin only, behind `requireAdmin`) --------------------------------------

export interface SectionsForm {
  /** Everything, hidden parts included. Empty when there is none (or it is broken). */
  doc: ProfileSectionsDoc;
  updatedAt: string | null;
  /** Records that could not be read; a save drops them. */
  dropped: number;
  /** Stored sections exist but are not a v1 document: the admin says so (Import replaces them). */
  broken: boolean;
}

/** The admin's view: every section. Throws when the table is missing (the page says so). */
export async function getSectionsForm(db: D1Database): Promise<SectionsForm> {
  const row = await readRow(db);
  if (!row?.sections) {
    return {
      doc: EMPTY_SECTIONS,
      updatedAt: row?.updated_at ?? null,
      dropped: 0,
      broken: false,
    };
  }
  const parsed = parseStoredSections(row.sections);
  return {
    doc: parsed.doc ?? EMPTY_SECTIONS,
    updatedAt: row.updated_at,
    dropped: parsed.dropped,
    broken: !parsed.doc,
  };
}

export type SaveSectionsResult =
  | { ok: true }
  | { ok: false; issues: v.FlatErrors<typeof ProfileSectionsSchema> };

/**
 * The sections' ONE write path (m3-hierarchy D4): the whole document, validated again with the
 * schema the reads use, then an upsert of the `sections` column only (a missing row is created
 * with the other fields NULL = their defaults). Nothing is written when anything fails.
 */
export async function saveSections(
  db: D1Database,
  input: unknown,
  now = new Date(),
): Promise<SaveSectionsResult> {
  const parsed = v.safeParse(ProfileSectionsSchema, input);
  if (!parsed.success) return { ok: false, issues: v.flatten(parsed.issues) };
  await getDb(db)
    .insert(profileTable)
    .values({
      id: 1,
      sections: JSON.stringify(parsed.output),
      updated_at: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: profileTable.id,
      set: {
        sections: sql`excluded.sections`,
        updated_at: sql`excluded.updated_at`,
      },
    });
  forgetProfile();
  return { ok: true };
}
