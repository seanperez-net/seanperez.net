import { component$ } from "@qwik.dev/core";
import type { DocumentHeadProps, DocumentHeadValue } from "@qwik.dev/router";
import { EmptyState } from "@seanperez/ui";
import { CONTACTS_LISTS, type ContactsListSlug } from "../content/contacts";
import { seoHead } from "../seo";

/**
 * The detail pane on a LIST route (`/contacts/`, `/contacts/trash/`, a label, ...): M3
 * list-detail's placeholder ("A single-pane layout shows a list view, while a two-pane layout
 * shows placeholder content in the detail pane", read 2026-11-24). In single-pane the layout
 * hides the detail pane on these routes. `live={false}`: it is the pane's resting state, not news.
 */
export const ContactsPlaceholder = component$(() => (
  <EmptyState
    size="sm"
    icon="person"
    headline="Select a contact"
    description="Their details show here."
    live={false}
  />
));

/** A list route's `head`: "Trash · Contacts", the site's card. */
export const contactsListHead =
  (slug: ContactsListSlug) =>
  ({ url }: DocumentHeadProps): DocumentHeadValue => {
    const label =
      CONTACTS_LISTS.find((l) => l.slug === slug)?.label ?? "Contacts";
    return seoHead({
      title: `${label} · Contacts`,
      description: `${label} in the Contacts app.`,
      url,
    });
  };
