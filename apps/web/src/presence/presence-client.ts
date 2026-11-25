/**
 * The browser half of presence (2026-11-24): this tab's activity, the other tabs' activity, the
 * stored choice, and the view the page shows. Plain TS; `use-presence.tsx` wires it to Qwik.
 * Browser only (module state is per tab; nothing here runs on the server).
 *
 * - Activity: passive pointer / key / wheel / touch listeners and `visibilitychange` (MDN Page
 *   Visibility API, read 2026-11-24: `hidden` = background tab, minimised window or screen off)
 *   call `noteActivity`. Only a VISIBLE tab counts. The handler is a timestamp compare; the other
 *   tabs hear it at most once per `shareEvery` on the BroadcastChannel `spn.v1.presence`.
 * - The choice and the coarse state are the document `presence.local` (`presence.ts`), changed
 *   only through `changeLocalDoc` (the shared sync seam): another tab's save re-reads it.
 * - A timer wakes at the next threshold (`nextPresenceChange`); hidden tabs' timers are throttled
 *   by the browser, which is fine: a tab coming back is activity and recomputes.
 * - The Idle Detection API is NOT used: it needs `IdleDetector.requestPermission()` after a
 *   user gesture, and is experimental / not Baseline (MDN, read 2026-11-24).
 * - Dev only: `?presence-test=fast` on the first page load uses seconds (`FAST_TIMINGS`).
 */
import type { AccountPresencePref, AvatarPresence } from "@seanperez/ui";
import { changeLocalDoc, onLocalDocChange, readLocalDoc } from "../local-store";
import {
  FAST_TIMINGS,
  PRESENCE_DOC,
  PRESENCE_TIMINGS,
  derivePresence,
  effectivePref,
  emptyPresence,
  nextPresenceChange,
  parsePresence,
  recordShown,
  setPresencePref,
  type PresenceDoc,
  type PresenceDuration,
} from "./presence";

/** What the page shows (a Qwik store in `use-presence.tsx`). */
export interface PresenceView {
  shown: AvatarPresence;
  pref: AccountPresencePref;
  /** When the manual choice ends (ms), or `null`. */
  until: number | null;
  /** Busy's chosen length (the submenu's checked row), or `null`. */
  lasts: PresenceDuration | null;
}

let view: PresenceView | null = null;
let doc: PresenceDoc = emptyPresence();
let timings = PRESENCE_TIMINGS;
let mine = 0; // this tab's latest activity (ms)
let others = 0; // the latest any other tab told us
let shared = 0;
let recording: AvatarPresence | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let activity: BroadcastChannel | null = null;

const load = async () => parsePresence(await readLocalDoc(PRESENCE_DOC));
const lastActive = () => Math.max(mine, others);
const visible = () => document.visibilityState === "visible";

async function save(next: (d: PresenceDoc, now: number) => PresenceDoc) {
  const change = await changeLocalDoc(PRESENCE_DOC, load, (d, now) => ({
    doc: next(d, now),
  }));
  doc = change.doc;
  render(Date.now());
}

function render(now: number) {
  if (!view) return;
  const shown = derivePresence(doc, lastActive(), now, timings);
  const pref = effectivePref(doc, now);
  const until = pref === "auto" ? null : doc.until;
  const lasts = pref === "busy" ? doc.lasts : null;
  if (view.shown !== shown) view.shown = shown;
  if (view.pref !== pref) view.pref = pref;
  if (view.until !== until) view.until = until;
  if (view.lasts !== lasts) view.lasts = lasts;
  // The coarse state is what admin syncs: written once per change (every tab derives the same,
  // and a no-op change writes nothing).
  if (doc.shown !== shown && recording !== shown) {
    recording = shown;
    void save((d, n) => recordShown(d, shown, n)).finally(() => {
      if (recording === shown) recording = null;
    });
  }
  clearTimeout(timer);
  const at = nextPresenceChange(doc, lastActive(), now, timings);
  if (at !== null)
    timer = setTimeout(() => render(Date.now()), Math.max(0, at - now) + 50);
}

function share(now: number) {
  shared = now;
  activity?.postMessage(now);
}

/** Starts once per tab (the root layout's `qinit`); later calls only re-attach the view. */
export async function startPresence(next: PresenceView): Promise<void> {
  const first = view === null;
  view = next;
  if (!first) return render(Date.now());
  try {
    if (
      import.meta.env.DEV &&
      new URLSearchParams(location.search).get("presence-test") === "fast"
    )
      timings = FAST_TIMINGS;
  } catch {
    // no location: keep the real timings
  }
  // Loading the page is activity, even in a background tab (the visitor just opened it).
  mine = Date.now();
  try {
    activity = new BroadcastChannel("spn.v1.presence");
    activity.onmessage = (e: MessageEvent) => {
      if (typeof e.data === "number" && e.data > others) {
        others = Math.min(e.data, Date.now());
        render(Date.now());
      }
    };
  } catch {
    activity = null; // one tab only: it still works
  }
  onLocalDocChange(PRESENCE_DOC, () => {
    void load().then((d) => {
      doc = d;
      render(Date.now());
    });
  });
  doc = await load();
  share(mine);
  render(Date.now());
}

/** A pointer, key, wheel or touch event in this tab. Cheap: a compare unless it changes. */
export function noteActivity(): void {
  if (!view || !visible()) return;
  const now = Date.now();
  const before = derivePresence(doc, lastActive(), now, timings);
  mine = now;
  if (now - shared >= timings.shareEvery) share(now);
  if (derivePresence(doc, now, now, timings) !== before) render(now);
}

/** `visibilitychange`: back in view is activity; hidden, nothing (the tab ages on its own). */
export function noteVisibility(): void {
  if (!view) return;
  if (visible()) {
    mine = Date.now();
    share(mine);
  }
  render(Date.now());
}

/**
 * The visitor picked a status in the account menu (and, for Busy, its length from the submenu):
 * saved like any change (seam + outbox).
 */
export function choosePresence(
  pref: AccountPresencePref,
  lasts?: string,
): Promise<void> {
  mine = Date.now();
  return save((d, now) => {
    const chosen = setPresencePref(d, pref, now, timings, lasts);
    // The new choice and what it shows, in one write.
    return recordShown(
      chosen,
      derivePresence(chosen, lastActive(), now, timings),
      now,
    );
  });
}
