import {
  $,
  createContextId,
  useContext,
  useContextProvider,
  useOnDocument,
  useStore,
} from "@qwik.dev/core";
import type { AvatarPresence } from "@seanperez/ui";
import { GUEST_ACCOUNT } from "../content/accounts";
import { SERVER_PRESENCE, nextMidnight } from "./presence";
import {
  noteActivity,
  noteVisibility,
  startPresence,
  type PresenceView,
} from "./presence-client";

/**
 * The VISITOR's presence (the guest account, 2026-11-25) for every component (2026-11-24): `usePresenceProvider()` once
 * in the root layout, `usePresence()` anywhere under it. Read its fields in JSX (rule Q12).
 *
 * Server render: the HTML cannot know the visitor's status, so it says `online` (they are
 * loading the page: active), with the demo layer on or off; the browser corrects it on resume
 * (`qinit`). The presence glyph is placed absolutely on the avatar (`avatar.tsx`), so a change of
 * state moves nothing.
 */
export const PresenceContext = createContextId<PresenceView>("spn.presence");

const SERVER_VIEW: PresenceView = {
  shown: SERVER_PRESENCE,
  pref: "auto",
  until: null,
  lasts: null,
};

export function usePresenceProvider(): PresenceView {
  const state = useStore<PresenceView>({ ...SERVER_VIEW });
  useContextProvider(PresenceContext, state);
  // Browser work starts on resume; listeners are the idiomatic `useOnDocument` (qwik-v2 skill),
  // passive so they never delay scrolling.
  useOnDocument(
    "qinit",
    $(() => startPresence(state)),
  );
  useOnDocument(
    ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"],
    $(() => noteActivity()),
    { passive: true },
  );
  useOnDocument(
    "visibilitychange",
    $(() => noteVisibility()),
  );
  return state;
}

/** The current user's presence (outside the provider: the server default, not live). */
export const usePresence = (): PresenceView =>
  useContext(PresenceContext, SERVER_VIEW);

/**
 * `person` with the live presence when it is the VISITOR (the guest account, Messages' `ME`).
 * Never the owner (2026-11-25, `visitor-is-guest-you`): his status is his account's static value.
 */
export const withOwnPresence = <P extends { id: string }>(
  person: P,
  shown: AvatarPresence,
): P =>
  person.id === GUEST_ACCOUNT.id ? { ...person, presence: shown } : person;

/**
 * The account menu's words for when a manual choice ends (browser only: the visitor's clock and
 * time zone; the server renders no end): "Until 3:40 PM" today, "Until end of day" for that
 * choice, "Until tomorrow, 1:30 AM", else the weekday; `null` with no end = "Until you change
 * it" for Busy, nothing for Away / Appear offline (their rows say it).
 */
export function untilText(view: PresenceView, now = Date.now()): string | undefined {
  if (view.pref === "auto") return undefined;
  if (view.lasts === "today") return "Until end of day";
  if (view.until === null)
    return view.pref === "busy" ? "Until you change it" : undefined;
  const end = new Date(view.until);
  const time = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const day = (ms: number) => new Date(ms).toDateString();
  if (day(view.until) === day(now)) return `Until ${time}`;
  if (day(view.until) === day(nextMidnight(now))) return `Until tomorrow, ${time}`;
  return `Until ${end.toLocaleDateString(undefined, { weekday: "long" })}, ${time}`;
}
