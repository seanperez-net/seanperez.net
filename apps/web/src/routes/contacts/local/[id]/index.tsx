import {
  component$,
  useComputed$,
  useContext,
  useVisibleTask$,
} from "@qwik.dev/core";
import { useLocation, useNavigate, type DocumentHead } from "@qwik.dev/router";
import { EmptyState, Layout, LoadingIndicator } from "@seanperez/ui";
import { LocalContactProfile } from "../../../../components/local-contact-profile";
import { localBookId } from "../../../../contacts/local-context";
import { CONTACT_HEADING_ID } from "../../../../content/contacts";

/**
 * `/contacts/local/<id>/`: one of the visitor's OWN contacts, created or imported in THIS browser
 * (2026-11-24). No loader: the server has no such contact, so it renders the frame and the
 * layout's browser copy (`localBookId`) fills it. `local` is a static folder, so it wins over
 * `[id]` (router rc.5 `findChild`: exact static child before the wildcard); no site contact may use
 * the id `local` or `new`. A contact in the Trash still opens here (with Recover).
 *
 * A link to this page opens nothing in another browser: it says so instead of a 404 (the
 * server cannot know). The `head` is generic and `noindex`.
 */
export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const state = useContext(localBookId);
  // Offline, the service worker answers EVERY `/contacts/local/<id>/` with one stored page
  // (`LOCAL_SHELL`), whose router state is the id it was stored for. The address bar has the right
  // one: navigate there (on the client, the stored loader JSON serves it) so the list, the
  // selection and this page agree. Browser only, and nothing to do online.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      if (location.pathname !== loc.url.pathname)
        void nav(location.pathname + location.search, { replaceState: true });
    },
    { strategy: "document-ready" },
  );
  const contact = useComputed$(
    () => state.book.value.contacts.find((c) => c.id === loc.params.id) ?? null,
  );
  return (
    <>
      {!state.ready.value ? (
        <LoadingIndicator aria-label="Loading contact" />
      ) : contact.value ? (
        <LocalContactProfile key={contact.value.id} contact={contact.value} />
      ) : (
        <>
          <Layout.PaneHeader
            title="Contact not found"
            titleId={CONTACT_HEADING_ID}
            backHref="/contacts/"
            backLabel="Back to contacts"
          />
          <EmptyState
            size="sm"
            icon="person_search"
            headline="This contact isn't in this browser"
            description="Your contacts are kept only in the browser you made or imported them in, and ones deleted forever are gone."
            live={false}
          />
        </>
      )}
    </>
  );
});

export const head: DocumentHead = {
  title: "Contact · Contacts",
  meta: [{ name: "robots", content: "noindex", key: "robots" }],
};
