/**
 * THE VISITOR'S OWN CONTACT BOOK, in their browser only (owner, 2026-11-24: "the functionality
 * should work the same just on the clients side ... local changes should get saved locally and
 * then from the service worker dispatched as a sync but we are cutting that part out of this
 * website just leaving the local part"). Plain TS, no Qwik, no storage, no clock: every change is
 * a pure function of the book and `now`, so the page, a test or a future service worker can run
 * it. `local-book-store.ts` reads, locks, writes and announces.
 *
 * What it holds: the contacts the visitor CREATED or IMPORTED (`LocalContact`), their LABELS
 * (`LocalLabel`) and the sync seam (`syncedAt`, `tombstones`).
 *
 * THE SITE'S OWN CONTACTS (the owner, the Assistant) come from the server and are never changed.
 * OWNER DECISION 2026-11-24: "they can break it on their end if they want but there should be no
 * way of breaking it ... if they want to delete them they can but the contact thing is still going
 * to be there". So a visitor's edit, label or delete of one is a LOCAL OVERRIDE: a `LocalContact`
 * with `siteId` (source `site`), made from the site's data on the first change, shown INSTEAD of
 * the site's row. Deleting it moves the override to the Trash (Recover); "Delete forever" hides the
 * site contact (`hiddenSite`), and the Trash's "Restore" or the contact page bring it back;
 * "Reset to the site's version" drops the override. The site's data, the profile page's résumé and
 * the "Contact me" companion (the server profile) are untouched whatever is in this book. (The
 * second agent and I had recommended read-only built-ins; the owner chose the override.)
 *
 * SYNC SEAM (second agent, 2026-11-24; e-store `packages/pwa/src/outbox.ts`: "the group always
 * holds the CURRENT difference ... one op per row, never a history"). No op log: a record is
 * PENDING while `updatedAt > (syncedAt ?? 0)`, and "Delete forever" of a record the server has
 * seen (`syncedAt` set) leaves a TOMBSTONE. On the public site nothing ever syncs, so nothing has a
 * `syncedAt`, the tombstones stay empty and the pending set is just the live records (bounded by
 * `MAX_IMPORTED` and `MAX_LABELS`). The admin app's dispatcher (PLAN.md "apps/admin", CONTACTS
 * SAVE) sends `pendingChanges(book)` and calls `markSynced`.
 *
 * Trash is a field (`deletedAt`), not a second list; Google's 30 days (`TRASH_DAYS`) are applied
 * whenever the book is read (`expireTrash`).
 */
import { z } from "zod";
import {
  MAX_FIELD,
  MAX_IMPORTED,
  MAX_NOTES,
  MAX_VALUES,
  cleanLabels,
  cleanLine,
  cleanText,
  cleanValues,
  phoneDigits,
  sameContactKey,
  type ImportedContact,
  type LabelledValue,
} from "./imported";
import { safeLinkHref } from "@seanperez/db/profile/profile";

/** Trash retention, as Google's (30 days, its help article S1). */
export const TRASH_DAYS = 30;
const DAY_MS = 86_400_000;
/** Labels one browser keeps. */
export const MAX_LABELS = 100;
export const MAX_LABEL_NAME = 60;
/** Tombstones kept (only ever written once a record was synced: the admin app). */
const MAX_TOMBSTONES = 5000;

/** Local label ids carry this prefix, so a route can tell one from a site label (`work`). */
export const LOCAL_LABEL_PREFIX = "l-";
/** A stored photo's longest data URL (`photo.ts` makes 256px JPEGs of about 15-40 KB). */
export const MAX_PHOTO = 200_000;
const PHOTO_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

/**
 * A LINKED PROFILE (2026-11-25, Google's PROFILE source; `.claude/notes/
 * contacts-google-parity-2026-11-25.md`): the person's own profile, shown read-only in the
 * contact's "Profile" card. Either one of the site's accounts that has a profile (today the
 * owner's: his résumé), or a profile ADDRESS anywhere (`https:` only, `safeLinkHref`; never
 * fetched). Google links a contact to a profile by a verified email, phone or profile URL; here
 * the visitor links it by hand, in their browser.
 */
export type LinkedProfile = { account: string } | { href: string };

/** The longest profile address kept. */
export const MAX_PROFILE_HREF = 500;

