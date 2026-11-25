import { component$, useComputed$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout } from "@seanperez/ui";
import { ProfileEdit, ProfileReset } from "../../components/profile-edit";
import {
  ProfileHeader,
  ProfileLinks,
  YourApps,
} from "../../components/profile-parts";
import { GUEST_ACCOUNT } from "../../content/accounts";
import { DEMO } from "../../demo/demo";
import { effectiveFields } from "../../profile/profile-local";
import {
  GUEST_PROFILE,
  useProfileOverride,
  useShownProfile,
} from "../../profile/use-profile";
import { pageHead } from "../../seo";

/**
 * The VISITOR's own profile (owner decision 2026-11-25, memory `visitor-is-guest-you`): every
 * visitor is a guest, "You" until they set a name here. "Edit profile" (`ProfileEdit`) saves
 * THEIR changes in THEIR browser (doc `profile.local`, `profile/profile-local.ts`), and their
 * screen shows them here, in the account menu and in Messages (`useShownProfile`). Nothing is
 * sent, and nothing here is the owner's: his profile is his contact page (`/contacts/sean-perez/`)
 * and is edited at `/admin/profile` (behind Cloudflare Access). Until 2026-11-25 this page showed
 * the owner's server profile with the visitor's edit on top. "Reset to the original" drops the
 * changes, with Undo. Not behind DEMO: a local edit is the real app minus sync.
 *
 * "Your apps" (2026-11-25): the site's removable apps (Contact me) with Remove / Add back, the
 * way back after removing one (`apps/my-apps.ts`). DEMO: Contact me is the layer's only app.
 */
export default component$(() => {
  const override = useProfileOverride();
  const profile = useShownProfile();
  // Only while the visitor's profile differs from the guest's base.
  const edited = useComputed$(
    () =>
      Object.keys(effectiveFields(GUEST_PROFILE, override.fields)).length > 0,
  );
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title="Profile" />
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid max-w-3xl content-start gap-4">
        {/* Save's and Reset's snackbars (with Undo) are the site's ONE `Snackbar.Root`
          (root layout). */}
        <ProfileHeader profile={profile.value} seed={GUEST_ACCOUNT.id}>
          <div q:slot="actions" class="flex flex-wrap justify-end gap-2">
            {edited.value && <ProfileReset />}
            <ProfileEdit profile={profile.value} />
          </div>
        </ProfileHeader>
        {profile.value.links.length > 0 && (
          <ProfileLinks id="profile-links" links={profile.value.links} />
        )}
        {DEMO && <YourApps />}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = ({ url }) => pageHead("/profile/", url);
