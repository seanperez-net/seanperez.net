import type { DocumentHead, RequestHandler } from "@qwik.dev/router";
import { WIP } from "../../../demo/wip";
import { pageHead } from "../../../seo";

/**
 * `/messages/starred/`: a Shortcuts LIST (Google Chat's), shown in the list pane by the layout since
 * 2026-11-24 (the nav moved into the scaffold's drawer). The detail pane is Home's "Select a
 * conversation". A static route: it wins over `[id]`, and no thread may use the id
 * (`content/conversations.ts` checks).
 */
export { default } from "../index";

// WIP: not finished (release switch, `demo/wip.ts`): a 404 in production builds.
export const onGet: RequestHandler = ({ error }) => {
  if (!WIP) throw error(404, "Not found");
};

export const head: DocumentHead = ({ url }) => pageHead("/messages/", url);