export const isLocalLabelId = (id: string) => /^l-[\w-]{1,64}$/.test(id);

export interface LocalContact {
  /** Ours (`crypto.randomUUID`), never taken from a file. */
  id: string;
  name: string;
  organization: string;
  title: string;
  phones: LabelledValue[];
  emails: LabelledValue[];
  /** `LocalLabel` ids, and site label ids (`work`). */
  labels: string[];
  notes: string;
  source: "import" | "created" | "site";
  /** An override of this SITE contact (`content/contacts.ts` `CONTACTS`). */
  siteId?: string;
  /** Google's star ("Add to favorites", 2026-11-24). */
  starred?: boolean;
  /**
   * The contact's photo, chosen in THIS browser (2026-11-24, the avatar's "+"): a small JPEG data
   * URL made by `photo.ts` (at most `MAX_PHOTO` characters). Never uploaded.
   */
  photo?: string;
  /** Their own profile, linked in this browser (`LinkedProfile`). */
  profile?: LinkedProfile;
  /**
   * Milliseconds since the epoch. `updatedAt` is the SYNC clock: every change moves it (an edit,
   * a star, a label, a photo, the Trash), as Google's `metadata.sources[].updateTime`.
   */
  createdAt: number;
  updatedAt: number;
  /**
   * When the contact ITSELF was last edited: its fields, photo or linked profile, a merge, its
   * creation. A star, a label or the Trash do not set it. The person page's "Last edited" (owner,
   * 2026-11-25: a separate `editedAt`, not Google's `updateTime`). Absent on a site contact's
   * override made by a star or a label only, and on records saved before 2026-11-25 (then
   * `createdAt` stands in for the visitor's own contacts: `lastEdited`).
   */
  editedAt?: number;
  /** In the Trash since then. */
  deletedAt?: number;
  /** The server confirmed the record as it was at this `updatedAt` (admin app only). */
  syncedAt?: number;
}

export interface LocalLabel {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

/** A record deleted forever after the server had it: the server still has to delete it. */
export interface Tombstone {
  kind: "contact" | "label";
  id: string;
  at: number;
}

export interface LocalBook {
  v: 2;
  contacts: LocalContact[];
  labels: LocalLabel[];
  tombstones: Tombstone[];
  /** Site contacts the visitor deleted forever (hidden until restored). */
  hiddenSite: string[];
}

export const emptyBook = (): LocalBook => ({
  v: 2,
  contacts: [],
  labels: [],
  tombstones: [],
  hiddenSite: [],
});

// ─── Reading stored data (untrusted: another version of the site, or the visitor, wrote it) ──

const valueSchema = z.object({
  label: z.string().max(40),
  value: z.string().max(200),
});
const time = z.number().int().nonnegative();
const contactSchema = z.object({
  id: z.string().regex(/^[\w-]{1,64}$/),
  name: z.string().min(1).max(MAX_FIELD),
  organization: z.string().max(MAX_FIELD),
  title: z.string().max(MAX_FIELD),
  phones: z.array(valueSchema).max(MAX_VALUES),
  emails: z.array(valueSchema).max(MAX_VALUES),
  labels: z.array(z.string().max(70)).max(MAX_LABELS),
  notes: z.string().max(MAX_NOTES),
  source: z.enum(["import", "created", "site"]),
  siteId: z
    .string()
    .regex(/^[\w-]{1,64}$/)
    .optional(),
  starred: z.boolean().optional(),
  photo: z.string().max(MAX_PHOTO).regex(PHOTO_RE).optional(),
  profile: z
    .union([
      z.object({ account: z.string().regex(/^[\w-]{1,64}$/) }).strict(),
      z
        .object({
          href: z
            .string()
            .max(MAX_PROFILE_HREF)
            .refine((h) => safeLinkHref(h) === h),
        })
        .strict(),
    ])
    .optional(),
  createdAt: time,
  updatedAt: time,
  editedAt: time.optional(),
  deletedAt: time.optional(),
  syncedAt: time.optional(),
});
const labelSchema = z.object({
  id: z.string().regex(/^l-[\w-]{1,64}$/),
  name: z.string().min(1).max(MAX_LABEL_NAME),
  createdAt: time,
  updatedAt: time,
  syncedAt: time.optional(),
});
const tombstoneSchema = z.object({
  kind: z.enum(["contact", "label"]),
  id: z.string().max(70),
  at: time,
});

/** Each entry checked on its own: one bad record never loses the others. */
function each<T>(raw: unknown, schema: z.ZodType<T>, max: number): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const entry of raw) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
    if (out.length === max) break;
  }
  return out;
}

