import { $, component$, useSignal } from "@qwik.dev/core";
import { Avatar, Button, Modal, TextField, useSnackbar } from "@seanperez/ui";
import { GUEST_ACCOUNT } from "../content/accounts";
import { PROFILE_MAX } from "@seanperez/data/profile/limits";
import type { Profile } from "@seanperez/data/profile/profile";
import { diffProfile, type ProfileFields } from "../profile/profile-local";
import {
  replaceProfile,
  saveProfileChanges,
  useProfileOverride,
} from "../profile/use-profile";
import { PlaceField } from "./place-field";

/**
 * "Edit profile" (was `profile-edit-demo.tsx`, a demo Save that only showed "This is a demo
 * account"). Since 2026-11-24 (owner: "yes ... save profile locally") Save is REAL and LOCAL: the
 * changed fields go into the visitor's own `profile.local` doc through the shared seam
 * (`profile/use-profile.tsx` `saveProfileChanges`), never to the server, and the visitor's
 * screen shows their profile from then on (`/profile/`, the account menu, Messages). Not a demo
 * any more, so not behind DEMO: the site is the real app minus sync.
 *
 * The form, as e-store's feed profile (`packages/feed/src/components/profile-edit-dialog.tsx`):
 * an outlined "Edit profile" button opening a `Modal` with the fields, Cancel and Save.
 * `position="adaptive"`: M3's full-screen dialog below 600px, a 560px basic dialog from 600px.
 * Needs a `Snackbar.Root` above it. No email field (no-email rule).
 *
 * Since 2026-11-25 it edits the GUEST's profile ("You", `visitor-is-guest-you`), never the
 * owner's: the guest starts with no links, so the form has no link fields until links can be
 * added (PLAN.md, open).
 *
 * `profile` is what the page SHOWS (override included): the form opens with it, and Save stores
 * only what differs from it (`diffProfile`). The form is keyed by the doc's stamp, so after a
 * save, a reset or another tab's save it reopens with the current values.
 */
export const SAVED_NOTICE = "Profile saved on this device. Only you see it.";
export const RESET_NOTICE = "Profile reset to the original.";
export const NOT_STORED_NOTICE =
  "Couldn't save in this browser. Your changes last until you leave this page.";
export const PHOTO_NOTICE = "Photos aren't saved yet.";

/** Undo of a save or a reset: the fields from before, with a new stamp (it syncs too). */
const useUndo = () => {
  const override = useProfileOverride();
  const { showSnackbar$ } = useSnackbar();
  return $(async (message: string, saved: boolean, before: ProfileFields) => {
    await showSnackbar$({
      message: saved ? message : NOT_STORED_NOTICE,
      action: "Undo",
      onAction$: $(async () => {
        await replaceProfile(override, before);
      }),
    });
  });
};

