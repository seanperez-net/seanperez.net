import { $, component$, useSignal } from "@qwik.dev/core";
import { Icon, Menu, useSnackbar } from "@seanperez/ui";
import { setAppRemovedIn, useMyApps } from "../apps/use-my-apps";
import { ConfirmDialog } from "./contacts-dialogs";
import { CONTACT_REMOVED_NOTICE, NOT_KEPT_NOTICE } from "./profile-parts";

/**
 * The Contact me companion's "More" menu (2026-11-25, owner: Contact me is "its own little app that
 * can be deleted but its there by default"), in the supporting pane's title row
 * (`Layout.SupportingPane` `header-actions`, from e-store). ONE item, "Remove from my apps",
 * which confirms first (an M3 basic dialog, `ConfirmDialog`, as the Contacts app's removals)
 * and says where it comes back: Undo in the snackbar, `/profile/` "Your apps", and the account
 * menu's "Add Contact me back" row while it is removed. Saved in the visitor's browser only
 * (`apps/my-apps.ts`); the owner's inbox is untouched.
 */
export const ContactMeMenu = component$(() => {
  const apps = useMyApps();
  const { showSnackbar$ } = useSnackbar();
  const confirmOpen = useSignal(false);
  const remove$ = $(async () => {
    const saved = await setAppRemovedIn(apps, "contact", true);
    await showSnackbar$({
      message: saved ? CONTACT_REMOVED_NOTICE : NOT_KEPT_NOTICE,
      action: "Undo",
      onAction$: $(async () => {
        await setAppRemovedIn(apps, "contact", false);
      }),
    });
  });
  return (
    <>
      <Menu.Root>
        <Menu.Trigger look="plain" aria-label="More options for Contact me">
          <Icon name="more_vert" size="sm" />
        </Menu.Trigger>
        <Menu.Content align="end">
          <Menu.Item
            data-remove-app="contact"
            onClick$={() => {
              confirmOpen.value = true;
            }}
          >
            Remove from my apps
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <ConfirmDialog
        open={confirmOpen}
        title="Remove Contact me?"
        description="It leaves your apps in this browser only. You can add it back any time from Profile or the account menu."
        confirmLabel="Remove"
        onConfirm$={remove$}
      />
    </>
  );
});