/** A stored book back to data: invalid entries dropped, caps kept, unknown label ids removed. */
export function parseBook(raw: unknown): LocalBook {
  if (!raw || typeof raw !== "object") return emptyBook();
  const r = raw as Record<string, unknown>;
  const labels = each(r.labels, labelSchema, MAX_LABELS);
  return {
    v: 2,
    contacts: each(r.contacts, contactSchema, MAX_IMPORTED),
    labels,
    tombstones: each(r.tombstones, tombstoneSchema, MAX_TOMBSTONES),
    hiddenSite: each(r.hiddenSite, z.string().regex(/^[\w-]{1,64}$/), 50),
  };
}

/**
 * The first version's document (`contacts.imported`, 2026-11-24: an array of imported contacts
 * with label NAMES and an ISO `importedAt`) as a book. Read once, when the book does not exist yet.
 */
export function bookFromImported(raw: unknown, now: number): LocalBook {
  if (!Array.isArray(raw)) return emptyBook();
  let book = emptyBook();
  const contacts: ImportedContact[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.name !== "string") continue;
    contacts.push({
      id: e.id,
      name: e.name,
      organization: String(e.organization ?? ""),
      title: String(e.title ?? ""),
      phones: Array.isArray(e.phones) ? (e.phones as LabelledValue[]) : [],
      emails: Array.isArray(e.emails) ? (e.emails as LabelledValue[]) : [],
      labels: Array.isArray(e.labels) ? (e.labels as string[]) : [],
      notes: String(e.notes ?? ""),
      importedAt: String(e.importedAt ?? ""),
    });
  }
  book = addImportedContacts(book, contacts, now, () =>
    crypto.randomUUID(),
  ).book;
  return parseBook(book);
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export const liveContacts = (book: LocalBook) =>
  book.contacts.filter((c) => c.deletedAt === undefined);

/** The visitor's own live contacts (not overrides of site contacts). */
export const ownContacts = (book: LocalBook) =>
  liveContacts(book).filter((c) => !c.siteId);

/** The override of a site contact, live or in the Trash, if the visitor made one. */
export const siteOverride = (book: LocalBook, siteId: string) =>
  book.contacts.find((c) => c.siteId === siteId);

/** What a site contact starts its override from. */
export interface SiteBase {
  siteId: string;
  name: string;
  /** The site's headline, kept as the job title. */
  title: string;
  labels: string[];
}

/** Makes an override for each site contact that has none (the first local change to it). */
export function ensureSiteOverrides(
  book: LocalBook,
  bases: SiteBase[],
  now: number,
  newId: () => string,
): LocalBook {
  const add: LocalContact[] = [];
  for (const b of bases) {
    if (siteOverride(book, b.siteId)) continue;
    add.push({
      id: newId(),
      siteId: b.siteId,
      name: cleanLine(b.name) || b.siteId,
      organization: "",
      title: cleanLine(b.title),
      phones: [],
      emails: [],
      labels: [...b.labels],
      notes: "",
      source: "site",
      createdAt: now,
      updatedAt: now,
    });
  }
  return add.length ? { ...book, contacts: [...book.contacts, ...add] } : book;
}

/**
 * The person page's "Last edited" (`editedAt`): when the contact itself last changed. A star, a
 * label or the Trash do not count. The visitor's own contacts saved before `editedAt` existed fall
 * back to `createdAt`; a site contact's override with no edit has none (`undefined`).
 */
export const lastEdited = (c: LocalContact): number | undefined =>
  c.editedAt ?? (c.source === "site" ? undefined : c.createdAt || undefined);

/** Shows site contacts deleted forever again ("Restore"). */
export const restoreSite = (book: LocalBook, siteIds: string[]): LocalBook => ({
  ...book,
  hiddenSite: book.hiddenSite.filter((id) => !siteIds.includes(id)),
});

