/**
 * Contact SEARCH, shared by the Contacts list pane (`routes/contacts/layout.tsx`, `?q=`) and the
 * app bar's search when it is scoped to Contacts (`components/site-search.tsx`), so both match
 * the same rows the same way (second agent, 2026-11-24). Client-safe and pure.
 *
 * Runs in the BROWSER over the visitor's local book plus the site's public contacts: the query is
 * never sent to the server in Contacts (the visitor's own contacts exist only in their browser;
 * memory `local-first-no-sync-on-site`).
 */
import type { AvatarPresence, IconName } from "@seanperez/ui";
import { findAccount } from "../content/accounts";
import { CONTACTS, IMPORTED_LABEL_ID, contactHref } from "../content/contacts";
import { phoneDigits } from "./imported";
import {
  ownContacts,
  siteOverride,
  type LocalBook,
  type LocalContact,
} from "./local-book";
import { localContactHref, localRowKey } from "./local-context";

/** One list row: a site contact or one of the visitor's. */
export interface BookRow {
  key: string;
  href: string;
  name: string;
  supporting: string;
  seed: string;
  presence?: AvatarPresence;
  icon?: IconName;
  /** A local photo (`photo.ts`). */
  photo?: string;
  /** Lowercased text the search matches (emails too: the visitor's own data). */
  haystack: string;
  /** Phone digits, for a search typed as a number. */
  digits: string;
  /** The visitor's own contact; none for a site contact. */
  localId?: string;
  /** A site contact (its override, if any, is applied). */
  siteId?: string;
  labels: string[];
  /** Imported into this browser (the Imported label's members). */
  imported?: boolean;
  /** Starred ("Add to favorites"): the row's star action shows it (2026-11-25). */
  starred?: boolean;
}

/** A visitor's contact as a row. */
export const localRow = (c: LocalContact): BookRow => {
  const work = [c.title, c.organization].filter(Boolean).join(", ");
  return {
    key: localRowKey(c.id),
    href: localContactHref(c.id),
    name: c.name,
    supporting: work || c.emails[0]?.value || c.phones[0]?.value || "",
    seed: c.id,
    photo: c.photo,
    haystack: [c.name, c.organization, c.title, ...c.emails.map((e) => e.value)]
      .join(" ")
      .toLowerCase(),
    digits: c.phones.map((p) => phoneDigits(p.value)).join(" "),
    localId: c.id,
    labels: c.labels,
    imported: c.source === "import",
    starred: !!c.starred,
  };
};

/** What a site contact is before the visitor's override: its name, line and labels. */
export interface SiteContactBase {
  id: string;
  name: string;
  /** The line under the name (the headline, else the location). */
  line: string;
  seed: string;
  presence?: AvatarPresence;
  icon?: IconName;
  labels: string[];
}

/**
 * A site contact as a row, with the visitor's override applied; `null` when they deleted it
 * (in their Trash, or deleted forever).
 */
export function siteRow(row: SiteContactBase, book: LocalBook): BookRow | null {
  if (book.hiddenSite.includes(row.id)) return null;
  const o = siteOverride(book, row.id);
  if (o?.deletedAt !== undefined) return null;
  const name = o?.name ?? row.name;
  const work = o
    ? [o.title, o.organization].filter(Boolean).join(", ")
    : row.line;
  return {
    key: row.id,
    href: contactHref(row.id),
    name,
    supporting: work,
    seed: row.seed,
    presence: row.presence,
    icon: row.icon,
    photo: o?.photo,
    haystack: [name, work, row.line, ...(o?.emails ?? []).map((e) => e.value)]
      .join(" ")
      .toLowerCase(),
    digits: (o?.phones ?? []).map((p) => phoneDigits(p.value)).join(" "),
    siteId: row.id,
    labels: o?.labels ?? row.labels,
    starred: !!o?.starred,
  };
}

/**
 * The site's contacts from the client-safe account records (the app bar has no route loader; the
 * owner's name there is the account's, which the profile may have changed: the list pane uses
 * the loader's).
 */
export const siteContactBases = (): SiteContactBase[] =>
  CONTACTS.map((entry) => {
    const account = findAccount(entry.accountId);
    return {
      id: entry.id,
      name: account?.name ?? entry.id,
      line: account?.headline ?? "",
      seed: entry.seed,
      presence: entry.presence,
      icon: entry.kind === "app" ? account?.icon : undefined,
      labels: entry.labels,
    };
  });

/** Every live row, A-Z: the site's (overrides applied) and the visitor's. */
export const allRows = (bases: SiteContactBase[], book: LocalBook): BookRow[] =>
  [
    ...bases.flatMap((b) => siteRow(b, book) ?? []),
    ...ownContacts(book).map(localRow),
  ].sort((a, b) => a.name.localeCompare(b.name));

/**
 * e-store's `filterContacts`: name, then the other visible lines; a query that is mostly a number
 * also matches phone digits ("555 0100" -> "5550100").
 */
export function rowMatches(row: BookRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  const asPhone =
    digits.length >= 3 && digits.length >= q.replace(/\s/g, "").length - 2;
  return row.haystack.includes(q) || (asPhone && row.digits.includes(digits));
}

/** The row is in the label (`imported` is worked out, never stored). */
export const rowInLabel = (row: BookRow, labelId: string) =>
  labelId === IMPORTED_LABEL_ID ? !!row.imported : row.labels.includes(labelId);

/**
 * The matches for `query`; on a label's page the label's own first (owner, 2026-11-24: "when its
 * in a specific route it should prioritize that label"). `inLabel` counts the first part.
 */
export function searchRows(
  rows: BookRow[],
  query: string,
  labelId: string | null,
): { rows: BookRow[]; inLabel: number } {
  const hits = rows.filter((r) => rowMatches(r, query));
  if (!labelId) return { rows: hits, inLabel: 0 };
  const first = hits.filter((r) => rowInLabel(r, labelId));
  return {
    rows: [...first, ...hits.filter((r) => !rowInLabel(r, labelId))],
    inLabel: first.length,
  };
}

/** `/contacts/label/<id>/` -> the label id (not Create label's `new`); else null. */
export const labelOfPath = (pathname: string): string | null => {
  const id = /^\/contacts\/label\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null;
  return id && id !== "new" ? id : null;
};
