/**
 * The one place this site keeps a visitor's data: in THEIR browser, never on the server (owner,
 * 2026-11-24: there is nothing to sync, the data is theirs). Every component that saves
 * something goes through here, so the storage can change in one file.
 *
 * Pattern from e-store's `packages/keep/src/store/notes-store.ts` (`StorageLike`, a storage that
 * is `null` on the server so writes are skipped, every access in try/catch), cut down: plain
 * functions, not QRLs, because no host swaps the store here.
 *
 * Small prefs in localStorage (`readPref` / `writePref`), under one versioned prefix (`spn.v1.`).
 * Larger documents (imported contacts, 2026-11-24) in OPFS, else IndexedDB (`readLocalDoc` /
 * `writeLocalDoc`, below).
 *
 * Call these only after resume (in tasks that run in the browser, or in handlers), never while
 * rendering: the server has no storage, and a read in render would differ between the two.
 * Another tab's write is seen on the next read; nothing here listens for the `storage` event.
 */

/** The part of the Web Storage API used here. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Every key this site keeps starts with this. Bump the version to drop every old value. */
export const KEY_PREFIX = "spn.v1.";

/** `window.localStorage`, or `null` on the server and wherever access throws. */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The value stored under `name`, checked by `parse` (stored data is untrusted: another version
 * of the site, or the visitor, may have written it). `null` when unset, unreadable or rejected.
 */
export function readPref<T>(
  name: string,
  parse: (raw: unknown) => T | null,
  storage: StorageLike | null = browserStorage(),
): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY_PREFIX + name);
    return raw === null ? null : parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Saves `value` as JSON under `name`; `null` removes it. Silently skipped when not possible. */
export function writePref(
  name: string,
  value: unknown,
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    if (value === null) storage.removeItem(KEY_PREFIX + name);
    else storage.setItem(KEY_PREFIX + name, JSON.stringify(value));
  } catch {
    // Quota exceeded, private mode or storage turned off: it works for this page view only.
  }
}

/*
 * LARGER DATA: one JSON document per name, kept in the visitor's own browser (2026-11-24, for
 * imported contacts; owner: "import it into their local opfs or w.e save it on their browser").
 *
 * Where (first that works):
 * 1. OPFS (`navigator.storage.getDirectory()`, MDN "Origin private file system", read
 *    2026-11-24): a file `spn.v1.<name>.json`, written from the page with
 *    `FileSystemFileHandle.createWritable()` (main thread; Baseline 2025 per MDN, so older
 *    Safari lacks it: hence the fallback). `createSyncAccessHandle` is worker-only and not used.
 * 2. IndexedDB: database `spn.v1`, store `docs`, the same JSON under the same name.
 * 3. Neither: `null` reads, writes report `false` (the caller says "kept for this visit only").
 *
 * The second agent (2026-11-24) recommended IndexedDB ONLY (records, transactions, everywhere);
 * OPFS first was kept because the owner named it. OWNER DECISION in PLAN.md.
 *
 * Several tabs: `withLocalLock` runs a read-change-write under a Web Lock (`navigator.locks`,
 * where there is one), so two tabs never write back a stale copy; the caller then tells the
 * other tabs over a `BroadcastChannel`. Never call these while rendering (no storage on the
 * server).
 */

const DOC_FILE = (name: string) => `${KEY_PREFIX}${name}.json`;
const IDB_NAME = "spn.v1";
const IDB_STORE = "docs";

/** OPFS with a main-thread writer, or null. */
async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.getDirectory)
      return null;
    if (
      typeof FileSystemFileHandle === "undefined" ||
      !("createWritable" in FileSystemFileHandle.prototype)
    )
      return null;
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}

/**
 * The database, or null. `create` false (reads, removals): a database that does not exist yet is
 * not created (`indexedDB.databases()`, where the browser has it), so a visit that only reads
 * leaves nothing behind.
 */