/** "Reset to the site's version": the override is dropped and the contact shown again. */
export function resetSite(
  book: LocalBook,
  siteId: string,
  now: number,
): LocalBook {
  const gone = book.contacts.filter((c) => c.siteId === siteId);
  return {
    ...restoreSite(book, [siteId]),
    contacts: book.contacts.filter((c) => c.siteId !== siteId),
    tombstones: bury(book, "contact", gone, now),
  };
}

/** The Trash, most recently deleted first. */
export const trashedContacts = (book: LocalBook) =>
  book.contacts
    .filter((c) => c.deletedAt !== undefined)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

/** Whole days before a trashed contact is deleted for good (e-store's `trashDaysLeft`). */
export function trashDaysLeft(contact: LocalContact, now: number): number {
  if (contact.deletedAt === undefined) return TRASH_DAYS;
  const left = TRASH_DAYS - Math.floor((now - contact.deletedAt) / DAY_MS);
  return Math.max(0, left);
}

/** What the admin app's dispatcher would send. Empty on the site only in the sense that nothing reads it. */
export function pendingChanges(book: LocalBook) {
  const pending = <T extends { updatedAt: number; syncedAt?: number }>(r: T) =>
    r.updatedAt > (r.syncedAt ?? 0);
  return {
    contacts: book.contacts.filter(pending),
    labels: book.labels.filter(pending),
    tombstones: book.tombstones,
  };
}

/**
 * After the server confirmed `sent` (admin app): each record still at the `updatedAt` that was
 * sent is marked synced; one changed since stays pending (e-store: "removes only a record still
 * at this stamp"). The tombstones sent are dropped.
 */
export function markSynced(
  book: LocalBook,
  sent: ReturnType<typeof pendingChanges>,
): LocalBook {
  const stamp = new Map<string, number>();
  for (const c of sent.contacts) stamp.set(`c:${c.id}`, c.updatedAt);
  for (const l of sent.labels) stamp.set(`l:${l.id}`, l.updatedAt);
  const sentGone = new Set(sent.tombstones.map((t) => `${t.kind}:${t.id}`));
  return {
    ...book,
    contacts: book.contacts.map((c) =>
      stamp.get(`c:${c.id}`) === c.updatedAt
        ? { ...c, syncedAt: c.updatedAt }
        : c,
    ),
    labels: book.labels.map((l) =>
      stamp.get(`l:${l.id}`) === l.updatedAt
        ? { ...l, syncedAt: l.updatedAt }
        : l,
    ),
    tombstones: book.tombstones.filter(
      (t) => !sentGone.has(`${t.kind}:${t.id}`),
    ),
  };
}

// ─── Changes (pure: book in, book out) ───────────────────────────────────────

/** Records gone for good: a tombstone only for one the server had (`syncedAt`). */
function bury(
  book: LocalBook,
  kind: Tombstone["kind"],
  gone: { id: string; syncedAt?: number }[],
  now: number,
): Tombstone[] {
  const add = gone
    .filter((r) => r.syncedAt !== undefined)
    .map((r) => ({ kind, id: r.id, at: now }));
  return add.length
    ? [...book.tombstones, ...add].slice(-MAX_TOMBSTONES)
    : book.tombstones;
}

/** The Trash's 30 days, applied on read. The same book when nothing expired. */
export function expireTrash(book: LocalBook, now: number): LocalBook {
  const cutoff = now - TRASH_DAYS * DAY_MS;
  const gone = book.contacts.filter(
    (c) => c.deletedAt !== undefined && c.deletedAt <= cutoff,
  );
  if (!gone.length) return book;
  const ids = new Set(gone.map((c) => c.id));
  return {
    ...book,
    contacts: book.contacts.filter((c) => !ids.has(c.id)),
    tombstones: bury(book, "contact", gone, now),
  };
}

/** What the editor saves. */
export interface ContactInput {
  name: string;
  organization: string;
  title: string;
  phones: LabelledValue[];
  emails: LabelledValue[];
  notes: string;
  labels?: string[];
}

export type ContactErrors = Partial<
  Record<"name" | "emails" | "phones", string>
>;

// Deliberately loose (e-store `contacts.ts`): the mail server is the real check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-.\s\d]{3,}$/;

