import { $ } from "@qwik.dev/core";
import { useSnackbar, type SnackbarConfig } from "@seanperez/ui";
/**
 * What the Contacts UI does with the local book (2026-11-24): every write goes through
 * `changeBook` (lock, save, announce, sync seam) and the result goes into the layout's state, so
 * this tab shows it at once. Browser only (handlers).
 */
import { CONTACT_LABELS, IMPORTED_LABEL_ID } from "../content/contacts";
import { downloadText, toCsv, toVCard } from "./export";
import type { LocalBookState } from "./local-context";
import { changeBook, type BookChange } from "./local-book-store";
import {
  ensureSiteOverrides,
  siteOverride,
  type LocalBook,
  type LocalContact,
  type SiteBase,
} from "./local-book";

/** Runs a change and shows its result in this tab. */
export async function commit<T = undefined>(
  state: LocalBookState,
  next: (book: LocalBook, now: number) => { book: LocalBook; result?: T },
): Promise<BookChange<T>> {
  const change = await changeBook(next);
  state.book.value = change.book;
  state.ready.value = true;
  return change;
}

/** The site's labels a visitor's contact can carry (Imported is worked out, never set). */
export const SITE_LABELS = CONTACT_LABELS.filter(
  (l) => l.id !== IMPORTED_LABEL_ID,
).map(({ id, name }) => ({ id, name }));

/** Every label a local contact can carry: the site's, then the visitor's A-Z. */
export const assignableLabels = (book: LocalBook) => [
  ...SITE_LABELS,
  ...[...book.labels]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ id, name }) => ({ id, name })),
];

/** A label id's name, the site's or the visitor's. */
export const labelNamer = (book: LocalBook) => {
  const names = new Map(
    [...CONTACT_LABELS, ...book.labels].map((l) => [l.id, l.name]),
  );
  return (id: string) => names.get(id);
};

/** Downloads `contacts` as a vCard or a CSV file (nothing leaves the browser). */
export function exportContacts(
  contacts: LocalContact[],
  book: LocalBook,
  format: "vcard" | "csv",
): void {
  const name = labelNamer(book);
  // The visitor's own date (`toISOString` is UTC: a day ahead in the evening west of it).
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (format === "vcard")
    downloadText(`contacts-${day}.vcf`, "text/vcard", toVCard(contacts, name));
  else downloadText(`contacts-${day}.csv`, "text/csv", toCsv(contacts, name));
}

export const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Row keys (a site contact's id, or `local/<id>`) to the local records a change applies to: a
 * site contact gets its override first (`ensureSiteOverrides`; owner, 2026-11-24: visitors may
 * edit or delete the site's contacts in their own browser). Run inside a `commit`.
 */
export function targetsOf(
  book: LocalBook,
  keys: string[],
  bases: SiteBase[],
  now: number,
): { book: LocalBook; ids: string[] } {
  const siteKeys = keys.filter((k) => !k.startsWith("local/"));
  const next = ensureSiteOverrides(
    book,
    bases.filter((b) => siteKeys.includes(b.siteId)),
    now,
    () => crypto.randomUUID(),
  );
  const ids = keys
    .map((k) =>
      k.startsWith("local/") ? k.slice(6) : siteOverride(next, k)?.id,
    )
    .filter((id): id is string => !!id);
  return { book: next, ids };
}

/** A site contact as a record, for an export before the visitor changed it. */
export const baseRecord = (b: SiteBase): LocalContact => ({
  id: b.siteId,
  siteId: b.siteId,
  name: b.name,
  organization: "",
  title: b.title,
  phones: [],
  emails: [],
  labels: b.labels,
  notes: "",
  source: "site",
  createdAt: 0,
  updatedAt: 0,
});

/**
 * The Contacts app's snackbar: the library's `showSnackbar$`, but a new message REPLACES the one
 * showing instead of queueing behind it. The library keeps a snackbar with an action until it is
 * used (M3 accessibility, `snackbar.md`), so an unanswered "Undo" would hold back every later
 * message; a newer change makes the old Undo stale anyway (Gmail does the same). Its Close button
 * and the Trash stay the way back.
 */
export function useContactsSnackbar() {
  const { showSnackbar$, closeSnackbar$ } = useSnackbar();
  const show$ = $(async (config: SnackbarConfig) => {
    await closeSnackbar$();
    return showSnackbar$(config);
  });
  return { showSnackbar$: show$ };
}