async function idbOpen(create: boolean): Promise<IDBDatabase | null> {
  try {
    if (typeof indexedDB === "undefined") return null;
    if (!create && indexedDB.databases) {
      const all = await indexedDB.databases();
      if (!all.some((db) => db.name === IDB_NAME)) return null;
    }
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const db = req.result;
        // Another tab upgrading the database: let it.
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbRun<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
  create = false,
): Promise<T | undefined> {
  const db = await idbOpen(mode === "readwrite" && create);
  if (!db) throw new Error("no IndexedDB");
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, mode);
      const req = run(tx.objectStore(IDB_STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The JSON document saved under `name`, or null (unset, unreadable, or no storage). */
export async function readLocalDoc(name: string): Promise<unknown> {
  const root = await opfsRoot();
  if (root) {
    try {
      const handle = await root.getFileHandle(DOC_FILE(name));
      return JSON.parse(await (await handle.getFile()).text());
    } catch {
      // NotFoundError (never written) or bad JSON; IndexedDB may hold an older copy below.
    }
  }
  try {
    const raw = await idbRun("readonly", (s) => s.get(name));
    return typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Saves `value` as JSON under `name`; `null` removes it (from both places). `true` when it
 * reached storage; `false` when it could not (no storage, quota exceeded).
 */
export async function writeLocalDoc(
  name: string,
  value: unknown,
): Promise<boolean> {
  const root = await opfsRoot();
  if (value === null) {
    let ok = false;
    if (root)
      ok = await root.removeEntry(DOC_FILE(name)).then(
        () => true,
        (e: unknown) => (e as DOMException)?.name === "NotFoundError",
      );
    await idbRun("readwrite", (s) => s.delete(name)).then(
      () => (ok = true),
      () => undefined,
    );
    return ok;
  }
  const json = JSON.stringify(value);
  if (root) {
    try {
      const handle = await root.getFileHandle(DOC_FILE(name), { create: true });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return true;
    } catch {
      // QuotaExceededError or a refused write: try IndexedDB.
    }
  }
  try {
    await idbRun("readwrite", (s) => s.put(json, name), true);
    // An older OPFS copy would be read first (`readLocalDoc`) and hide this one (second agent,
    // 2026-11-24): drop it.
    if (root) await root.removeEntry(DOC_FILE(name)).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Runs `fn` under the Web Lock `spn.v1.<name>` (one tab at a time), or directly without one. */
export async function withLocalLock<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request)
    return navigator.locks.request(KEY_PREFIX + name, fn);
  return fn();
}

/**
 * Asks the browser to keep this site's storage under pressure (MDN `StorageManager.persist()`:
 * resolves true when granted; the browser decides, Firefox may ask the visitor). Call it after
 * the visitor saved something they would miss, in response to their action.
 */
export async function askPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/*
 * THE SYNC SEAM, for every feature (2026-11-24; was Contacts' own in `local-book-store.ts`).
 * Owner: "its just updating theirs locally in the same place that it would be were we to be
 * syncing it to the server in admin via the service worker sync". So every feature that keeps
 * the visitor's ACCOUNT data (contacts, presence, profile; later messages) changes its document
 * through `changeLocalDoc`, and ONE dispatcher hook hears every change, by document NAME:
 *
 * - the public site sets NO dispatcher: nothing is posted, fetched or registered;
 * - `apps/admin` calls `setSyncDispatcher` once with one that asks its service worker for a
 *   Background Sync with the name as the tag (`reg.sync.register(name)`), and flushes from the
 *   page where there is none. The worker reads the document itself and asks its feature what is
 *   pending: each synced document carries its own outbox (records with `updatedAt` newer than
 *   `syncedAt`, plus tombstones), so the dispatcher is told only WHICH document changed (second
 *   agent, 2026-11-24: a payload would be stale by the time the worker runs). The per-feature
 *   `pending` / `markSynced` functions are listed in `sync-docs.ts`.
 *
 * The dispatcher runs AFTER the lock is released and is not awaited (second agent: a flush that
 * takes the same Web Lock would deadlock, and a network wait would block edits in every tab).
 * Browser only.
 */

/** Hears which document changed. None on the public site. */
export type SyncDispatcher = (name: string) => void | Promise<void>;
let dispatcher: SyncDispatcher | null = null;

/** The admin app's hook (never called on the public site). */
export function setSyncDispatcher(next: SyncDispatcher | null): void {
  dispatcher = next;
}

// ONE channel per tab for every document (second agent, Contacts, 2026-11-24): a channel does
// not receive its own messages, so a tab never re-reads after its own write. The message is the
// document's name.
const DOC_CHANNEL = `${KEY_PREFIX}docs`;
let channel: BroadcastChannel | null | undefined;
function tabChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  try {
    channel = new BroadcastChannel(DOC_CHANNEL);
  } catch {
    channel = null; // other tabs see the change on their next load
  }
  return channel;
}

/** What a change did; `saved` false = kept in this page only (no storage, or quota). */
export interface DocChange<D, T = undefined> {
  doc: D;
  saved: boolean;
  result: T;
}

/**
 * Reads the document with `load`, runs `next` on it under the document's Web Lock, saves it,
 * tells the other tabs and then the dispatcher. `next` may throw: nothing is saved then. A
 * `next` that returns the SAME object it was given is a no-op (nothing written or announced).
 */
export async function changeLocalDoc<D, T = undefined>(
  name: string,
  load: (now: number) => Promise<D>,
  next: (doc: D, now: number) => { doc: D; result?: T },
): Promise<DocChange<D, T>> {
  const change = await withLocalLock(name, async () => {
    const now = Date.now();
    const before = await load(now);
    const { doc, result } = next(before, now);
    if (doc === before)
      return { doc, saved: true, result: result as T, same: true };
    const saved = await writeLocalDoc(name, doc);
    // Only a saved change is news to the other tabs (second agent, 2026-11-24).
    if (saved) tabChannel()?.postMessage(name);
    return { doc, saved, result: result as T, same: false };
  });
  if (change.saved && !change.same && dispatcher) {
    try {
      void Promise.resolve(dispatcher(name)).catch(() => undefined);
    } catch {
      // The dispatcher retries on its own (the admin app's outbox); the local save stands.
    }
  }
  return { doc: change.doc, saved: change.saved, result: change.result };
}

/** Calls `fn` when ANOTHER tab saved the document `name`; returns the unsubscribe. */
export function onLocalDocChange(name: string, fn: () => void): () => void {
  const ch = tabChannel();
  if (!ch) return () => undefined;
  const listener = (e: MessageEvent) => {
    if (e.data === name) fn();
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
