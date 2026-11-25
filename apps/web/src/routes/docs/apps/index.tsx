import { $, component$, useComputed$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, Layout, useSnackbar } from "@seanperez/ui";
import { setAppRemovedIn, useMyApps } from "../../../apps/use-my-apps";
import {
  CONTACT_ADDED_NOTICE,
  CONTACT_REMOVED_NOTICE,
  NOT_KEPT_NOTICE,
  YOUR_APPS_ID,
} from "../../../components/profile-parts";
import { DEMO } from "../../../demo/demo";
import { pageHead } from "../../../seo";

/**
 * "How apps work" (2026-11-25, owner: "have that send you to docs or something ... kind of like
 * a tutorial of sorts removing it and thats how you would add and remove other apps"). The
 * Contact me companion's "Remove from my apps" and `/profile/` "Your apps" Remove open this page;
 * the removal itself happens here, with Contact me as the worked example. The buttons are the real
 * thing: the same local remove / add back as Profile (`apps/use-my-apps.tsx`, doc `apps.local`),
 * nothing sent. Plain text, as `/privacy/`.
 *
 * DEMO: Contact me is the demo layer's only app, so the worked example's buttons are behind the
 * flag; with the layer off the page still explains the mechanism (`demo/demo.ts`).
 */
const LINK = "text-primary underline underline-offset-4";

export default component$(() => {
  const apps = useMyApps();
  const { showSnackbar$ } = useSnackbar();
  const busy = useSignal(false);
  const removed = useComputed$(() => apps.removed.includes("contact"));
  const set$ = $(async (remove: boolean) => {
    busy.value = true;
    const saved = await setAppRemovedIn(apps, "contact", remove);
    busy.value = false;
    await showSnackbar$(
      !saved
        ? { message: NOT_KEPT_NOTICE }
        : remove
          ? {
              message: CONTACT_REMOVED_NOTICE,
              action: "Undo",
              onAction$: $(async () => {
                await setAppRemovedIn(apps, "contact", false);
              }),
            }
          : { message: CONTACT_ADDED_NOTICE },
    );
  });
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title="How apps work" />
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid max-w-3xl content-start gap-4 text-body-large text-on-surface">
        <p>
          Apps are the parts of this site you open from the rails: Contacts,
          Messages and Maps from the navigation rail, and panels such as Contact
          me from the rail beside the page. Some apps are optional: they are
          there by default, and you can remove them and add them back. Today
          only Contact me can be removed.
        </p>

        <h2 id="remove" class="text-title-large">
          Remove an app: Contact me
        </h2>
        <ol class="grid list-decimal gap-2 ps-6">
          <li>
            Open Contact me: the waving hand button beside the page. On a narrow
            screen, open the side panel first from the tab at the screen's edge.
          </li>
          <li>
            Open its More options menu (the three dots in its title) and choose
            “Remove from my apps”. That brings you here.
          </li>
          <li>
            Choose “Remove Contact me” below. Its button leaves the rail at
            once, on every page, in this browser.
          </li>
        </ol>
        {DEMO && (
          <div class="grid gap-3">
            <p role="status" data-apps-status class="text-body-medium">
              {removed.value
                ? "Contact me is removed from your apps."
                : "Contact me is in your apps."}
            </p>
            <div class="flex flex-wrap gap-2">
              <Button
                look="filled"
                leadingIcon="delete"
                label="Remove Contact me"
                disabled={busy.value || removed.value}
                onClick$={() => set$(true)}
              />
              <Button
                look="tonal"
                leadingIcon="add"
                label="Add it back"
                disabled={busy.value || !removed.value}
                onClick$={() => set$(false)}
              />
            </div>
          </div>
        )}

        <h2 id="add" class="text-title-large">
          Add an app back
        </h2>
        <p>
          A removed app is never gone. Bring it back with Undo in the message
          that confirms the removal, with “Add it back” above, from{" "}
          <a href={`/profile/#${YOUR_APPS_ID}`} class={LINK}>
            Profile, Your apps
          </a>
          , or from the account menu's “Add Contact me back” row, which is there
          while it is removed.
        </p>

        <h2 id="where" class="text-title-large">
          Where this is kept
        </h2>
        <p>
          Which apps you removed is a small list saved in this browser (a
          document named <code>apps.local</code>, in the browser's own site
          storage). Nothing is sent to the site's server: Sean does not see it,
          and your other browsers and devices still have every app. Clearing
          this site's data in your browser brings every app back.
        </p>
        <p>
          Removing Contact me only hides it here. It does not delete messages
          you already sent; for those, see{" "}
          <a href="/privacy/" class={LINK}>
            Privacy
          </a>
          .
        </p>

        <h2 id="other-apps" class="text-title-large">
          Other apps
        </h2>
        <p>
          Contact me is the only removable app today. When more are added, they
          will work the same way: each one listed in{" "}
          <a href={`/profile/#${YOUR_APPS_ID}`} class={LINK}>
            Your apps
          </a>{" "}
          with Remove and Add back, and your choice kept in the same list in
          this browser.
        </p>
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = ({ url }) => pageHead("/docs/apps/", url);
