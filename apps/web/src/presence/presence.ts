/**
 * THE SIGNED-IN USER'S PRESENCE (2026-11-24). Owner: "have it mimick their activity not mine",
 * then "thats the same as it would be for the admin its no differnt but this one just doesnt
 * update any database ... its just updating theirs locally in the same place that it would be
 * were we to be syncing it". The site LOOKS signed in, so the visitor is the signed-in user and
 * the dot is THEIR status: ONE implementation for the site and `apps/admin`; admin only adds the
 * service-worker dispatcher (`local-store.ts` "THE SYNC SEAM").
 *
 * Plain TS, no Qwik, no storage, no clock: pure functions of the document and `now`, so the page,
 * a test or admin's service worker can run them. `presence-client.ts` does the browser part.
 *
 * Model (research `.claude/notes/presence-status-research-2026-11-24.md`, Slack / Google Chat /
 * Teams / Discord):
 * - AUTOMATIC from activity: online while active, away after 10 min without activity (Slack
 *   desktop's and Google Chat's away), offline after 60 min (the research's threshold). A hidden
 *   tab gives no activity, so a tab left hidden ages into away, then offline.
 * - MANUAL choice (`AccountPresencePref`) overrides it, and only ever makes you LESS available:
 *   busy (do not disturb) -> busy, away -> away, invisible -> shown as offline.
 * - EXPIRY (owner 2026-11-24: "yes add the busy durations"): Busy for 1 hour, 4 hours, until
 *   the end of the day (the next LOCAL midnight) or until changed, the account menu's submenu
 *   (`DEFAULT_PRESENCE_DURATIONS`); away and appear offline last until changed. An expired
 *   choice reads as automatic (no write). A stored end more than 48 h away is distrusted (a
 *   clock or a doc gone wrong) and reads as automatic too.
 *
 * The DOCUMENT (`presence.local`, OPFS / IndexedDB through `changeLocalDoc`) holds the manual
 * choice and the coarse derived state (`shown`, written only when it changes): the outbox is the
 * one record, pending while `updatedAt > (syncedAt ?? 0)`. Activity itself is NEVER stored or
 * synced per event (second agent, 2026-11-24): tabs share it over a BroadcastChannel, and a
 * reload is activity anyway.
 */
import type { AccountPresencePref, AvatarPresence } from "@seanperez/ui";

export const PRESENCE_DOC = "presence.local";

const MIN = 60_000;

/**
 * How long Busy lasts: the ids of the account menu's `DEFAULT_PRESENCE_DURATIONS`. `today` ends
 * at the next local midnight, `forever` when the visitor changes it.
 */
export type PresenceDuration = "1h" | "4h" | "today" | "forever";
export const PRESENCE_DURATIONS: readonly PresenceDuration[] = [
  "1h",
  "4h",
  "today",
  "forever",
];
/** Busy chosen without a length (an older doc, a no-JS post): Teams-like short default. */
export const DEFAULT_BUSY_DURATION: PresenceDuration = "1h";
/** A stored end further away than this is not trusted (the longest choice is under 24 h). */
const MAX_AHEAD = 48 * 60 * 60_000;

/** The timings; `presence-client.ts` may shorten them in dev (`?presence-test=fast`). */
export interface PresenceTimings {
  /** No activity for this long: away. */
  awayAfter: number;
  /** No activity for this long: offline. */
  offlineAfter: number;
  /** Busy's fixed lengths (ms). */
  busyFor: { "1h": number; "4h": number };
  /** Dev only: "end of day" after this long instead of the next local midnight. */
  todayFor?: number;
  /** Activity is told to the other tabs at most this often. */
  shareEvery: number;
}

export const PRESENCE_TIMINGS: PresenceTimings = {
  awayAfter: 10 * MIN,
  offlineAfter: 60 * MIN,
  busyFor: { "1h": 60 * MIN, "4h": 4 * 60 * MIN },
  shareEvery: MIN,
};

/** Dev only: seconds instead of minutes, to see the changes (`presence-client.ts`). */
export const FAST_TIMINGS: PresenceTimings = {
  awayAfter: 5_000,
  offlineAfter: 15_000,
  busyFor: { "1h": 10_000, "4h": 20_000 },
  todayFor: 30_000,
  shareEvery: 1_000,
};

export interface PresenceDoc {
  pref: AccountPresencePref;
  /** When the manual choice ends (ms); `null` = until changed (or `auto`). */
  until: number | null;
  /** The length chosen for Busy (the submenu's checked row); `null` for the other choices. */
  lasts: PresenceDuration | null;
  /** What others would see, last derived (ms in `shownAt`): what admin syncs. */
  shown: AvatarPresence;
  shownAt: number;
  updatedAt: number;
  syncedAt?: number;
}

export const SERVER_PRESENCE: AvatarPresence = "online";

export const emptyPresence = (): PresenceDoc => ({
  pref: "auto",
  until: null,
  lasts: null,
  shown: SERVER_PRESENCE,
  shownAt: 0,
  updatedAt: 0,
});

