import {
  $,
  createContextId,
  useContext,
  useContextProvider,
  useOnDocument,
  useStore,
} from "@qwik.dev/core";
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
}

export const MyAppsContext = createContextId<MyAppsState>("spn.apps");

const SERVER_STATE: MyAppsState = { removed: [] };

const loadDoc = async () => parseAppsDoc(await readLocalDoc(APPS_DOC));

async function readInto(state: MyAppsState) {
  state.removed = (await loadDoc()).removed;
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
  state.removed = change.doc.removed;
  return change.saved;
}
