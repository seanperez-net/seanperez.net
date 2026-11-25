import { $, component$ } from "@qwik.dev/core";
import { FAB, useSnackbar } from "@seanperez/ui";
import type { IconName } from "@seanperez/ui";
import { MESSAGES_NEW_CHAT_NOTICE } from "../content/conversations";
import { DEMO } from "../demo/demo";

/**
 * Each app's KEY ACTION (owner, 2026-11-24: "we have a create button in the estore and we have
 * fabs etc for all of the packages ... maybe we need that fab here"), shown as a FAB:
 * - from 600px at the top of the navigation rail (`Layout.Rail fab`, e-store's prop; e-store's
 *   `apps/master` puts its "New project" FAB there), placed by `routes/layout.tsx`;
 * - below 600px (no rail) at the lower end corner of the app's pane, on its list view only
 *   (e-store mail's compose FAB, `mail-app-shell.tsx` ~391-402), placed by the app's layout.
 * M3, read 2026-11-24 (m3.material.io/components/floating-action-button/guidelines): "In
 * compact and medium breakpoints, the best place for the FAB is typically the lower right
 * corner"; "In expanded breakpoints, consider placing the FAB in the upper left corner, like in
 * the navigation rail". Medium (600-839) has the rail here, so the rail FAB from 600px.
 *
 * Contacts' Create contact is REAL and local (2026-11-24): a link to `/contacts/new/`. Messages'
 * New chat still starts nothing and shows the demo snackbar (the site-wide `Snackbar.Root` in
 * `routes/layout.tsx`).
 */
export interface AppAction {
  label: string;
  icon: IconName;
  /** Where it goes: a real action (Contacts' Create contact, 2026-11-24). */
  href?: string;
  /** What the demo snackbar says, for an action that does nothing yet. */
  notice?: string;
  /** DEMO: only the showcase layer has it (it only shows the demo snackbar). */
  demo?: boolean;
}

/** The app whose action a path shows, by the rail destination it sits under. */
const APP_ACTIONS: { href: string; action: AppAction }[] = [
  {
    href: "/messages/",
    action: {
      label: "New chat",
      icon: "chat_add_on",
      notice: MESSAGES_NEW_CHAT_NOTICE,
      demo: true,
    },
  },
  {
    href: "/contacts/",
    action: {
      label: "Create contact",
      icon: "person_add",
      // Real and local since 2026-11-24 (`routes/contacts/new/`): the editor, saved in this
      // browser. Until then the demo snackbar.
      href: "/contacts/new/",
    },
  },
];

// DEMO: an action that only shows the demo snackbar (New chat) exists only with the layer on; off,
// there is no FAB for it (a button that starts nothing is worse than none, second agent
// 2026-11-24). A real action (Create contact) shows either way.
export const appActionFor = (pathname: string): AppAction | null => {
  const action =
    APP_ACTIONS.find(({ href }) => pathname.startsWith(href))?.action ?? null;
  return action && (!action.demo || DEMO) ? action : null;
};

/**
 * The FAB itself: icon only (a collapsed rail has room for a 56dp FAB, e-store's note), named by
 * `aria-label` and the site's plain tooltip (`data-tooltip`, as `IconButton`). `color="primary"`
 * (M3's primary container, the FAB default).
 */
export const AppActionFab = component$<{ action: AppAction }>(({ action }) => {
  const { showSnackbar$ } = useSnackbar();
  const notice = action.notice ?? "";
  return action.href ? (
    <FAB
      type="link"
      href={action.href}
      icon={action.icon}
      aria-label={action.label}
      data-tooltip={action.label}
    />
  ) : (
    <FAB
      icon={action.icon}
      aria-label={action.label}
      data-tooltip={action.label}
      onClick$={$(() => showSnackbar$({ message: notice }))}
    />
  );
});
