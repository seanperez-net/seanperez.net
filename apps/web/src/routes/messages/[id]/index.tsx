import { component$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { MessagesThread } from "../../../components/messages-thread";
import { findThread } from "../../../content/conversations";
import { SITE_UPDATES_ID } from "../../../messages/site-updates";
import { useSiteUpdates } from "../layout";
import { pageHead } from "../../../seo";

/** The route's conversation; an unknown id is a 404 (as `/contacts/<id>/`). */
export const useThreadId = routeLoader$(({ params, error }) => {
  const thread = findThread(params.id);
  if (!thread) throw error(404, "Conversation not found");
  return thread.id;
});

/**
 * `/messages/<id>/`: one conversation in the detail pane, linkable. Keyed by the id, so each
 * conversation is a NEW component (and a new ARIA log: switching conversations announces
 * nothing old) with its own local demo messages.
 */
export default component$(() => {
  const id = useThreadId();
  // The Site updates channel's posts come from the layout's loader (read on every request).
  const updates = useSiteUpdates();
  return (
    <MessagesThread
      key={id.value}
      id={id.value}
      updates={id.value === SITE_UPDATES_ID ? updates.value : undefined}
    />
  );
});

// One card for every conversation: the threads are demo content, not pages of their own.
export const head: DocumentHead = ({ url }) => pageHead("/messages/", url);
