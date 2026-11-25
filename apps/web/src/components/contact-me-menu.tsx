import { $, component$, sync$ } from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";
import { Icon, Menu } from "@seanperez/ui";

/** Where "Remove from my apps" goes: the tutorial, at its removal steps. */
export const APPS_DOCS_HREF = "/docs/apps/#remove";

/**
 * Client navigation for the menu's link rows (2026-11-25). `Menu.Item href` renders a plain
 * `<a>` (a full page load), and the library's menu is not ours to change, so this is the
 * router `<Link>`'s own split (`@qwik.dev/router` rc.5 `Link`: a `sync$` that cancels a plain
 * click, then a `$` that calls `nav()` when it was cancelled), across the menu's two elements.
 * On the menu (`Menu.Content`, an ancestor) with `capture:click` (qwikloader rc.5: capture
 * handlers run from the outside in, before the item's), so it has cancelled the click before
 * the item's `$` reads `defaultPrevented`, whether the item's handlers are loaded yet or not. A
 * modified click (Cmd / Ctrl / Shift / Alt: new tab or window) and a middle click are left to the
 * browser. Enter on the row clicks it (`menu-keys.ts` `chooseMenuItem`): a plain click.
 * `sync$` cannot close over anything: the row is marked `data-client-nav`.
 */
const cancelPlainLinkClick = sync$((event: MouseEvent) => {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const link = (event.target as Element | null)?.closest?.(
    "a[href][data-client-nav]",
  );
  if (link) event.preventDefault();
});

/**
 * The Contact me companion's "More" menu (2026-11-25, owner: Contact me is "its own little app that
 * can be deleted but its there by default"), in the supporting pane's title row
 * (`Layout.SupportingPane` `header-actions`, from e-store). ONE item, "Remove from my apps".
 *
 * Since 2026-11-25 (later; owner: "have that send you to docs or something ... a tutorial of
 * sorts removing it and thats how you would add and remove other apps") the item is a LINK to
 * `/docs/apps/` ("How apps work"), where the removal happens with Contact me as the worked
 * example; that page replaces the confirm dialog this menu had. Saved in the visitor's browser
 * only (`apps/my-apps.ts`); the owner's inbox is untouched. A client navigation (above), so the
 * page's buttons are live at once (a full load could take a click before the page was ready).
 */
export const ContactMeMenu = component$(() => {
  const nav = useNavigate();
  return (
    <Menu.Root>
      <Menu.Trigger look="plain" aria-label="More options for Contact me">
        <Icon name="more_vert" size="sm" />
      </Menu.Trigger>
      <Menu.Content
        align="end"
        capture:click
        onClick$={cancelPlainLinkClick}
      >
        <Menu.Item
          data-remove-app="contact"
          data-client-nav
          href={APPS_DOCS_HREF}
          onClick$={$((event: PointerEvent) => {
            if (event.defaultPrevented) return nav(APPS_DOCS_HREF);
          })}
        >
          Remove from my apps
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
});
