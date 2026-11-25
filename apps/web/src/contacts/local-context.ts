import { createContextId, type Signal } from "@qwik.dev/core";
import type { CountMap } from "./frequency";
import type { LocalBook } from "./local-book";

/**
 * The visitor's LOCAL contact book as the Contacts layout holds it (`routes/contacts/layout.tsx`
 * provides it; the child routes, the editor and the dialogs read it). Empty on the server: the
 * data exists only in the browser, so nothing of it is ever in the HTML.
 */
export interface LocalBookState {
  book: Signal<LocalBook>;
  /** The browser's copy has been read (false on the server and until then). */
  ready: Signal<boolean>;
  /** Frequent's open / contact counts (`frequency.ts`). */
  counts: Signal<CountMap>;
}

export const localBookId =
  createContextId<LocalBookState>("spn.contacts.local");

/**
 * The visitor's own labels for the drawer, which the ROOT layout builds (`routes/layout.tsx`):
 * it provides this signal, the Contacts layout fills it from the book. Other routes read a small
 * cache of it (`readLabelCache`) so the floating card shows them too.
 */
export interface DrawerLabel {
  id: string;
  name: string;
}
export const localLabelsId = createContextId<Signal<DrawerLabel[]>>(
  "spn.contacts.labels",
);

/** The path of a local contact's page. */
export const LOCAL_PREFIX = "/contacts/local/";
export const localContactHref = (id: string) => `${LOCAL_PREFIX}${id}/`;
/** The row key the list, Frequent and the focus code use for a local contact. */
export const localRowKey = (id: string) => `local/${id}`;
