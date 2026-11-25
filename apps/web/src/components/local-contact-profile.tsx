import { IconButton } from "@seanperez/ui";
import type { AvatarPresence } from "@seanperez/ui";
import { component$ } from "@qwik.dev/core";
import type { LocalContact } from "../contacts/local-book";
import { contactsListHref } from "../content/contacts";
import {
  brandFor,
  linkDetail,
  type Profile,
  type ProfileLink,
  type SocialBrand,
} from "@seanperez/db/profile/profile";
import { ContactPerson } from "./contact-person";
import {
  LinkedProfileRow,
  OwnerProfileSections,
  ProfileCard,
} from "./profile-card";

/** A service's name, for a linked profile address's row. */
const BRAND_NAMES: Record<SocialBrand, string> = {
  github: "GitHub",
  x: "X",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  youtube: "YouTube",
  instagram: "Instagram",
};

/** A linked address as a link row: the service's name and mark, else the host. Never `rel="me"`. */
const profileLink = (href: string): ProfileLink => {
  const brand = brandFor(href);
  return {
    label: brand
      ? BRAND_NAMES[brand]
      : new URL(href).hostname.replace(/^www\./, ""),
    href,
    detail: linkDetail(href),
    ...(brand ? { brand } : {}),
  };
};

/** The site account a contact is linked to, resolved by the route (`routes/contacts/local/[id]/`). */
export interface LinkedAccountProfile {
  profile: Profile;
  presence?: AvatarPresence;
}

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
export const LocalContactProfile = component$<{
  contact: LocalContact;
  /** Its linked site account's profile, when `contact.profile` is `{ account }` and it exists. */
  linked?: LinkedAccountProfile | null;
}>(({ contact, linked }) => {
  const work = [contact.title, contact.organization].filter(Boolean).join(", ");
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
      // Linked to a site account's profile: that person's conversations are its "Recent
      // interactions" too (Google merges a contact with the profile it is linked to).
      accountId={
        contact.profile && "account" in contact.profile
          ? contact.profile.account
          : undefined
      }
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

      {/* Its linked PROFILE (2026-11-25, Google's PROFILE source; More > Add profile). */}
      {contact.profile && "href" in contact.profile && (
        <ProfileCard
          id="contact-profile"
          source="Linked in this browser. Change or remove it from More."
        >
          <LinkedProfileRow link={profileLink(contact.profile.href)} />
        </ProfileCard>
      )}
      {linked && (
        <ProfileCard
          id="contact-profile"
          source={`From ${linked.profile.name}'s profile. It can't be edited here.`}
        >
          <OwnerProfileSections
            profile={linked.profile}
            presence={linked.presence}
          />
        </ProfileCard>
      )}
    </ContactPerson>
  );
});
