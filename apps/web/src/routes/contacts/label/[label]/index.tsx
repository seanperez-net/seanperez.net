import { component$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import {
  ContactsPlaceholder,
  contactsListHead,
} from "../../../../components/contacts-placeholder";
import { isLocalLabelId } from "../../../../contacts/local-book";
import { CONTACT_LABELS } from "../../../../content/contacts";

/**
 * A label id the server cannot know is a 404 (as an unknown contact). The VISITOR's labels
 * (`l-<uuid>`, 2026-11-24) live only in their browser: the server lets the shape through and the
 * layout fills in the name and the members, or says the label is not in this browser.
 */
export const useLabel = routeLoader$(({ params, error }) => {
  const label = CONTACT_LABELS.find((l) => l.id === params.label);
  if (!label && !isLocalLabelId(params.label))
    throw error(404, "Label not found");
  return params.label;
});

/** `/contacts/label/<id>/`: the label's contacts (the layout's list); the detail pane rests. */
export default component$(() => {
  useLabel();
  return <ContactsPlaceholder />;
});

export const head: DocumentHead = (ctx) => {
  const own = isLocalLabelId(ctx.params.label);
  const head = contactsListHead(`label/${ctx.params.label}`)(ctx);
  // A visitor's label: its name is not on the server (so the title says "Label"); never indexed.
  return own
    ? {
        ...head,
        title: "Label · Contacts",
        meta: [
          ...(head.meta ?? []),
          { name: "robots", content: "noindex", key: "robots" },
        ],
      }
    : head;
};
