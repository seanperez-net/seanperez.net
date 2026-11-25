import { Slot, component$ } from "@qwik.dev/core";
import { AvatarPresenceGlyph, Card, List } from "@seanperez/ui";
import type { AvatarPresence } from "@seanperez/ui";
import { PRESENCE_WORDS } from "../content/contacts";
import { PROFILE_CONTENT } from "../content/profile-content";
import {
  linkDetail,
  type Profile,
  type ProfileLink,
} from "@seanperez/db/profile/profile";
import type {
  PublicProfileEntry,
  PublicProfileSection,
} from "@seanperez/db/profile/profile-sections";
import { LinkRows } from "./profile-parts";

/**
 * A contact's PROFILE CARD (2026-11-25, owner: "a google profile so i guess thats where we could put
 * the resume just put it in the profile card ... some have profiles ... we need to be able to do
 * that also"). Google's model (People API, read 2026-11-25, `.claude/notes/
 * contacts-google-parity-2026-11-25.md`): a person is merged from SOURCES, the visitor's CONTACT
 * and the person's own PROFILE; profile values are the person's and "can't be edited" in the
 * contact (Contacts Help 7280886). So the page has two cards: "Contact details" (the visitor's,
 * editable) and this one (the profile's, read-only here).
 *
 * ONE card (second agent, 2026-11-25: "it is literally 'in the profile card'"), h3 "Profile" with
 * a caption saying whose it is, then h4 sections (`ProfileSection`). NEW, not in e-store (its
 * person view has no profile).
 */
export const ProfileCard = component$<{
  /** The card's heading id (the sections' lists are named by their own h4s). */
  id: string;
  /** The caption under "Profile": whose it is and that it is read-only here. */
  source: string;
}>(({ id, source }) => (
  <Card.Root variant="filled">
    <Card.Header>
      <Card.Title id={id} size="medium">
        Profile
      </Card.Title>
      <Card.Description>{source}</Card.Description>
    </Card.Header>
    <Card.Content variant="full">
      <div class="grid gap-2 pb-2">
        <Slot />
      </div>
    </Card.Content>
  </Card.Root>
));

/** One part of the card: an h4 and its body (a list edge to edge, or text with the 16dp gutter). */
export const ProfileSection = component$<{
  id: string;
  title: string;
  /** Text, not a list: the 16dp gutter. */
  text?: boolean;
}>(({ id, title, text }) => (
  <section aria-labelledby={id} class="grid gap-1">
    <h4 id={id} class="px-4 pt-2 text-title-small text-on-surface-variant">
      {title}
    </h4>
    {text ? (
      <div class="px-4">
        <Slot />
      </div>
    ) : (
      <Slot />
    )}
  </section>
));

/**
 * One section entry (m3-hierarchy B4): the title as the headline; where (organisation · place, and
 * the entry's site as text, so it also reads on paper) or a skill group's keywords as supporting
 * text; the dates as trailing text. Its summary and each highlight follow as rows of their own,
 * supporting text only (body-medium, on-surface-variant: under the entry, never clipped; owner
 * 2026-11-25: "one row per highlight"). NOT a list nested in the row: `Item`'s default slot sits
 * BEFORE the headline and the library has no nested list in a row (`list.md`, OPEN). All
 * non-interactive. Returns sibling rows, so it is a function, not a component.
 */
const sectionEntryRows = (entry: PublicProfileEntry) => {
  const where = [entry.where, entry.url ? linkDetail(entry.url) : ""]
    .filter(Boolean)
    .join(" · ");
  const lines = [entry.summary, ...entry.highlights].filter(Boolean);
  return [
    <List.Item
      key={entry.id}
      // The anchor search results link to (`search/entries.ts`).
      id={`profile-${entry.id}`}
      headline={entry.position}
      headlineLines="auto"
      supportingText={
        entry.keywords.length ? entry.keywords.join(" · ") : where || undefined
      }
      trailingSupportingText={entry.dates || undefined}
    />,
    ...lines.map((line, i) => (
      <List.Item
        key={`${entry.id}-${i}`}
        supportingText={line}
        supportingLines="auto"
      />
    )),
  ];
};

/**
 * The profile's SECTIONS (2026-11-25): Work, Education, Skills, ... and custom ones such as Food &
 * beverage, as Google's profile shows them (owner: "the real app at google.com doesnt have a resume
 * it has the profile"). ONE list of collapsible sections (`List.Group`, a native `<details>`: opens
 * without JavaScript, prints open; owner: "kind of like an accordian ... allowed to work in the
 * pane"). A `shown` section starts open, a `collapsed` one closed: the admin's data, never code.
 * Hidden sections and entries never reach here (removed on the server, `getProfile`). Each section's
 * title is its group header, so there is no umbrella heading.
 */
export const SectionGroups = component$<{ sections: PublicProfileSection[] }>(
  ({ sections }) => (
    <List.Root
      id="profile-sections"
      padding="none"
      density="compact"
      aria-label="Profile sections"
    >
      {sections.map((section) => (
        <List.Group
          key={section.id}
          id={`profile-${section.id}`}
          value={section.id}
          open={section.open}
        >
          <List.GroupHeader
            label={section.title}
            supportingText={
              section.entries.length === 1
                ? "1 entry"
                : `${section.entries.length} entries`
            }
          />
          <List.GroupContent>
            {section.entries.flatMap(sectionEntryRows)}
          </List.GroupContent>
        </List.Group>
      ))}
    </List.Root>
  ),
);

/**
 * The OWNER's profile in the card: availability and location, About, his sections (Work,
 * Education, ...: `profile.sections`), Projects and Links. Anchors: `profile-<section id>`,
 * `profile-<entry id>`, `profile-projects`, `profile-links`. Data: the D1 profile (`profile`, from
 * the contacts loader, sections included) and `content/profile-content.ts` (projects, a module,
 * never passed through props).
 */
export const OwnerProfileSections = component$<{
  profile: Profile;
  presence?: AvatarPresence;
}>(({ profile, presence }) => (
  <>
    {(presence || profile.location) && (
      <List.Root
        padding="none"
        density="compact"
        aria-label="Status and location"
      >
        {presence && (
          <List.Item
            start={<AvatarPresenceGlyph presence={presence} />}
            headline={PRESENCE_WORDS[presence]}
            supportingText="Availability"
          />
        )}
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
    )}
    {profile.bio && (
      <ProfileSection id="contact-about" title="About" text>
        {/* Plain text: line breaks kept, never markdown or HTML. */}
        <p class="text-body-large whitespace-pre-line text-on-surface-variant">
          {profile.bio}
        </p>
      </ProfileSection>
    )}
    {profile.sections && profile.sections.length > 0 && (
      <SectionGroups sections={profile.sections} />
    )}
    {PROFILE_CONTENT.projects.length > 0 && (
      // The public GitHub repos (build time, `scripts/repos.ts`).
      <ProfileSection id="profile-projects" title="Projects">
        <List.Root
          padding="none"
          density="compact"
          aria-labelledby="profile-projects"
        >
          {PROFILE_CONTENT.projects.map((repo) => (
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
      </ProfileSection>
    )}
    {profile.links.length > 0 && (
      <ProfileSection id="profile-links" title="Links">
        <LinkRows
          links={profile.links}
          labelledBy="profile-links"
          density="compact"
        />
      </ProfileSection>
    )}
  </>
));

/** A profile linked by its address (any site): one link row, its brand's mark when known. */
export const LinkedProfileRow = component$<{ link: ProfileLink }>(
  ({ link }) => (
    <LinkRows links={[link]} label="Profile link" density="compact" />
  ),
);