/** A contact needs a name, a company, a phone or an email (as an import); values must look right. */
export function validateContactInput(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  const phones = input.phones.filter((p) => p.value.trim());
  const emails = input.emails.filter((e) => e.value.trim());
  if (
    !input.name.trim() &&
    !input.organization.trim() &&
    !phones.length &&
    !emails.length
  )
    errors.name = "Enter a name, a company, a phone or an email";
  if (emails.some((e) => !EMAIL_RE.test(e.value.trim())))
    errors.emails = "Enter a valid email";
  if (phones.some((p) => !PHONE_RE.test(p.value.trim())))
    errors.phones = "Enter a valid phone number";
  return errors;
}

/** The input cleaned as an import is (`imported.ts`); the name falls back as an import's does. */
function cleanInput(input: ContactInput, labelIds: Set<string>) {
  const phones = cleanValues(input.phones);
  const emails = cleanValues(input.emails);
  const organization = cleanLine(input.organization);
  const name =
    cleanLine(input.name) ||
    organization ||
    phones[0]?.value ||
    emails[0]?.value ||
    "";
  return {
    name,
    organization,
    title: cleanLine(input.title),
    phones,
    emails,
    notes: cleanText(input.notes),
    labels: input.labels
      ? [...new Set(input.labels)].filter(
          (id) => labelIds.has(id) || !isLocalLabelId(id),
        )
      : undefined,
  };
}

const labelIdSet = (book: LocalBook) => new Set(book.labels.map((l) => l.id));

export class BookFullError extends Error {}

export function createContact(
  book: LocalBook,
  input: ContactInput,
  id: string,
  now: number,
): { book: LocalBook; contact: LocalContact } {
  if (book.contacts.length >= MAX_IMPORTED)
    throw new BookFullError(
      `This browser already keeps ${MAX_IMPORTED.toLocaleString("en")} contacts.`,
    );
  const clean = cleanInput(input, labelIdSet(book));
  if (!clean.name) throw new Error("A contact needs a name");
  const contact: LocalContact = {
    id,
    ...clean,
    labels: clean.labels ?? [],
    source: "created",
    createdAt: now,
    updatedAt: now,
    editedAt: now,
  };
  return { book: { ...book, contacts: [...book.contacts, contact] }, contact };
}

/** Changes a live contact; `null` when it is gone or in the Trash. */
export function updateContact(
  book: LocalBook,
  id: string,
  input: ContactInput,
  now: number,
): { book: LocalBook; contact: LocalContact | null } {
  const current = book.contacts.find((c) => c.id === id);
  if (!current || current.deletedAt !== undefined)
    return { book, contact: null };
  const clean = cleanInput(input, labelIdSet(book));
  if (!clean.name) return { book, contact: null };
  const contact: LocalContact = {
    ...current,
    ...clean,
    labels: clean.labels ?? current.labels,
    updatedAt: now,
    editedAt: now,
  };
  return {
    book: {
      ...book,
      contacts: book.contacts.map((c) => (c.id === id ? contact : c)),
    },
    contact,
  };
}

const touch = (
  book: LocalBook,
  ids: Set<string>,
  fn: (c: LocalContact) => LocalContact | null,
): LocalBook => ({
  ...book,
  contacts: book.contacts.map((c) => (ids.has(c.id) ? (fn(c) ?? c) : c)),
});

/** Moves live contacts to the Trash. */
export const trashContacts = (book: LocalBook, ids: string[], now: number) =>
  touch(book, new Set(ids), (c) =>
    c.deletedAt === undefined ? { ...c, deletedAt: now, updatedAt: now } : null,
  );

/** Takes contacts out of the Trash (Recover, and Undo of a delete). */
export const recoverContacts = (book: LocalBook, ids: string[], now: number) =>
  touch(book, new Set(ids), (c) => {
    if (c.deletedAt === undefined) return null;
    const rest = { ...c, updatedAt: now };
    delete rest.deletedAt;
    return rest;
  });

