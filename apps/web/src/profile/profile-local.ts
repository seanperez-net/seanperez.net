/**
 * THE VISITOR'S OWN PROFILE EDIT (2026-11-24). Since 2026-11-25 (memory `visitor-is-guest-you`)
 * the visitor is a GUEST ("You"), so the override is over the guest's base profile
 * (`use-profile.tsx` `GUEST_PROFILE`), not the owner's server profile; the functions here take any
 * base. Owner (2026-11-24): "yes ... save profile locally", answering
 * "Should a visitor's Profile edit be saved locally, so it replaces your profile on their screen
 * only?". The site looks signed in, so `/profile/` is the visitor's own account card: Edit
 * profile saves THEIR changes in THEIR browser through the shared seam (`local-store.ts`
 * `changeLocalDoc`, doc `profile.local`), never to the server. `apps/admin` is the same code plus
 * the sync dispatcher (`sync-docs.ts`).
 *
 * The document holds only the fields the visitor CHANGED, as an override over the server profile
 * (`profile.server.ts` `getProfile`): a field they never touched keeps following the server.
 * Reset writes an empty override with a new stamp (not a delete), so the outbox carries the reset.
 *
 * Plain TS + zod, no Qwik, no storage, no clock: the page, a test or admin's service worker can
 * run it. Stored data is untrusted: a doc that fails the schema is NO override (the server
 * profile shows), and links are re-checked (`safeLinkHref`) and re-described (`describeLink`) on
 * every read. NO email field (no-email rule): `.strict()` rejects unknown keys.
 *
 * NOT used by the Contact me companion or its social links (`social-links.tsx`), the page head,
 * OG images or JSON-LD: those always show the real owner (memory `contact-me-pitch-idea`).
 */
import { z } from "zod";
import { PROFILE_MAX } from "@seanperez/db/profile/limits";
import { describeLink, safeLinkHref, type Profile } from "@seanperez/db/profile/profile";

export const PROFILE_DOC = "profile.local";

/** A link as stored: label and address only (mark and `rel="me"` are recomputed on read). */
export interface ProfileLinkInput {
  label: string;
  href: string;
}

/** The changed fields. Absent = the server's value. `""` = cleared on purpose (not `name`). */
export interface ProfileFields {
  name?: string;
  headline?: string;
  location?: string;
  bio?: string;
  /** The whole list (never merged by index: the owner may reorder or add links). */
  links?: ProfileLinkInput[];
}

export interface ProfileLocalDoc {
  v: 1;
  fields: ProfileFields;
  updatedAt: number;
  syncedAt?: number;
}

const linkSchema = z
  .object({
    label: z.string().min(1).max(PROFILE_MAX.linkLabel),
    href: z.string().max(PROFILE_MAX.linkHref),
  })
  .strict();

const fieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(PROFILE_MAX.name).optional(),
    headline: z.string().max(PROFILE_MAX.headline).optional(),
    location: z.string().max(PROFILE_MAX.location).optional(),
    bio: z.string().max(PROFILE_MAX.bio).optional(),
    links: z.array(linkSchema).max(PROFILE_MAX.links).optional(),
  })
  .strict();

const time = z.number().int().nonnegative();
const docSchema = z
  .object({
    v: z.literal(1),
    fields: fieldsSchema,
    updatedAt: time,
    syncedAt: time.optional(),
  })
  .strict();

export const emptyProfileDoc = (): ProfileLocalDoc => ({
  v: 1,
  fields: {},
  updatedAt: 0,
});

/** The stored doc, or the empty one when missing or not valid (never rewritten on read). */
export function parseProfileDoc(raw: unknown): ProfileLocalDoc {
  const parsed = docSchema.safeParse(raw);
  return parsed.success ? (parsed.data as ProfileLocalDoc) : emptyProfileDoc();
}

/** Stored links, checked again: `https:` only, described from their host. */
const toLinks = (links: ProfileLinkInput[]) =>
  links.flatMap(({ label, href }) => {
    const safe = safeLinkHref(href);
    return safe ? [describeLink(label.trim(), safe)] : [];
  });

const sameLinks = (a: ProfileLinkInput[], b: ProfileLinkInput[]) =>
  a.length === b.length &&
  a.every((l, i) => l.label === b[i].label && l.href === b[i].href);

/**
 * The fields that still differ from `base` (an override equal to the server's value is no
 * override: it drops out here, in memory only). Empty object = nothing to override.
 */
