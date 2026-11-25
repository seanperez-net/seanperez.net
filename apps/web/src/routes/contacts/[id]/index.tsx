import { $, component$, useComputed$, useContext } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { Button, EmptyState, Layout } from "@seanperez/ui";
import { ContactAppProfile } from "../../../components/contact-app-profile";
import { ContactProfile } from "../../../components/contact-profile";
import {
  baseRecord,
  commit,
  useContactsSnackbar,
} from "../../../contacts/local-actions";
import {
  restoreSite,
  siteOverride,
  type SiteBase,
} from "../../../contacts/local-book";
import { localBookId } from "../../../contacts/local-context";
import { findAccount } from "../../../content/accounts";
import { CONTACT_HEADING_ID, findContact } from "../../../content/contacts";
import { DEMO } from "../../../demo/demo";
import { pageHead, seoHead } from "../../../seo";
import { useContactBook } from "../layout";

/** The route's contact; an unknown id is a 404 (as `/feed/<slug>/`). */
export const useContactId = routeLoader$(({ params, error }) => {
  const contact = findContact(params.id);
  if (!contact) throw error(404, "Contact not found");
  return contact.id;
});

/**
 * `/contacts/<id>/`: one of the SITE's contacts in the detail pane, linkable (the old `/about/`
 * résumé lives here now: `/about/` is a 301 to the owner's contact). In single-pane mode the
 * layout hides the list, and the profile shows a back button.
 *
 * Google Contacts' person page (`ContactPerson`, 2026-11-24). The visitor's LOCAL OVERRIDE (owner,
 * 2026-11-24) is applied in the browser: what the page shows and edits is their override of the
 * contact, or the site's base until they change something. Deleted forever from their contacts,
 * the page says so and offers Restore. The server always renders the site's version (it never
 * sees the override).
 */
export default component$(() => {
  const book = useContactBook();
  const id = useContactId();
  const state = useContext(localBookId);
  const { showSnackbar$ } = useContactsSnackbar();
  const row = useComputed$(() => book.value.find((r) => r.id === id.value)!);
  const override = useComputed$(() =>
    state.ready.value
      ? (siteOverride(state.book.value, id.value) ?? null)
      : null,
  );
  const hidden = useComputed$(
    () => state.ready.value && state.book.value.hiddenSite.includes(id.value),
  );
  // The owner's contact is HIS (2026-11-25, `visitor-is-guest-you`): his real profile, with only
  // the visitor's local edit of this contact on top, as for any contact. The visitor's own
  // profile edit (`profile.local`) is theirs, never applied here.
  const base = useComputed$<SiteBase>(() => ({
    siteId: row.value.id,
    name: row.value.profile?.name ?? row.value.name,
    title: row.value.profile?.headline ?? row.value.headline,
    labels: row.value.labels,
  }));
  // What the page shows and edits: the override, else the site's record as one.
  const record = useComputed$(() => override.value ?? baseRecord(base.value));

  const restore$ = $(async () => {
    const siteId = id.value;
    await commit(state, (b) => ({ book: restoreSite(b, [siteId]) }));
    await showSnackbar$({
      message: `${row.value.name} is back in your contacts`,
    });
  });

  return hidden.value ? (
    <>
      <Layout.PaneHeader
        title={row.value.name}
        titleId={CONTACT_HEADING_ID}
        backHref="/contacts/"
        backLabel="Back to contacts"
      />
      <div class="grid content-start justify-items-center gap-4">
        <EmptyState
          size="sm"
          icon="person"
          headline="You deleted this contact"
          description="It is gone from your contacts in this browser. The site keeps its own copy."
          live={false}
        />
        <Button
          look="filled"
          label="Restore contact"
          leadingIcon="undo"
          onClick$={restore$}
        />
      </div>
    </>
  ) : row.value.profile ? (
    <ContactProfile
      key={row.value.id}
      id={row.value.id}
      seed={row.value.seed}
      // His account's static value (`OWNER_ACCOUNT.presence`, why there): the public site has no
      // live status for him.
      presence={row.value.presence ?? "offline"}
      profile={{ ...row.value.profile, name: record.value.name }}
      record={record.value}
      base={base.value}
      overridden={!!override.value}
    />
  ) : (
    // An app (the assistant, 2026-11-24): its account, permissions and its chat.
    <ContactAppProfile
      key={row.value.id}
      account={{ ...row.value.account!, name: record.value.name }}
      seed={row.value.seed}
      record={record.value}
      base={base.value}
      overridden={!!override.value}
    />
  );
});

// The owner's page has its own entry (`pages.ts`, its own OG card); an app's page is titled
// from its account, with the site's card.
export const head: DocumentHead = ({ url, params }) => {
  const contact = findContact(params.id);
  return contact?.kind === "app"
    ? seoHead({
        title: `${findAccount(contact.accountId)?.name ?? "App"} · Contacts`,
        // DEMO: "demo" in the copy; off, plain.
        description: DEMO
          ? "An app's contact page in the Contacts demo."
          : "An app's contact page in Contacts.",
        url,
      })
    : pageHead("/contacts/sean-perez/", url);
};