/** "Delete forever": only contacts in the Trash. */
export function purgeContacts(
  book: LocalBook,
  ids: string[],
  now: number,
): LocalBook {
  const want = new Set(ids);
  const gone = book.contacts.filter(
    (c) => want.has(c.id) && c.deletedAt !== undefined,
  );
  const goneIds = new Set(gone.map((c) => c.id));
  // An override deleted forever hides its site contact (the site's record is never removed).
  const hide = gone.map((c) => c.siteId).filter((id): id is string => !!id);
  return {
    ...book,
    contacts: book.contacts.filter((c) => !goneIds.has(c.id)),
    tombstones: bury(book, "contact", gone, now),
    hiddenSite: hide.length
      ? [...new Set([...book.hiddenSite, ...hide])]
      : book.hiddenSite,
  };
}

/** "Empty Trash now". */
export const emptyTrash = (book: LocalBook, now: number) =>
  purgeContacts(
    book,
    trashedContacts(book).map((c) => c.id),
    now,
  );

/**
 * Puts records back exactly as they were before a change (Undo of a merge or of a bulk label
 * change), as new edits (`updatedAt` now). A record that was deleted forever meanwhile comes back.
 */
export function restoreContacts(
  book: LocalBook,
  before: LocalContact[],
  now: number,
): LocalBook {
  const byId = new Map(before.map((c) => [c.id, c]));
  const labels = labelIdSet(book);
  const fix = (c: LocalContact): LocalContact => ({
    ...c,
    labels: c.labels.filter((id) => labels.has(id) || !isLocalLabelId(id)),
    updatedAt: now,
  });
  const kept = book.contacts.map((c) =>
    byId.has(c.id) ? fix(byId.get(c.id)!) : c,
  );
  const have = new Set(book.contacts.map((c) => c.id));
  const back = before.filter((c) => !have.has(c.id)).map(fix);
  return {
    ...book,
    contacts: [...kept, ...back].slice(0, MAX_IMPORTED),
    tombstones: book.tombstones.filter(
      (t) => !(t.kind === "contact" && byId.has(t.id)),
    ),
  };
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export const cleanLabelName = (name: string) => cleanLine(name, MAX_LABEL_NAME);

/** A label with this name already (case blind), among `taken` (the site's labels too). */
export const labelNameTaken = (
  name: string,
  taken: string[],
  exceptName = "",
) => {
  const n = cleanLabelName(name).toLowerCase();
  return taken.some(
    (t) =>
      t.toLowerCase() === n && t.toLowerCase() !== exceptName.toLowerCase(),
  );
};

export class LabelError extends Error {}

export function createLabel(
  book: LocalBook,
  name: string,
  id: string,
  now: number,
): { book: LocalBook; label: LocalLabel } {
  const clean = cleanLabelName(name);
  if (!clean) throw new LabelError("Enter a name");
  if (book.labels.length >= MAX_LABELS)
    throw new LabelError(`Up to ${MAX_LABELS} labels`);
  const label: LocalLabel = { id, name: clean, createdAt: now, updatedAt: now };
  return { book: { ...book, labels: [...book.labels, label] }, label };
}

export function renameLabel(
  book: LocalBook,
  id: string,
  name: string,
  now: number,
): LocalBook {
  const clean = cleanLabelName(name);
  if (!clean) throw new LabelError("Enter a name");
  return {
    ...book,
    labels: book.labels.map((l) =>
      l.id === id ? { ...l, name: clean, updatedAt: now } : l,
    ),
  };
}

/** Deletes a label; its contacts stay (Google's "Keep all contacts"), without it. */
export function deleteLabel(
  book: LocalBook,
  id: string,
  now: number,
): LocalBook {
  const gone = book.labels.filter((l) => l.id === id);
  return {
    ...book,
    labels: book.labels.filter((l) => l.id !== id),
    contacts: book.contacts.map((c) =>
      c.labels.includes(id)
        ? { ...c, labels: c.labels.filter((l) => l !== id), updatedAt: now }
        : c,
    ),
    tombstones: bury(book, "label", gone, now),
  };
}

/** Adds (`on`) or removes the label on these contacts; only the ones that change are touched. */
export function setLabel(
  book: LocalBook,
  labelId: string,
  ids: string[],
  on: boolean,
  now: number,
): LocalBook {
  if (isLocalLabelId(labelId) && !labelIdSet(book).has(labelId)) return book;
  return touch(book, new Set(ids), (c) => {
    const has = c.labels.includes(labelId);
    if (has === on) return null;
    return {
      ...c,
      labels: on
        ? [...c.labels, labelId]
        : c.labels.filter((l) => l !== labelId),
      updatedAt: now,
    };
  });
}

/** Stars (Google's "Add to favorites") or unstars one live contact. */
export const setStarred = (
  book: LocalBook,
  id: string,
  starred: boolean,
  now: number,
) =>
  touch(book, new Set([id]), (c) =>
    c.deletedAt !== undefined || !!c.starred === starred
      ? null
      : { ...c, starred: starred || undefined, updatedAt: now },
  );

/** Sets (a `photo.ts` data URL) or removes (`undefined`) one live contact's photo. */
export function setPhoto(
  book: LocalBook,
  id: string,
  photo: string | undefined,
  now: number,
): LocalBook {
  if (
    photo !== undefined &&
    (photo.length > MAX_PHOTO || !PHOTO_RE.test(photo))
  )
    return book;
  return touch(book, new Set([id]), (c) =>
    c.deletedAt !== undefined || c.photo === photo
      ? null
      : { ...c, photo, updatedAt: now, editedAt: now },
  );
}

/**
 * Links `profile` to a live contact, or unlinks it (`undefined`). An address must be `https:` with
 * no user name or password (`safeLinkHref`, the no-email rule: never `mailto:`); anything else
 * leaves the book as it was.
 */
export function setProfile(
  book: LocalBook,
  id: string,
  profile: LinkedProfile | undefined,
  now: number,
): LocalBook {
  let next: LinkedProfile | undefined = profile;
  if (profile && "href" in profile) {
    const href = safeLinkHref(profile.href);
    if (!href || href.length > MAX_PROFILE_HREF) return book;
    next = { href };
  } else if (profile && !/^[\w-]{1,64}$/.test(profile.account)) return book;
  const same = (a?: LinkedProfile, b?: LinkedProfile) =>
    JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return touch(book, new Set([id]), (c) =>
    c.deletedAt !== undefined || same(c.profile, next)
      ? null
      : next
        ? { ...c, profile: next, updatedAt: now, editedAt: now }
        : { ...withoutProfile(c), updatedAt: now, editedAt: now },
  );
}

const withoutProfile = (c: LocalContact): LocalContact => {
  const copy = { ...c };
  delete copy.profile;
  return copy;
};

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ImportOutcome {
  book: LocalBook;
  added: number;
  /** Already in the book (the same name, organization, phones and emails). */
  duplicates: number;
  /** Not added: the book already holds `MAX_IMPORTED`. */
  overCap: number;
}

/** Imported contacts in; the file's label NAMES become labels (created when new, Google's). */
export function addImportedContacts(
  book: LocalBook,
  incoming: ImportedContact[],
  now: number,
  newId: () => string,
  siteLabels: { id: string; name: string }[] = [],
): ImportOutcome {
  const keyOf = (
    c: Pick<LocalContact, "name" | "organization" | "phones" | "emails">,
  ) =>
    sameContactKey({
      ...c,
      id: "",
      title: "",
      labels: [],
      notes: "",
      importedAt: "",
    });
  const keys = new Set(liveContacts(book).map(keyOf));
  const labels = [...book.labels];
  const byName = new Map<string, string>();
  for (const l of siteLabels) byName.set(l.name.toLowerCase(), l.id);
  for (const l of labels) byName.set(l.name.toLowerCase(), l.id);
  const labelId = (name: string): string | null => {
    const clean = cleanLabelName(name);
    if (!clean) return null;
    const known = byName.get(clean.toLowerCase());
    if (known) return known;
    if (labels.length >= MAX_LABELS) return null;
    const id = LOCAL_LABEL_PREFIX + newId();
    labels.push({ id, name: clean, createdAt: now, updatedAt: now });
    byName.set(clean.toLowerCase(), id);
    return id;
  };
  const contacts = [...book.contacts];
  let added = 0;
  let duplicates = 0;
  let overCap = 0;
  for (const c of incoming) {
    const key = keyOf(c);
    if (keys.has(key)) {
      duplicates++;
      continue;
    }
    if (contacts.length >= MAX_IMPORTED) {
      overCap++;
      continue;
    }
    keys.add(key);
    const at = Date.parse(c.importedAt);
    contacts.push({
      id: c.id,
      name: c.name,
      organization: c.organization,
      title: c.title,
      phones: c.phones,
      emails: c.emails,
      labels: cleanLabels(c.labels)
        .map(labelId)
        .filter((id): id is string => !!id),
      notes: c.notes,
      source: "import",
      createdAt: Number.isNaN(at) ? now : at,
      updatedAt: now,
      editedAt: Number.isNaN(at) ? now : at,
    });
    added++;
  }
  return { book: { ...book, contacts, labels }, added, duplicates, overCap };
}

/** Every imported contact gone for good (the Import dialog's "Remove all imported", with Undo). */
export function removeAllImported(book: LocalBook, now: number) {
  const gone = book.contacts.filter((c) => c.source === "import");
  const ids = new Set(gone.map((c) => c.id));
  return {
    gone,
    book: {
      ...book,
      contacts: book.contacts.filter((c) => !ids.has(c.id)),
      tombstones: bury(book, "contact", gone, now),
    },
  };
}

// ─── Merge & fix ─────────────────────────────────────────────────────────────

/** A name as duplicates compare it: case, accents and spacing ignored. */
export const normalName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** A phone as duplicates compare it: its last 10 digits (a country code may be missing), at least 7. */
const phoneKey = (value: string) => {
  const digits = phoneDigits(value);
  return digits.length >= 7 ? digits.slice(-10) : "";
};

/**
 * Groups of live contacts that look like one person (Google's Merge & fix): the same normalised
 * name, email or phone, joined transitively. Each group's first contact is the one kept (the
 * oldest), the rest fold into it.
 */
export function findDuplicates(book: LocalBook): LocalContact[][] {
  // Site contacts' overrides are left out: merging would fold the owner into someone else.
  const live = [...ownContacts(book)].sort((a, b) => a.createdAt - b.createdAt);
  const parent = live.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const seen = new Map<string, number>();
  live.forEach((c, i) => {
    const keys = [
      `n:${normalName(c.name)}`,
      ...c.emails.map((e) => `e:${e.value.trim().toLowerCase()}`),
      ...c.phones
        .map((p) => phoneKey(p.value))
        .filter(Boolean)
        .map((p) => `p:${p}`),
    ].filter((k) => k.length > 2);
    for (const key of keys) {
      const j = seen.get(key);
      if (j === undefined) seen.set(key, i);
      else parent[find(i)] = find(j);
    }
  });
  const groups = new Map<number, LocalContact[]>();
  live.forEach((c, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), c]);
  });
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => a.createdAt - b.createdAt));
}

