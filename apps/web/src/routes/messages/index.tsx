import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { EmptyState } from "@seanperez/ui";
import { pageHead } from "../../seo";

/**
 * `/messages/`: the list (the layout). In single-pane mode only the list shows; in two-pane
 * mode the detail pane says to pick a conversation (M3 list-detail's empty detail; e-store
 * chat's `selectPrompt`, its `EmptyState`). Hidden by the layout's CSS.
 */
export default component$(() => (
  // The library's EmptyState (2026-11-24). The detail pane is `bleed` (for the conversation), so
  // the pane's one body is this wrapper, which centres the state in the pane.
  <div class="grid h-full place-items-center">
    <EmptyState
      size="sm"
      icon="chat"
      headline="Select a conversation"
      live={false}
    />
  </div>
));

export const head: DocumentHead = ({ url }) => pageHead("/messages/", url);
