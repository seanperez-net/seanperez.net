import { component$ } from "@qwik.dev/core";
import { Icon, Menu } from "@seanperez/ui";

/** Where "Remove from my apps" goes: the tutorial, at its removal steps. */
export const APPS_DOCS_HREF = "/docs/apps/#remove";

/**
 * The Contact me companion's "More" menu (2026-11-25, owner: Contact me is "its own little app that
 * can be deleted but its there by default"), in the supporting pane's title row
 * (`Layout.SupportingPane` `header-actions`, from e-store). ONE item, "Remove from my apps".
 *
 * Since 2026-11-25 (later; owner: "have that send you to docs or something ... a tutorial of
 * sorts removing it and thats how you would add and remove other apps") the item is a LINK to
 * `/docs/apps/` ("How apps work"), where the removal happens with Contact me as the worked
 * example; that page replaces the confirm dialog this menu had. Saved in the visitor's browser
 * only (`apps/my-apps.ts`); the owner's inbox is untouched.
 */
export const ContactMeMenu = component$(() => (
  <Menu.Root>
    <Menu.Trigger look="plain" aria-label="More options for Contact me">
      <Icon name="more_vert" size="sm" />
    </Menu.Trigger>
    <Menu.Content align="end">
      <Menu.Item data-remove-app="contact" href={APPS_DOCS_HREF}>
        Remove from my apps
      </Menu.Item>
    </Menu.Content>
  </Menu.Root>
));
