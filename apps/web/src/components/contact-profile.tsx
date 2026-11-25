import { $, component$ } from "@qwik.dev/core";
import { GithubIcon, IconButton, useSnackbar } from "@seanperez/ui";
import type { AvatarPresence } from "@seanperez/ui";
import type { LocalContact, SiteBase } from "../contacts/local-book";
import { contactHref } from "../content/contacts";
import { DEMO } from "../demo/demo";
import type { Profile } from "@seanperez/data/profile/profile";
import { OWNER_ACCOUNT } from "../content/accounts";
import { useMessagesWindow } from "./messages-window-host";
import { ContactPerson } from "./contact-person";
import { OwnerProfileSections, ProfileCard } from "./profile-card";

export interface ContactProfileProps {
  id: string;
  seed: string;
  presence: AvatarPresence;
  profile: Profile;
  /** What the person page shows and edits: the visitor's override of this contact, or its base. */
  record: LocalContact;
  /** The site's record, which a visitor's change overrides locally (`ContactPerson site`). */
  base: SiteBase;
  overridden: boolean;
}

/**
 * The OWNER's contact page (owner, 2026-11-24): the résumé that was `/about/`, in Google
 * Contacts' person page (`ContactPerson`: actions in the pane header, the avatar with its "+",
 * the labels row; owner: "mine is special because it acts like a resume but make it at least look
 * like the contacts"). Its sections keep About's ids (`resume-experience`, ...), so old
 * `/about/#...` links still land on them after the 301.
 *
 * - The `actions` row: Google's round tonal buttons with a caption (`IconButton showLabel`, owner
 *   2026-11-24): Message (owner: email, chat and video live inside Messages, so one action),
 *   GitHub, Copy link. NO address on the site.
 * - Cards: FILLED (Google's detail cards are filled, observed). Since 2026-11-25 Google's two
 *   SOURCES: "Contact details" (the visitor's emails, phones and notes, editable, with "Add ..."
 *   prompts) and ONE "Profile" card (`profile-card.tsx`: availability, location, About,
 *   Experience, Education, Projects, Links; read-only). The résumé's ids are kept.
 * - The visitor's own changes (name, emails, phones, notes, labels, star, photo) are a LOCAL
 *   override (`ContactPerson site`); the résumé and the "Contact me" companion never change.
 */
export const ContactProfile = component$<ContactProfileProps>(
  ({ id, seed, presence, profile, record, base, overridden }) => {
    const { showSnackbar$ } = useSnackbar();
    const github = profile.links.find((link) => link.brand === "github");

    // The floating Messages window (Gmail's small chat window; owner 2026-11-24: email, chat and
    // Meet live inside Messages) on the owner's DIRECT thread with the visitor (`OWNER_ACCOUNT.
    // chatId`, his welcome message; 2026-11-25, was the "(you)" self thread). Below 600px it
    // opens the thread's page instead.
    // Capture the QRL itself: a captured context OBJECT came back without it (2026-11-24, Chrome:
    // "messages.open$ is not a function").
    const { open$: openMessages$ } = useMessagesWindow();
    const message$ = $((_: Event, el: HTMLElement) =>
      openMessages$(OWNER_ACCOUNT.id, el),
    );
    const copyLink$ = $(async () => {
      const url = new URL(contactHref(id), location.origin).href;
      try {
        await navigator.clipboard.writeText(url);
        await showSnackbar$({ message: "Link copied" });
      } catch {
        await showSnackbar$({ message: "Could not copy the link" });
      }
    });

    return (
      <ContactPerson
        record={record}
        site={base}
        overridden={overridden}
        headline={
          [record.title, record.organization].filter(Boolean).join(", ") ||
          profile.headline ||
          undefined
        }
        seed={seed}
        // The owner's static status (`OWNER_ACCOUNT.presence`), not the visitor's (2026-11-25).
        presence={presence}
        accountId={OWNER_ACCOUNT.id}
      >
        {/* Google's quick actions: round tonal buttons, a caption under each (`showLabel`). */}
        <div
          q:slot="actions"
          class="flex flex-wrap items-center gap-1"
          aria-label="Actions"
          role="group"
        >
          {/* DEMO: ONE Message action (owner 2026-11-24: email, chat and Meet live INSIDE
              Messages), the Messages app being the layer's. NO address on the site. */}
          {DEMO && (
            <IconButton
              look="tonal"
              icon="chat"
              label="Message"
              showLabel
              onClick$={message$}
            />
          )}
          {github && (
            <IconButton
              look="tonal"
              label="GitHub"
              showLabel
              type="link"
              href={github.href}
              // Off the site: a plain `<a>`.
              reload
              rel={github.me ? "me external" : "external"}
              // The GitHub mark; the label names the link, so the mark is decorative.
              icon={<GithubIcon aria-hidden="true" />}
            />
          )}
          <IconButton
            look="tonal"
            icon="link"
            label="Copy link"
            showLabel
            onClick$={copyLink$}
          />
        </div>

        {/* His PROFILE (Google's PROFILE source, 2026-11-25; owner: "put it in the profile
            card"): availability, location, About, the résumé and his links, read-only here.
            The visitor's own additions (emails, phones, notes) are the "Contact details" card. */}
        <ProfileCard
          id="contact-profile"
          source={`From ${profile.name}'s profile. It can't be edited here.`}
        >
          <OwnerProfileSections profile={profile} presence={presence} />
        </ProfileCard>
      </ContactPerson>
    );
  },
);