export const ProfileEdit = component$<{ profile: Profile }>(({ profile }) => {
  const open = useSignal(false);
  const error = useSignal<{ field: string; text: string } | null>(null);
  const override = useProfileOverride();
  const { showSnackbar$ } = useSnackbar();
  const announce$ = useUndo();

  return (
    <Modal.Root bind:open={open} position="adaptive">
      <Button
        look="outlined"
        leadingIcon="edit"
        label="Edit profile"
        aria-haspopup="dialog"
        onClick$={() => {
          error.value = null;
          open.value = true;
        }}
      />
      <Modal.Content>
        {/* A real form: Enter saves. Nothing is posted (`preventdefault:submit`; the values are
            read from the form and saved in the browser). `autocomplete="off"`: the browser must
            not offer the visitor's own saved addresses into a profile card, nor keep history. */}
        {/* `contents`: the dialog lays out the bar, Header, Section and Footer as its own
            children. Keyed by the doc's stamp: reopened, it shows the saved values. */}
        <form
          key={override.updatedAt}
          class="contents"
          autocomplete="off"
          noValidate
          preventdefault:submit
          onSubmit$={async (_: SubmitEvent, form: HTMLFormElement) => {
            const data = new FormData(form);
            const read = (name: string) => String(data.get(name) ?? "");
            const diff = diffProfile(profile, {
              name: read("name"),
              headline: read("headline"),
              location: read("location"),
              bio: read("bio"),
              linkHrefs: profile.links.map((_, i) => read(`links.${i}.href`)),
            });
            if ("error" in diff) {
              error.value =
                diff.error === "name"
                  ? { field: "name", text: "Enter a name." }
                  : {
                      field: diff.error,
                      text: "Enter an https:// address, or leave it empty to remove the link.",
                    };
              // After the error renders (the field re-renders with it).
              const name =
                diff.error === "name" ? "name" : `${diff.error}.href`;
              setTimeout(
                () =>
                  form
                    .querySelector<HTMLElement>(`[name="${name}"]`)
                    ?.focus(),
                50,
              );
              return;
            }
            error.value = null;
            open.value = false;
            const result = await saveProfileChanges(override, diff.fields);
            if (!result.changed) return;
            await announce$(SAVED_NOTICE, result.saved, result.before);
          }}
        >
          {/* Compact only: the full-screen bar. The Title below names the dialog at every
              width. */}
          <Modal.CloseTitleAction
            title="Edit profile"
            closeLabel="Cancel"
            actionLabel="Save"
            actionType="submit"
          />
          {/* From 600px only. */}
          <Modal.Header>
            <Modal.Title>Edit profile</Modal.Title>
          </Modal.Header>
          <Modal.Section>
            <div class="grid gap-4 pt-2">
              <div class="flex items-center gap-4">
                <Avatar
                  name={profile.name}
                  seed={GUEST_ACCOUNT.id}
                  size="lg"
                  decorative
                />
                {/* Photos are not part of the local profile yet (second agent: add them later
                    with Contacts' photo checks). */}
                <Button
                  look="text"
                  leadingIcon="upload_file"
                  label="Change photo"
                  onClick$={() => showSnackbar$({ message: PHOTO_NOTICE })}
                />
              </div>
              <TextField
                name="name"
                label="Name"
                // A form dialog opens on its first field (owner, 2026-11-24, as Contact).
                autofocus
                required
                maxLength={PROFILE_MAX.name}
                value={profile.name}
                error={
                  error.value?.field === "name" ? error.value.text : undefined
                }
              />
              <TextField
                name="headline"
                label="Headline"
                maxLength={PROFILE_MAX.headline}
                value={profile.headline}
              />
              <PlaceField
                name="location"
                maxLength={PROFILE_MAX.location}
                value={profile.location}
              />
              <TextField
                name="bio"
                type="textarea"
                rows={4}
                label="Bio"
                maxLength={PROFILE_MAX.bio}
                value={profile.bio}
              />
              {profile.links.map((link, i) => (
                <TextField
                  key={`${i}-${link.href}`}
                  name={`links.${i}.href`}
                  type="url"
                  label={link.label}
                  leadingIcon="link"
                  maxLength={PROFILE_MAX.linkHref}
                  value={link.href}
                  error={
                    error.value?.field === `links.${i}`
                      ? error.value.text
                      : undefined
                  }
                />
              ))}
            </div>
          </Modal.Section>
          <Modal.Footer>
            <Modal.Close>Cancel</Modal.Close>
            <Button type="submit" look="text" label="Save" />
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
});

/**
 * "Reset to the original" (2026-11-24): drops the visitor's changes (an empty override with a new
 * stamp), with Undo. Shown only while their profile differs from the server's.
 */
export const ProfileReset = component$(() => {
  const override = useProfileOverride();
  const announce$ = useUndo();
  return (
    <Button
      look="text"
      leadingIcon="restart_alt"
      label="Reset to the original"
      onClick$={async () => {
        const result = await replaceProfile(override, {});
        await announce$(RESET_NOTICE, result.saved, result.before);
      }}
    />
  );
});
