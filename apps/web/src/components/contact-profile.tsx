import { $, component$ } from "@qwik.dev/core";
import {
  AvatarPresenceGlyph,
  GithubIcon,
  IconButton,
  List,
  useSnackbar,
} from "@seanperez/ui";
import type { AvatarPresence } from "@seanperez/ui";
import type { LocalContact, SiteBase } from "../contacts/local-book";
import { PRESENCE_WORDS, contactHref } from "../content/contacts";
import { RESUME, type ResumeEntry } from "../content/resume";
import { DEMO } from "../demo/demo";
import type { Profile } from "../profile/profile";
import { OWNER_ACCOUNT } from "../content/accounts";
import { useMessagesWindow } from "./messages-window-host";
import { ContactPerson } from "./contact-person";
import { ProfileLinks } from "./profile-parts";
import { ResumeSection } from "./resume-section";

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

/** Experience / Education rows, or the résumé's "To be added." while the list is empty. */
const EntryList = component$<{ labelledBy: string; rows: ResumeEntry[] }>(
  ({ labelledBy, rows }) =>
    rows.length ? (
      <List.Root aria-labelledby={labelledBy}>
        {rows.map((entry) => (
          <List.Item
            key={entry.title + entry.place}
            headline={`${entry.title}, ${entry.place}`}
            supportingText={entry.detail}
            trailingSupportingText={entry.dates}
          />
        ))}
      </List.Root>
    ) : (
      <p class="text-body-medium text-on-surface-variant">{RESUME.emptyNote}</p>
    ),
);

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
 * - Cards: FILLED (Google's detail cards are filled, observed): "Contact details" (availability
 *   and location rows, the location opens the Maps app), About, Experience, Education, Projects,
 *   Links.
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
        detailsTitle="Your details"
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

        {/* Availability is always there (his account's status), so the card always is. */}
        <ResumeSection
          id="contact-details"
          title="Contact details"
          full
          variant="filled"
        >
          <List.Root aria-labelledby="contact-details">
            <List.Item
              start={<AvatarPresenceGlyph presence={presence} />}
              headline={PRESENCE_WORDS[presence]}
              supportingText="Availability"
            />
            {profile.location && (
              <List.Item
                // The Maps app searches the place (`?q=`, `map-url.ts`): an in-site link.
                href={`/maps/?q=${encodeURIComponent(profile.location)}`}
                // Not on sight: the Maps route carries MapLibre (perf audit, 2026-11-24).
                prefetchBundles="intent"
                startIcon="location_on"
                headline={profile.location}
                supportingText="Show on map"
              />
            )}
          </List.Root>
        </ResumeSection>

        <ResumeSection id="contact-about" title="About" variant="filled">
          {/* Plain text: line breaks kept, never markdown or HTML. */}
          <p class="text-body-large whitespace-pre-line text-on-surface-variant">
            {profile.bio}
          </p>
        </ResumeSection>

        <ResumeSection
          id="resume-experience"
          title="Experience"
          variant="filled"
        >
          <EntryList labelledBy="resume-experience" rows={RESUME.experience} />
        </ResumeSection>

        <ResumeSection id="resume-education" title="Education" variant="filled">
          <EntryList labelledBy="resume-education" rows={RESUME.education} />
        </ResumeSection>

        {/* The public GitHub repos (build time, `scripts/repos.ts`): one link row each, the
            description under the name, the main language at the end. */}
        <ResumeSection
          id="resume-projects"
          title="Projects"
          full
          variant="filled"
        >
          <List.Root aria-labelledby="resume-projects">
            {RESUME.projects.map((repo) => (
              <List.Item
                key={repo.url}
                href={repo.url}
                // Off the site: a plain `<a>`, not the router's client navigation.
                reload
                rel="external"
                headline={repo.name}
                supportingText={repo.description || undefined}
                trailingSupportingText={repo.language || undefined}
              />
            ))}
          </List.Root>
        </ResumeSection>

        {profile.links.length > 0 && (
          <ProfileLinks
            // Google's narrow second column.
            q:slot="aside"
            id="resume-links"
            links={profile.links}
            variant="filled"
          />
        )}
      </ContactPerson>
    );
  },
);
