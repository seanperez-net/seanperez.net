/**
 * The local contact book's STORAGE (2026-11-24; was `imported-store.ts`, imported contacts only):
 * one JSON document, `contacts.local`, in THIS browser (`local-store.ts`: OPFS, else IndexedDB),
 * never sent anywhere. Every change goes through the shared seam `changeLocalDoc`
 * (`local-store.ts`): read-change-write under a Web Lock, announced to the other open tabs
 * (`onBookChange`), then handed to the ONE sync dispatcher by name.
 *
 * THE SYNC SEAM (owner, 2026-11-24: "local changes should get saved locally and then from the
 * service worker dispatched as a sync but we are cutting that part out of this website"). The
 * public site sets NO dispatcher: nothing is posted, fetched or registered. What would be sent
 * is always `pendingChanges(book)` (`local-book.ts`, listed in `sync-docs.ts`). Generalised to
 * every feature 2026-11-24 (`.claude/notes/local-first-seam-audit-2026-11-24.md`).
 *
 * Browser only: call from handlers and browser tasks, never while rendering.
 */
import {
  askPersistentStorage,
  changeLocalDoc,
  onLocalDocChange,
  readLocalDoc,
  writeLocalDoc,
  type DocChange,
} from "../local-store";
import {
  bookFromImported,
  expireTrash,
  parseBook,
  type LocalBook,
} from "./local-book";

export const CONTACTS_DOC = "contacts.local";
const DOC = CONTACTS_DOC;
/** The first version's document (imported contacts only); read once, then removed. */
const OLD_DOC = "contacts.imported";

/** The book as stored, with the Trash's 30 days applied (saved with the next change). */
export async function loadBook(now = Date.now()): Promise<LocalBook> {
  const raw = await readLocalDoc(DOC);
  if (raw !== null && raw !== undefined)
    return expireTrash(parseBook(raw), now);
  const old = await readLocalDoc(OLD_DOC);
  return expireTrash(bookFromImported(old, now), now);
}

/** What a change did; `saved` false = kept in this page only (no storage, or quota). */
export interface BookChange<T = undefined> {
  book: LocalBook;
  saved: boolean;
  result: T;
}

/**
 * Runs `next` on the stored book under the lock, saves, announces and dispatches the result.
 * `next` may throw (a full book, an empty name): nothing is saved then.
 */
export async function changeBook<T = undefined>(
  next: (book: LocalBook, now: number) => { book: LocalBook; result?: T },
): Promise<BookChange<T>> {
  const change: DocChange<LocalBook, T> = await changeLocalDoc(
    DOC,
    loadBook,
    (book, now) => {
      const out = next(book, now);
      return { doc: out.book, result: out.result };
    },
  );
  // The old document is read only while the new one is missing; once saved it can go.
  if (change.saved) await writeLocalDoc(OLD_DOC, null);
  return { book: change.doc, saved: change.saved, result: change.result };
}

/** After the visitor first saved something they would miss: ask the browser to keep it. */
export const keepStorage = () => void askPersistentStorage();

/** Calls `fn` when another tab changed the book; returns the unsubscribe. */
export const onBookChange = (fn: () => void) => onLocalDocChange(DOC, fn);