const PREFS: readonly AccountPresencePref[] = [
  "auto",
  "busy",
  "away",
  "invisible",
];
const SHOWN: readonly AvatarPresence[] = ["online", "away", "busy", "offline"];
const time = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

/** Stored data is untrusted: anything unreadable becomes the empty document. */
export function parsePresence(raw: unknown): PresenceDoc {
  if (!raw || typeof raw !== "object") return emptyPresence();
  const r = raw as Record<string, unknown>;
  const pref = PREFS.includes(r.pref as AccountPresencePref)
    ? (r.pref as AccountPresencePref)
    : "auto";
  const shown = SHOWN.includes(r.shown as AvatarPresence)
    ? (r.shown as AvatarPresence)
    : SERVER_PRESENCE;
  const synced = time(r.syncedAt);
  const lasts =
    pref === "busy"
      ? PRESENCE_DURATIONS.includes(r.lasts as PresenceDuration)
        ? (r.lasts as PresenceDuration)
        : DEFAULT_BUSY_DURATION
      : null;
  return {
    pref,
    until: pref === "auto" ? null : time(r.until),
    lasts,
    shown,
    shownAt: time(r.shownAt) ?? 0,
    updatedAt: time(r.updatedAt) ?? 0,
    ...(synced !== null ? { syncedAt: synced } : {}),
  };
}

/** The manual choice in force at `now` (an expired one is `auto`). */
export function effectivePref(
  doc: PresenceDoc,
  now: number,
): AccountPresencePref {
  if (doc.pref === "auto") return "auto";
  if (doc.until !== null && (now >= doc.until || doc.until - now > MAX_AHEAD))
    return "auto";
  return doc.pref;
}

/** What others see at `now`, given the latest activity (ms) across this user's tabs. */
export function derivePresence(
  doc: PresenceDoc,
  lastActive: number,
  now: number,
  t: PresenceTimings = PRESENCE_TIMINGS,
): AvatarPresence {
  const pref = effectivePref(doc, now);
  if (pref === "busy") return "busy";
  if (pref === "away") return "away";
  if (pref === "invisible") return "offline";
  const idle = now - lastActive;
  if (idle < t.awayAfter) return "online";
  if (idle < t.offlineAfter) return "away";
  return "offline";
}

/** The next moment (ms) `derivePresence` may change without new activity, or `null`. */
export function nextPresenceChange(
  doc: PresenceDoc,
  lastActive: number,
  now: number,
  t: PresenceTimings = PRESENCE_TIMINGS,
): number | null {
  const pref = effectivePref(doc, now);
  if (pref !== "auto") return doc.until;
  const marks = [lastActive + t.awayAfter, lastActive + t.offlineAfter];
  return marks.find((m) => m > now) ?? null;
}

/** A stamp that never goes back, even if the clock does (second agent, 2026-11-24). */
const stamp = (doc: PresenceDoc, now: number) =>
  Math.max(now, doc.updatedAt + 1);

/** The next local midnight after `now` (DST-safe: a calendar day, not `now + 24 h`). */
export function nextMidnight(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

/** When a Busy of `lasts` chosen at `now` ends; `null` = until changed. */
export function presenceUntil(
  lasts: PresenceDuration,
  now: number,
  t: PresenceTimings = PRESENCE_TIMINGS,
): number | null {
  if (lasts === "forever") return null;
  if (lasts === "today")
    return t.todayFor !== undefined ? now + t.todayFor : nextMidnight(now);
  return now + t.busyFor[lasts];
}

/**
 * The visitor chose a status in the account menu (`lasts`: Busy's length, from its submenu).
 * Choosing Busy again starts its time again from `now`.
 */
export function setPresencePref(
  doc: PresenceDoc,
  pref: AccountPresencePref,
  now: number,
  t: PresenceTimings = PRESENCE_TIMINGS,
  lasts?: string,
): PresenceDoc {
  const length =
    pref !== "busy"
      ? null
      : PRESENCE_DURATIONS.includes(lasts as PresenceDuration)
        ? (lasts as PresenceDuration)
        : DEFAULT_BUSY_DURATION;
  return {
    ...doc,
    pref,
    until: length === null ? null : presenceUntil(length, now, t),
    lasts: length,
    updatedAt: stamp(doc, now),
  };
}

/** Records the derived state when it changed (the same object back when it did not). */
export function recordShown(
  doc: PresenceDoc,
  shown: AvatarPresence,
  now: number,
): PresenceDoc {
  if (doc.shown === shown) return doc;
  return { ...doc, shown, shownAt: now, updatedAt: stamp(doc, now) };
}

/** What admin's dispatcher would send: the one record, or nothing. */
export const pendingPresence = (doc: PresenceDoc): PresenceDoc | null =>
  doc.updatedAt > (doc.syncedAt ?? 0) ? doc : null;

/** After the server confirmed `sent`: synced, unless it changed since. */
export const markPresenceSynced = (
  doc: PresenceDoc,
  sent: PresenceDoc | null,
): PresenceDoc =>
  sent && sent.updatedAt === doc.updatedAt
    ? { ...doc, syncedAt: doc.updatedAt }
    : doc;
