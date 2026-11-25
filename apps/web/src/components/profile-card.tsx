import { Slot, component$ } from "@qwik.dev/core";
import { AvatarPresenceGlyph, Card, List } from "@seanperez/ui";
import type { AvatarPresence } from "@seanperez/ui";
import { PRESENCE_WORDS } from "../content/contacts";
import { RESUME, type ResumeEntry } from "../content/resume";
import type { Profile, ProfileLink } from "@seanperez/data/profile/profile";
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
      <Card.Title id={id}>Profile</Card.Title>
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

/** Experience / Education rows, or the résumé's "To be added." while the list is empty. */
const EntryList = component$<{ labelledBy: string; rows: ResumeEntry[] }>(
  ({ labelledBy, rows }) =>
    rows.length ? (
      <List.Root padding="none" aria-labelledby={labelledBy}>
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
      <p class="px-4 text-body-medium text-on-surface-variant">
        {RESUME.emptyNote}
      </p>
    ),
);

/**
 * The OWNER's profile in the card: availability and location, About, then the résumé
 * (Experience, Education, Projects) and Links. Its sections keep the old `/about/` ids
 * (`resume-experience`, ...), so `/about/#...` links still land on them after the 301. Data: the
 * D1 profile (`profile`, from the contacts loader) and `content/resume.ts` (a module, never
 * passed through props).
 */
export const OwnerProfileSections = component$<{
  profile: Profile;
  presence?: AvatarPresence;
}>(({ profile, presence }) => (
  <>
    {(presence || profile.location) && (
      <List.Root padding="none" aria-label="Status and location">
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
    <ProfileSection id="resume-experience" title="Experience">
      <EntryList labelledBy="resume-experience" rows={RESUME.experience} />
    </ProfileSection>
    <ProfileSection id="resume-education" title="Education">
      <EntryList labelledBy="resume-education" rows={RESUME.education} />
    </ProfileSection>
    {RESUME.projects.length > 0 && (
      // The public GitHub repos (build time, `scripts/repos.ts`).
      <ProfileSection id="resume-projects" title="Projects">
        <List.Root padding="none" aria-labelledby="resume-projects">
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
      </ProfileSection>
    )}
    {profile.links.length > 0 && (
      <ProfileSection id="resume-links" title="Links">
        <LinkRows links={profile.links} labelledBy="resume-links" />
      </ProfileSection>
    )}
  </>
));

/** A profile linked by its address (any site): one link row, its brand's mark when known. */
export const LinkedProfileRow = component$<{ link: ProfileLink }>(
  ({ link }) => <LinkRows links={[link]} label="Profile link" />,
);
