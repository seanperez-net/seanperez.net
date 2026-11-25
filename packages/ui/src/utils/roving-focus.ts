import { $, sync$ } from "@qwik.dev/core";

/**
 * Arrow-key navigation for a group of controls: a rail, a toolbar, a tab row, a radio group, a
 * row of chips, a list. THE one place this library moves focus on arrow keys (rule in
 * `CLAUDE.md`): a component marks its container and adds the handler, it does not write its own.
 *
 *   <div data-roving="horizontal" onKeyDown$={[rovingKeys, onKeyDown$]}>
 *
 * `data-roving` is required (the handler does nothing without it) and names the arrows:
 * `"vertical"` Up / Down, `"horizontal"` Left / Right, `""` both. Left / Right follow the
 * reading direction (in right-to-left text Left is "next"). Options, all attributes on the
 * same container:
 *
 * - `data-roving-items="<selector>"`: what the items are (default: links, buttons and elements
 *   with a non-negative `tabindex`). Disabled items (`:disabled`, `aria-disabled="true"`) and
 *   items not on show are always skipped.
 * - `data-roving-loop="false"`: stop at the ends (default: wrap round).
 * - `data-roving-home-end="false"`: no Home / End (default: first / last item).
 * - `data-roving-select`: click the item focus lands on (a radio group: arrows choose).
 * - `data-roving-columns="<n>"`: a grid of n columns: Up / Down move a row, not one item.
 *
 * The pattern is e-store's (`sync$` cancels the key, the group is read from the DOM, disabled
 * items are skipped, `loop` as its `utils/list-navigation.ts`, which its nav rail and tabs use),
 * in ONE `sync$`:
 * it cancels the key and moves focus in the same synchronous step, so the first key press needs
 * no handler download. A group inside another group (a ToggleGroup in a Toolbar) moves within
 * itself and hands the key on at its ends (no wrap there) and for Home / End, so the arrows go
 * through the inner group as APG's toolbar example does; a key one handler used is cancelled, and
 * the next one up sees `defaultPrevented` and leaves it. A `sync$` cannot close over anything,
 * imports included (Qwik rc.5 API, `sync$`), so the body is self-contained.
 *
 * Left alone: keys typed in a text field, keys inside a popup within the group (an open menu, a
 * select's list), keys on a menu button inside an item (a row's "More"), keys with Alt / Ctrl / Meta (Alt+Left is the browser's Back), and keys an
 * inner handler already cancelled. Items inside such a popup, `inert` or hidden are skipped.
 */
export const rovingKeys = sync$(
  (event: KeyboardEvent, container: HTMLElement) => {
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!container.hasAttribute("data-roving")) return;
    const target = event.target as HTMLElement;
    // A popup inside the group (an open menu, a select's list) has its own keys.
    const popup = '[popover], [role="menu"], [role="listbox"], dialog';
    const inPopup = (el: Element) => {
      const host = el.closest(popup);
      return !!host && host !== container && container.contains(host);
    };
    if (inPopup(target)) return;
    // Keys typed in a field are text (a checkbox, a switch or a button input has no arrow keys).
    if (
      target.isContentEditable ||
      target.closest?.("textarea, select") ||
      (target.matches?.("input") &&
        !/^(checkbox|button|submit|reset|image|color|file)$/.test(
          (target as HTMLInputElement).type,
        ))
    )
      return;
    const axis = container.getAttribute("data-roving");
    const homeEnd = container.getAttribute("data-roving-home-end") !== "false";
    // A group inside another group (a ToggleGroup in a Toolbar) moves only within itself; at its
    // ends, and for Home / End, the outer group takes the key (APG toolbar).
    // A listbox is a Tab stop of its own, never part of the outer group's flow.
    const nested =
      container.getAttribute("role") !== "listbox" &&
      !!container.parentElement?.closest("[data-roving]");
    const columns = Number(container.getAttribute("data-roving-columns")) || 0;
    let key = event.key;
    if (getComputedStyle(container).direction === "rtl") {
      if (key === "ArrowLeft") key = "ArrowRight";
      else if (key === "ArrowRight") key = "ArrowLeft";
    }
    const vertical = axis !== "horizontal";
    const horizontal = axis !== "vertical";
    const forward =
      (key === "ArrowDown" && vertical) || (key === "ArrowRight" && horizontal);
    const back =
      (key === "ArrowUp" && vertical) || (key === "ArrowLeft" && horizontal);
    const edge = homeEnd && !nested && (key === "Home" || key === "End");
    if (!forward && !back && !edge) return;
    // In a grid (`data-roving-columns`), Up / Down move a row.
    const step =
      columns > 1 && (key === "ArrowUp" || key === "ArrowDown") ? columns : 1;

    const selector =
      container.getAttribute("data-roving-items") ||
      'a[href], button, [tabindex]:not([tabindex="-1"])';
    // A menu button INSIDE an item (a list row's "More", `List.Item actions`) owns its keys: its
    // arrows open the menu, and Home / End must not take focus to another row while it is the
    // one in use. From e-store commit 2b8a5bb9c (2026-11-24, its `navigateListItems`: keys from
    // `[aria-haspopup="menu"]` are left to the menu). A menu button that IS an item (a toolbar's)
    // still moves with the arrows.
    const menuButton = target.closest?.('[aria-haspopup="menu"]');
    if (
      menuButton &&
      menuButton !== container &&
      container.contains(menuButton) &&
      !menuButton.matches(selector)
    )
      return;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>(selector),
    ).filter(
      (item) =>
        !item.matches(':disabled, [aria-disabled="true"]') &&
        !item.closest("[inert]") &&
        !inPopup(item) &&
        item.checkVisibility({ visibilityProperty: true }),
    );
    // The item focus is in; from a control that is not an item (an input chip's remove button),
    // the last item before it, so the arrows go on from there.
    let current = -1;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === target || item.contains(target)) {
        current = i;
        break;
      }
      if (
        item.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING
      )
        current = i;
    }
    const last = items.length - 1;
    const loop =
      !nested && container.getAttribute("data-roving-loop") !== "false";
    let next: number;
    if (key === "Home") next = 0;
    else if (key === "End") next = last;
    else if (current < 0) next = forward ? 0 : last;
    else if (step > 1) {
      // A row up or down: stay put past the first or last row.
      next = current + (forward ? step : -step);
      if (next < 0 || next > last) next = current;
    } else if (forward) next = current < last ? current + 1 : loop ? 0 : -1;
    else next = current > 0 ? current - 1 : loop ? last : -1;
    // At a nested group's end the key goes on to the outer group.
    if (nested && (next < 0 || next === current)) return;
    // The key is ours from here: it must not scroll the page, even with nowhere to go.
    event.preventDefault();
    if (next < 0 || next === current || !items[next]) return;
    const item = items[next];
    item.focus();
    // `focus()` can leave a partly visible item clipped in a scrolling row (e-store's tabs,
    // measured there).
    item.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (container.hasAttribute("data-roving-select")) item.click();
  },
);

/** Focuses the container's first control: for a menu that has just opened. */
export const focusFirstControl = $((container: HTMLElement) => {
  container
    .querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    ?.focus();
});
