import {
  $,
  createContextId,
  useContext,
  useContextProvider,
  useOnDocument,
  useStore,
} from "@qwik.dev/core";
import type {
  SnackbarConfig,
  SnackbarContextValue,
  SnackbarId,
} from "@seanperez/ui";
import { changeLocalDoc, onLocalDocChange, readLocalDoc } from "../local-store";
import {
  APPS_DOC,
  parseAppsDoc,
  setAppRemoved,
  type RemovableApp,
} from "./my-apps";

/**
 * The visitor's removed apps for every component (2026-11-25, `my-apps.ts`):
 * `useMyAppsProvider()` once in the root layout, `useMyApps()` anywhere under it. Read `removed`
 * in JSX or `useComputed$` (rule Q12).
 *
 * Server render: nothing removed (the server never knows), so the HTML has Contact me; the
 * browser reads the doc on resume (`qinit`) and the companion goes. Another tab's change is heard
 * on the seam's channel.
 */
export interface MyAppsState {
  removed: RemovableApp[];
  /**
   * Counts this tab's own saves. A read of the doc that started before a save and ends after it
   * is stale and is dropped (2026-11-25: on WebKit the resume read could land after the first
   * click's save and put Contact me back).
   */
  writes: number;
  /** The last apps snackbar's id: the next one replaces it (`showAppsNotice`). */
  noticeId?: SnackbarId;
}

export const MyAppsContext = createContextId<MyAppsState>("spn.apps");

const SERVER_STATE: MyAppsState = { removed: [], writes: 0 };

const loadDoc = async () => parseAppsDoc(await readLocalDoc(APPS_DOC));

async function readInto(state: MyAppsState) {
  const writes = state.writes;
  const doc = await loadDoc();
  if (state.writes === writes) state.removed = doc.removed;
}

export function useMyAppsProvider(): MyAppsState {
  const state = useStore<MyAppsState>({ ...SERVER_STATE });
  useContextProvider(MyAppsContext, state);
  useOnDocument(
    "qinit",
    $(async () => {
      onLocalDocChange(APPS_DOC, () => void readInto(state));
      await readInto(state);
    }),
  );
  return state;
}

/** The visitor's removed apps (outside the provider: none). */
export const useMyApps = (): MyAppsState =>
  useContext(MyAppsContext, SERVER_STATE);

/**
 * Removes (`true`) or brings back (`false`) an app, through the seam. Browser only. Resolves
 * `saved` false when the browser kept nothing (this page only).
 */
export async function setAppRemovedIn(
  state: MyAppsState,
  app: RemovableApp,
  removed: boolean,
): Promise<boolean> {
  const change = await changeLocalDoc(APPS_DOC, loadDoc, (doc, now) => ({
    doc: setAppRemoved(doc, app, removed, now),
  }));
  // A tab does not hear its own message on the channel: update this one directly.
  state.writes++;
  state.removed = change.doc.removed;
  return change.saved;
}

/**
 * Shows an apps snackbar (removed / back / not kept) in place of the previous one: that one is
 * closed first, so "Contact me is back" never waits behind the "removed" one and its Undo
 * (2026-11-25). Uses the library's own `closeSnackbar$(id)`; a snackbar that has already gone is
 * a no-op there, and one that is not ours is never closed.
 */
export async function showAppsNotice(
  state: MyAppsState,
  snackbar: SnackbarContextValue,
  config: SnackbarConfig,
): Promise<void> {
  if (state.noticeId !== undefined)
    await snackbar.closeSnackbar$(state.noticeId);
  state.noticeId = await snackbar.showSnackbar$(config);
}