const joinValues = (lists: LabelledValue[][]) => cleanValues(lists.flat());

/**
 * Folds `ids` into the first of them (kept): phones, emails and labels joined, the first
 * non-empty organization and title, notes joined. The others are DELETED (Google: merged
 * contacts become one); `before` is what Undo puts back (`restoreContacts`).
 */
export function mergeContacts(
  book: LocalBook,
  ids: string[],
  now: number,
): { book: LocalBook; kept: LocalContact | null; before: LocalContact[] } {
  const live = ownContacts(book);
  const group = ids
    .map((id) => live.find((c) => c.id === id))
    .filter((c): c is LocalContact => !!c);
  if (group.length < 2) return { book, kept: null, before: [] };
  const [first, ...rest] = group;
  const kept: LocalContact = {
    ...first,
    name: group.map((c) => c.name).sort((a, b) => b.length - a.length)[0],
    organization: group.find((c) => c.organization)?.organization ?? "",
    title: group.find((c) => c.title)?.title ?? "",
    phones: joinValues(group.map((c) => c.phones)),
    emails: joinValues(group.map((c) => c.emails)),
    labels: [...new Set(group.flatMap((c) => c.labels))],
    notes: cleanText(
      [...new Set(group.map((c) => c.notes).filter(Boolean))].join("\n\n"),
    ),
    starred: group.some((c) => c.starred) || undefined,
    photo: group.find((c) => c.photo)?.photo,
    updatedAt: now,
    editedAt: now,
  };
  const restIds = new Set(rest.map((c) => c.id));
  return {
    kept,
    before: group,
    book: {
      ...book,
      contacts: book.contacts
        .filter((c) => !restIds.has(c.id))
        .map((c) => (c.id === kept.id ? kept : c)),
      tombstones: bury(book, "contact", rest, now),
    },
  };
}
