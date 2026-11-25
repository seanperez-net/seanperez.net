/**
 * FREQUENT (Google Contacts' "Frequent": the people you get in touch with most), from counts kept
 * in THIS browser (2026-11-24). Every contact page opened adds an "open", every email, call or
 * message started from it a "contact". localStorage (`local-store.ts` `readPref` / `writePref`),
 * not the contact book: a count changes on every open, and rewriting a book of up to 3,000
 * contacts each time would be wasteful (second agent). Never synced: it is usage, not data.
 *
 * Keys are the list's row keys: a site contact's id (`sean-perez`) or `local/<id>`.
 * Browser only.
 */
import { readPref, writePref } from "../local-store";

const PREF = "contacts.counts";
/** Rows Frequent lists at most. */
export const MAX_FREQUENT = 20;
/** Keys kept (the least used go first). */
const MAX_KEYS = 500;

export interface Counts {
  /** Opened. */
  o: number;
  /** Got in touch (email, call, message). */
  c: number;
  /** Last time, ms. */
  t: number;
}

export type CountMap = Record<string, Counts>;

const parse = (raw: unknown): CountMap | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: CountMap = {};
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (key.length > 80 || !v || typeof v !== "object") continue;
    const { o, c, t } = v as Record<string, unknown>;
    if (typeof o === "number" && typeof c === "number" && typeof t === "number")
      out[key] = { o, c, t };
  }
  return out;
};

export const readCounts = (): CountMap => readPref(PREF, parse) ?? {};

/** A contact counts this much (getting in touch weighs twice an open). */
export const score = (c: Counts | undefined) => (c ? c.o + 2 * c.c : 0);

/** Adds one open or one contact for `key`; returns the new map. */
export function bumpCount(key: string, kind: "open" | "contact"): CountMap {
  const counts = readCounts();
  const now = Date.now();
  const cur = counts[key] ?? { o: 0, c: 0, t: now };
  counts[key] = {
    o: cur.o + (kind === "open" ? 1 : 0),
    c: cur.c + (kind === "contact" ? 1 : 0),
    t: now,
  };
  const keys = Object.keys(counts);
  if (keys.length > MAX_KEYS)
    for (const k of keys
      .sort((a, b) => score(counts[a]) - score(counts[b]))
      .slice(0, keys.length - MAX_KEYS))
      delete counts[k];
  writePref(PREF, counts);
  return counts;
}

/** Drops the counts of contacts deleted for good. */
export function forgetCounts(keys: string[]): void {
  const counts = readCounts();
  let changed = false;
  for (const k of keys)
    if (k in counts) {
      delete counts[k];
      changed = true;
    }
  if (changed) writePref(PREF, counts);
}

/** The drawer's copy of the visitor's labels (`local-context.ts` `localLabelsId`). */
const LABELS_PREF = "contacts.labels";
export const readLabelCache = (): { id: string; name: string }[] =>
  readPref(LABELS_PREF, (raw) =>
    Array.isArray(raw)
      ? raw
          .filter(
            (l): l is { id: string; name: string } =>
              !!l &&
              typeof l.id === "string" &&
              /^l-[\w-]{1,64}$/.test(l.id) &&
              typeof l.name === "string",
          )
          .map((l) => ({ id: l.id, name: l.name.slice(0, 60) }))
          .slice(0, 100)
      : null,
  ) ?? [];
export const writeLabelCache = (labels: { id: string; name: string }[]) =>
  writePref(LABELS_PREF, labels.length ? labels : null);
