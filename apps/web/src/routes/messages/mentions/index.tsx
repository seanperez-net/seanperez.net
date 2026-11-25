import type { DocumentHead } from "@qwik.dev/router";
import { pageHead } from "../../../seo";

/**
 * `/messages/mentions/`: a Shortcuts LIST (Google Chat's), shown in the list pane by the layout since
 * 2026-11-24 (the nav moved into the scaffold's drawer). The detail pane is Home's "Select a
 * conversation". A static route: it wins over `[id]`, and no thread may use the id
 * (`content/conversations.ts` checks).
 */
export { default } from "../index";

export const head: DocumentHead = ({ url }) => pageHead("/messages/", url);
