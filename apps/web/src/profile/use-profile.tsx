import {
  $,
  createContextId,
  useComputed$,
  useContext,
  useContextProvider,
  useOnDocument,
  useStore,
  type ReadonlySignal,
} from "@qwik.dev/core";
import type { AvatarPresence } from "@seanperez/ui";
import { GUEST_ACCOUNT } from "../content/accounts";
import { changeLocalDoc, onLocalDocChange, readLocalDoc } from "../local-store";
import type { Profile } from "@seanperez/data/profile/profile";
import {
  PROFILE_DOC,
  applyProfileOverride,
  mergeProfileFields,
  parseProfileDoc,
  replaceProfileFields,
  type ProfileFields,
} from "./profile-local";

/**
 * The visitor's own profile edit for every component (2026-11-24, `profile-local.ts`):
 * `useProfileOverrideProvider()` once in the root layout, `useProfileOverride()` /
 * `useShownProfile(base)` anywhere under it. Read the fields in JSX or `useComputed$` (rule Q12).
 *
 * Since 2026-11-25 (memory `visitor-is-guest-you`) the override is over the GUEST's profile
 * (`GUEST_PROFILE`, "You"), never the owner's: the owner is a separate person.
 *
 * Server render: no override (the server has none and never gets one: no cookie, nothing
 * posted), so the HTML shows "You"; the browser reads the doc on resume (`qinit`) and the
 * text changes in place (the avatar's tone seed is the account id, so only its initial can
 * change). Another tab's save is heard on the seam's channel (`onLocalDocChange`).
 */
export interface ProfileOverrideState {
  /** The stored changes; `null` until read (and on the server). */
  fields: ProfileFields | null;
  /** The doc's stamp: keys the edit form, so it reopens with the saved values. */
  updatedAt: number;
}

export const ProfileOverrideContext =
  createContextId<ProfileOverrideState>("spn.profile");

const SERVER_STATE: ProfileOverrideState = { fields: null, updatedAt: 0 };

const loadDoc = async () => parseProfileDoc(await readLocalDoc(PROFILE_DOC));

/** Browser only: the doc into the state (a whole new `fields` object, never patched). */
async function readInto(state: ProfileOverrideState) {
  const doc = await loadDoc();
  state.fields = doc.fields;
  state.updatedAt = doc.updatedAt;
}

export function useProfileOverrideProvider(): ProfileOverrideState {
  const state = useStore<ProfileOverrideState>({ ...SERVER_STATE });
  useContextProvider(ProfileOverrideContext, state);
  useOnDocument(
    "qinit",
    $(async () => {
      onLocalDocChange(PROFILE_DOC, () => void readInto(state));
      await readInto(state);
    }),
  );
  return state;
}

/** The visitor's stored changes (outside the provider: none). */
export const useProfileOverride = (): ProfileOverrideState =>
  useContext(ProfileOverrideContext, SERVER_STATE);

/**
 * THE GUEST'S BASE PROFILE (2026-11-25): what a visitor is before they edit anything. "You",
 * nothing else, no links (no email ever). Their edits go on top (`profile.local`).
 */
export const GUEST_PROFILE: Profile = {
  name: GUEST_ACCOUNT.name,
  headline: "",
  location: "",
  bio: "",
  links: [],
};

/**
 * THE HOOK FOR EVERY PLACE THAT SHOWS THE VISITOR'S OWN PROFILE: the guest's base
 * (`GUEST_PROFILE`) with their changes on top. Never for the owner's contact, Contact me, its
 * social links, the page head, OG or JSON-LD (they always show the real owner).
 */
export function useShownProfile(): ReadonlySignal<Profile> {
  const override = useProfileOverride();
  return useComputed$(() =>
    applyProfileOverride(GUEST_PROFILE, override.fields),
  );
}

/** The visitor's shown name: their edited one, else "You". */
export const ownName = (fields: ProfileFields | null): string =>
  fields?.name || GUEST_ACCOUNT.name;

/** How a list names the visitor among others: "Ada (you)", or "You" while unnamed. */
export const ownLabel = (fields: ProfileFields | null): string =>
  fields?.name ? `${fields.name} (you)` : GUEST_ACCOUNT.name;

/**
 * `person` with the visitor's live presence and edited name, when it is the guest account
 * (Messages' `ME`, the self thread, members). Others, the owner included, unchanged.
 */
export const withOwnAccount = <P extends { id: string; name?: string }>(
  person: P,
  shown: AvatarPresence,
  fields: ProfileFields | null,
): P =>
  person.id === GUEST_ACCOUNT.id
    ? {
        ...person,
        presence: shown,
        ...(fields?.name ? { name: fields.name } : {}),
      }
    : person;

/** What a save did, for the snackbar and its Undo. */
export interface ProfileSaveResult {
  /** Reached the browser's storage (else: this page only). */
  saved: boolean;
  /** Nothing differed: nothing written. */
  changed: boolean;
  /** The fields before, for Undo. */
  before: ProfileFields;
}

/** Edit profile's Save: the changed fields over the stored ones, through the seam. Browser only. */
export async function saveProfileChanges(
  state: ProfileOverrideState,
  changes: ProfileFields,
): Promise<ProfileSaveResult> {
  const change = await changeLocalDoc(PROFILE_DOC, loadDoc, (doc, now) => ({
    doc: mergeProfileFields(doc, changes, now),
    result: doc,
  }));
  const before = change.result!;
  // A tab does not hear its own message on the channel: update this one directly.
  state.fields = change.doc.fields;
  state.updatedAt = change.doc.updatedAt;
  return {
    saved: change.saved,
    changed: change.doc !== before,
    before: before.fields,
  };
}

/** Reset (`{}`) or Undo (the fields from before): a new stamp, through the seam. Browser only. */
export async function replaceProfile(
  state: ProfileOverrideState,
  fields: ProfileFields,
): Promise<ProfileSaveResult> {
  const change = await changeLocalDoc(PROFILE_DOC, loadDoc, (doc, now) => ({
    doc: replaceProfileFields(doc, fields, now),
    result: doc,
  }));
  state.fields = change.doc.fields;
  state.updatedAt = change.doc.updatedAt;
  return { saved: change.saved, changed: true, before: change.result!.fields };
}

/** The self thread's title: "Ada (you)", or "You" while unnamed; other threads unchanged. */
export const ownThreadTitle = (
  thread: { kind: string; title: string },
  fields: ProfileFields | null,
): string => (thread.kind === "self" ? ownLabel(fields) : thread.title);
