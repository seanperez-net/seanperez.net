import { IconButton } from "@seanperez/ui";
import { component$ } from "@qwik.dev/core";
import type { LocalContact } from "../contacts/local-book";
import { contactsListHref } from "../content/contacts";
import { ContactPerson } from "./contact-person";

const dateOf = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });

/**
 * One of the visitor's OWN contacts (created or imported), in the detail pane
 * (`/contacts/local/<id>/`, 2026-11-24). Rendered from the browser's copy
 * (`local-book-store.ts`); the server never has it. Google Contacts' person page
 * (`ContactPerson`, 2026-11-24): every action is a real LOCAL write (owner: "the functionality
 * should work the same just on the clients side"), with no server code behind it. Emails and
 * phones are SHOWN (the visitor's own data in their own browser).
 *
 * Text only: every value is a JSX text node (escaped), notes keep their line breaks with
 * `whitespace-pre-line`, never HTML or markdown.
 */
export const LocalContactProfile = component$<{ contact: LocalContact }>(
  ({ contact }) => {
    const work = [contact.title, contact.organization]
      .filter(Boolean)
      .join(", ");
    const origin =
      contact.source === "import"
        ? `Imported ${dateOf(contact.createdAt)}`
        : `Created ${dateOf(contact.createdAt)}`;
    return (
      <ContactPerson
        record={contact}
        seed={contact.id}
        headline={work || undefined}
        // The dates are in History (Google's second column); where it came from stays here.
        note={`${origin}. Kept in this browser only.`}
        backHref={contactsListHref("")}
      >
        {/* Google's quick actions for the first email and phone (`showLabel` captions). */}
        {(contact.emails.length > 0 || contact.phones.length > 0) && (
          <div
            q:slot="actions"
            class="flex flex-wrap items-center gap-1"
            aria-label="Actions"
            role="group"
          >
            {contact.emails[0] && (
              <IconButton
                look="tonal"
                icon="mail"
                label="Email"
                showLabel
                type="link"
                reload
                href={`mailto:${contact.emails[0].value}`}
              />
            )}
            {contact.phones[0] && (
              <IconButton
                look="tonal"
                icon="call"
                label="Call"
                showLabel
                type="link"
                reload
                href={`tel:${contact.phones[0].value.replace(/[^\d+]/g, "")}`}
              />
            )}
          </div>
        )}
      </ContactPerson>
    );
  },
);
