import { Slot, component$, useSignal } from "@qwik.dev/core";
import {
  AVATAR_PRESENCE_LABELS,
  Avatar,
  Button,
  Icon,
  List,
  useSnackbar,
} from "@seanperez/ui";
import { setAppRemovedIn, useMyApps } from "../apps/use-my-apps";
import { usePresence } from "../presence/use-presence";
import type { Profile, ProfileLink } from "../profile/profile";
import { BrandMark } from "./brand-mark";
import { APPS_DOCS_HREF } from "./contact-me-menu";
import { ResumeSection, type ResumeSectionVariant } from "./resume-section";

/**
 * The profile's parts, shared by `/profile/` and the Contacts app's profile
 * (`contact-profile.tsx`, which was `/about/` until 2026-11-24; owner: Profile may end up being
 * "my contact card"): ONE data source (`profile.server.ts` `getProfile`) and these components,
 * so the two can be folded together later without rework.
 *
 * `ProfileHeader` is e-store's profile header, `m3` look (`packages/feed/src/sections/
 * feed-profile.tsx`): the avatar (xl, 80dp) with presence, the name (headline-small), the status
 * line (body-large), the facts row (location with `location_on`; body-medium
 * on-surface-variant) and the presence word; then the bio. Left out: banner, actions, counts,
 * tabs. NO email (no-email rule). Presence is the VISITOR's own (`usePresence`, 2026-11-24): since
 * 2026-11-25 this header shows only the visitor's own (guest) profile on `/profile/`.
 * `seed`: the avatar's tone seed (the account id).
 * An empty profile (a new guest) shows one line saying what Edit profile adds.
 */
export const ProfileHeader = component$<{ profile: Profile; seed: string }>(
  ({ profile, seed }) => {
    const presence = usePresence();
    return (
      <section aria-labelledby="profile-name" class="flex flex-col gap-2">
        {/* e-store's header row: the avatar at the start, the page's own actions (`q:slot=
        "actions"`, e.g. Edit profile) at the end. The wrapper keeps the avatar its own size, so
        its presence dot sits on the circle. */}
        <div class="flex items-end justify-between gap-4">
          <span class="inline-flex shrink-0 rounded-full">
            <Avatar
              name={profile.name}
              seed={seed}
              size="xl"
              // The visitor's own status.
              presence={presence.shown}
              decorative
            />
          </span>
          <Slot name="actions" />
        </div>
        <h3
          id="profile-name"
          class="mt-2 text-headline-small wrap-break-word text-on-surface"
        >
          {profile.name}
        </h3>
        {profile.headline && (
          <p class="text-body-large text-on-surface">{profile.headline}</p>
        )}
        <ul class="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-medium text-on-surface-variant">
          {profile.location && (
            <li class="inline-flex items-center gap-1">
              <Icon name="location_on" size="sm" />
              <span class="sr-only">Location: </span>
              {profile.location}
            </li>
          )}
          {/* The presence word, with the dot's state. */}
          <li>{AVATAR_PRESENCE_LABELS[presence.shown]}</li>
        </ul>
        {/* Plain text: line breaks kept, never markdown or HTML. */}
        {profile.bio ? (
          <p class="text-body-large whitespace-pre-line text-on-surface-variant">
            {profile.bio}
          </p>
        ) : (
          !profile.headline &&
          !profile.location && (
            <p class="text-body-medium text-on-surface-variant">
              Add a headline and a short bio with Edit profile. They're kept in
              this browser only.
            </p>
          )
        )}
      </section>
    );
  },
);

/**
 * The profile's links as bare M3 list rows (no card, no heading): one row each, the brand mark
 * (`BrandMark`) or the `link` symbol at the start, the `open_in_new` mark at the end (`List.Item
 * rel="external"`). Used by `ProfileLinks` (the "Links" card on /profile/ and the contact
 * profile): there the label and address are shown, so rows fit better than an icon row. The
 * Contact me companion shows the same links as icons only (`social-links.tsx`, 2026-11-24).
 * Name the list with `labelledBy` or `label`.
 */
export const LinkRows = component$<{
  links: ProfileLink[];
  labelledBy?: string;
  label?: string;
}>(({ links, labelledBy, label }) => (
  <List.Root aria-labelledby={labelledBy} aria-label={label}>
    {links.map((link) => (
      <List.Item
        key={link.href}
        href={link.href}
        // Off the site: a plain `<a>`, not the router's client navigation.
        reload
        rel={link.me ? "me external" : "external"}
        headline={link.label}
        supportingText={link.detail}
        startIcon={link.brand ? undefined : "link"}
        // The visible label names the link: the mark is decorative.
        start={link.brand ? <BrandMark brand={link.brand} /> : undefined}
      />
    ))}
  </List.Root>
));

/** The profile's links in a card titled "Links" (the contact profile's and `/profile/`'s). */
export const ProfileLinks = component$<{
  id: string;
  links: ProfileLink[];
  variant?: ResumeSectionVariant;
}>(({ id, links, variant }) => (
  <ResumeSection id={id} title="Links" full variant={variant}>
    <LinkRows links={links} labelledBy={id} />
  </ResumeSection>
));

/** Said when Contact me is removed or added back (Undo / Add back are the way back). */
export const CONTACT_REMOVED_NOTICE =
  "Contact me removed. Add it back from Profile.";
export const CONTACT_ADDED_NOTICE = "Contact me is back in your apps.";
export const NOT_KEPT_NOTICE =
  "Couldn't save in this browser. It lasts until you leave this page.";

/** The "Your apps" section's id (the account menu's "Add Contact me back" links to it). */
export const YOUR_APPS_ID = "your-apps";

/**
 * "Your apps" (2026-11-25, owner: Contact me is "its own little app that can be deleted but its
 * there by default"): the site's removable apps, each with Remove or Add back, saved in the
 * visitor's browser (`apps/my-apps.ts`). The one place that always lists Contact me, so a removed
 * one can always come back (with the Undo in the removal snackbar and the account menu's row).
 * Remove opens "How apps work" (`/docs/apps/`, the removal happens there); Add back acts here.
 */
export const YourApps = component$(() => {
  const apps = useMyApps();
  const { showSnackbar$ } = useSnackbar();
  const busy = useSignal(false);
  return (
    <ResumeSection id={YOUR_APPS_ID} title="Your apps" full>
      <List.Root aria-labelledby={YOUR_APPS_ID}>
        <List.Item
          startIcon="waving_hand"
          headline="Contact me"
          supportingText={
            apps.removed.includes("contact")
              ? "Removed. Add it back to message Sean."
              : "Sends a message to Sean. On by default."
          }
          end={
            apps.removed.includes("contact") ? (
              <Button
                look="tonal"
                leadingIcon="add"
                label="Add back"
                disabled={busy.value}
                onClick$={async () => {
                  busy.value = true;
                  const saved = await setAppRemovedIn(apps, "contact", false);
                  busy.value = false;
                  await showSnackbar$({
                    message: saved ? CONTACT_ADDED_NOTICE : NOT_KEPT_NOTICE,
                  });
                }}
              />
            ) : (
              // Removing opens "How apps work" (2026-11-25, owner: removing "send you to docs
              // ... a tutorial of sorts"), where the removal happens.
              <Button
                look="text"
                label="Remove"
                type="link"
                href={APPS_DOCS_HREF}
              />
            )
          }
        />
      </List.Root>
    </ResumeSection>
  );
});