export function effectiveFields(
  base: Profile,
  fields: ProfileFields | null | undefined,
): ProfileFields {
  if (!fields) return {};
  const out: ProfileFields = {};
  for (const key of ["name", "headline", "location", "bio"] as const) {
    const value = fields[key];
    if (value !== undefined && value !== base[key]) out[key] = value;
  }
  if (fields.links && !sameLinks(fields.links, base.links))
    out.links = fields.links;
  return out;
}

/** `base` with the visitor's changes on top: what their screen shows. */
export function applyProfileOverride(
  base: Profile,
  fields: ProfileFields | null | undefined,
): Profile {
  const own = effectiveFields(base, fields);
  if (Object.keys(own).length === 0) return base;
  return {
    ...base,
    ...(own.name !== undefined ? { name: own.name } : {}),
    ...(own.headline !== undefined ? { headline: own.headline } : {}),
    ...(own.location !== undefined ? { location: own.location } : {}),
    ...(own.bio !== undefined ? { bio: own.bio } : {}),
    ...(own.links ? { links: toLinks(own.links) } : {}),
  };
}

/** What the edit form posts: text fields and the links' addresses, in the shown order. */
export interface ProfileEdit {
  name: string;
  headline: string;
  location: string;
  bio: string;
  /** Per shown link, its new address; `""` removes it. */
  linkHrefs: string[];
}

/** A form value that is not valid (the form shows it; nothing is saved). */
export type ProfileEditError = "name" | `links.${number}`;

/**
 * The changes from `opened` (the profile as the form showed it, override included), compared
 * field by field against THAT, not the doc: a form left open in another tab cannot undo this
 * tab's edits to other fields. Returns the fields to merge, or the first invalid field.
 */
export function diffProfile(
  opened: Profile,
  edit: ProfileEdit,
): { fields: ProfileFields } | { error: ProfileEditError } {
  const name = edit.name.trim().slice(0, PROFILE_MAX.name);
  if (!name) return { error: "name" };
  const fields: ProfileFields = {};
  if (name !== opened.name) fields.name = name;
  const text = (key: "headline" | "location" | "bio") => {
    const value = edit[key].trim().slice(0, PROFILE_MAX[key]);
    if (value !== opened[key]) fields[key] = value;
  };
  text("headline");
  text("location");
  text("bio");
  const links: ProfileLinkInput[] = [];
  for (const [i, link] of opened.links.entries()) {
    const raw = (edit.linkHrefs[i] ?? link.href).trim();
    if (!raw) continue; // cleared: removed
    const href = safeLinkHref(raw);
    if (!href) return { error: `links.${i}` };
    links.push({ label: link.label, href });
  }
  const before = opened.links.map(({ label, href }) => ({ label, href }));
  if (!sameLinks(links, before)) fields.links = links;
  return { fields };
}

/** A stamp that never goes back, even if the clock does (as presence). */
const stamp = (doc: ProfileLocalDoc, now: number) =>
  Math.max(now, doc.updatedAt + 1);

/** Saves `changes` over the doc's fields; the same doc back when nothing changed. */
export function mergeProfileFields(
  doc: ProfileLocalDoc,
  changes: ProfileFields,
  now: number,
): ProfileLocalDoc {
  if (Object.keys(changes).length === 0) return doc;
  return {
    ...doc,
    fields: { ...doc.fields, ...changes },
    updatedAt: stamp(doc, now),
  };
}

/** Reset (`{}`) or Undo (the fields captured before): a new stamp either way, so it syncs. */
export function replaceProfileFields(
  doc: ProfileLocalDoc,
  fields: ProfileFields,
  now: number,
): ProfileLocalDoc {
  return { ...doc, fields: { ...fields }, updatedAt: stamp(doc, now) };
}

/** What admin's dispatcher would send: the one record, or nothing. */
export const pendingProfile = (doc: ProfileLocalDoc): ProfileLocalDoc | null =>
  doc.updatedAt > (doc.syncedAt ?? 0) ? doc : null;

/** After the server confirmed `sent`: synced, unless it changed since. */
export const markProfileSynced = (
  doc: ProfileLocalDoc,
  sent: ProfileLocalDoc | null,
): ProfileLocalDoc =>
  sent && sent.updatedAt === doc.updatedAt
    ? { ...doc, syncedAt: doc.updatedAt }
    : doc;
