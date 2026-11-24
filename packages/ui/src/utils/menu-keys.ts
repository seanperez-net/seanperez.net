import { sync$ } from "@qwik.dev/core";

/**
 * The APG menu keys for a row of a `role="menu"`, as `sync$` handlers (so `preventDefault()`
 * happens in time), on every `Menu` and `Dropdown` row. A menu's keys are more than
 * `roving-focus.ts` (type-ahead; Tab closes the menu), so they are their own utility; both read
 * the group from the DOM and skip disabled rows.
 *
 * A `sync$` cannot close over anything (Qwik rc.5 API docs), so each body is self-contained.
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/menu/
 */
export const navigateMenuItems = sync$((event: KeyboardEvent) => {
  const el = event.target as HTMLElement;
  if (!el || !el.closest) return;
  const target = el.closest(
    '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
  ) as HTMLElement | null;
  if (!target) return;
  const menu = target.closest('[role="menu"]') as HTMLElement | null;
  if (!menu) return;

  // Tab closes the menu and moves on (no preventDefault).
  if (event.key === "Tab") {
    if (menu.matches(":popover-open")) menu.hidePopover();
    return;
  }

  const items = Array.from(
    menu.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]:not([aria-disabled="true"]), [role="menuitemradio"]:not([aria-disabled="true"])',
    ),
  ).filter((item) => item.closest('[role="menu"]') === menu);
  const currentIndex = items.indexOf(target);
  let nextIndex = -1;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    nextIndex = currentIndex + 1 >= items.length ? 0 : currentIndex + 1;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    nextIndex = currentIndex - 1 < 0 ? items.length - 1 : currentIndex - 1;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    // No submenus: Left / Right do nothing in the menu, and must not reach a group around it
    // (a Toolbar's or a rail's `rovingKeys` would move focus out of the open menu).
    event.preventDefault();
    return;
  } else if (event.key === "Home") {
    event.preventDefault();
    nextIndex = 0;
  } else if (event.key === "End") {
    event.preventDefault();
    nextIndex = items.length - 1;
  } else if (
    event.key.length === 1 &&
    event.key !== " " &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    // Type-ahead: characters typed within 500ms add up.
    event.preventDefault();
    const char = event.key.toLowerCase();
    const now = Date.now();
    const previous = menu.getAttribute("data-typeahead-buffer") || "";
    const previousTime = Number(menu.getAttribute("data-typeahead-time") || 0);
    const buffer = now - previousTime < 500 ? previous + char : char;
    menu.setAttribute("data-typeahead-buffer", buffer);
    menu.setAttribute("data-typeahead-time", String(now));
    const start = buffer.length === 1 ? currentIndex + 1 : 0;
    for (let offset = 0; offset < items.length; offset++) {
      const index = (start + offset) % items.length;
      const text = items[index].textContent?.trim().toLowerCase();
      if (text && text.startsWith(buffer)) {
        items[index].focus();
        return;
      }
    }
    return;
  }

  if (nextIndex >= 0 && nextIndex < items.length) items[nextIndex].focus();
});

/** Enter and Space choose the focused row (its click), without scrolling the page. */
export const chooseMenuItem = sync$((event: KeyboardEvent) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  const el = event.target as HTMLElement;
  const item = el?.closest?.(
    '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
  ) as HTMLElement | null;
  (item ?? el)?.click();
});
