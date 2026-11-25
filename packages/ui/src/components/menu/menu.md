# Menu

Material 3 menu on the Popover API, from e-store's `components/menu/` (2026-11-23): a menu
button (`Menu.Trigger`) opening a `role="menu"` popover in the top layer.

- **M3**: https://m3.material.io/components/menus/specs
- **WAI-ARIA APG**: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ and
  https://www.w3.org/WAI/ARIA/apg/patterns/menu/
- **Popover API**: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API

## Parts

| Part              | Element                          | Role / attributes                                                                                       |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Menu.Root`       | `<div>`                          | Context: ids, refs, `open`                                                                              |
| `Menu.Trigger`    | `<button>`                       | `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, `popovertarget`                               |
| `Menu.Content`    | `<div>`                          | `role="menu"`, `popover="auto"`, `aria-labelledby` the trigger                                          |
| `Menu.Item`       | `<div>` / `<a>`                  | `role="menuitem"`, `tabindex="-1"`; `href` makes a real link                                            |
| `Menu.RadioGroup` | `<div>`                          | `role="group"` (name it with `aria-label`), shared value                                                |
| `Menu.RadioItem`  | `<div>` / `<button type=submit>` | `role="menuitemradio"`, `aria-checked`; `name` makes a no-JS submit                                     |
| `Menu.Separator`  | `<hr>`                           | implicit `separator`                                                                                    |
| `Menu.Sub`        | `<div role="none">`              | Context: one submenu (2026-11-24, e-store's)                                                            |
| `Menu.SubTrigger` | `<div>`                          | `role="menuitem"`, `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`; `submenuIcon`, `openDelay`, `checked` (NEW 2026-11-24: the checked fill as `data-checked`, never `aria-checked`) |
| `Menu.SubContent` | `<div>`                          | `Menu.Content` with `side="end"`                                                                        |

## API

- `Menu.Root`: `open?: Signal<boolean>`, `onOpenChange$`.
- `Menu.Trigger`: `look` `outlined` (default) / `plain` / `bare` (no padding: an avatar);
  `size` `xs` 32dp / `sm` 40dp (default); 48dp touch target either way. `unstyled` (e-store's
  `Dropdown.Trigger unstyled`, ported 2026-11-23): none of these classes, the host draws it
  (`SplitButton.Trigger`, `FABMenu.Trigger`); the ARIA, popover and keys stay.
- `Menu.Content`: `align` `start` (default) / `end`; `side` `bottom` (default) / `top` / `end`
  (a submenu's default) / `start` (NEW 2026-11-25, not in e-store: a submenu beside its row's
  start edge, flipping to the end without room; the account menu's nested Status and Busy
  submenus at the app bar's end cascade towards the start with it, instead of the second level
  opening back over the first);
  `floating` (no anchored position). Anchored with CSS anchor positioning, 4px from the
  trigger, flipping when it would leave the window; the last fallback scrolls
  (`tokens/components/menu.css`).
- `Menu.Item`: `size` `default` (min 48dp) / `dense` (min 32dp), `disabled`, `closeOnSelect`
  (default `true`), `href`, `target`, `onClick$`, `onKeyDown$` (run after the menu's keys).
- `Menu.RadioGroup`: `value?: Signal<string>`, `onValueChange$`.
- `Menu.RadioItem`: `value` (required), `disabled`, `closeOnSelect` (default `true`), `name`,
  `checkedHighlight` (default `true`: `surface-container-highest` fill when checked).

## Keyboard and focus (APG)

| Key                   | Where   | Does                                                   |
| --------------------- | ------- | ------------------------------------------------------ |
| Enter / Space / click | trigger | opens, focus on the first item                         |
| ArrowDown / ArrowUp   | trigger | opens, focus on the first / last item                  |
| ArrowDown / ArrowUp   | menu    | next / previous item, wrapping; disabled items skipped |
| Home / End            | menu    | first / last item                                      |
| a letter              | menu    | type-ahead                                             |
| Enter / Space         | item    | chooses it (and closes, by default)                    |
| Escape                | menu    | closes, focus back on the trigger (the browser's)      |
| Tab                   | menu    | closes, focus moves on                                 |

The item keys are `utils/menu-keys.ts` (`navigateMenuItems`, `chooseMenuItem`), shared with
`Dropdown`; the trigger's ArrowDown / ArrowUp is `openWithArrow` in `menu.tsx`.

A click outside closes it (light dismiss) and leaves focus where the click put it.

## Where it differs from e-store

Left out: CheckboxItem, ItemIndicator, Group, GroupLabel, Shortcut, the submenu parts,
`Item`'s submit mode, trigger looks other than outlined / plain / bare and sizes other than
xs / sm, and the anchor-positioning polyfill (a dynamic `import()`, which our rules forbid).
Changed (each is e-store finding 26-29, 34 in its `.claude/reference/findings-from-seanperez-ui-port.md`):

- Close returns focus to the trigger only when focus was in the menu or lost; e-store did it on
  every close, so a click on another control lost its focus.
- Tab closes the menu (APG); e-store left it open.
- ArrowUp / ArrowDown on the trigger open the menu in one `sync$` that marks which end to focus
  (`data-qds-menu-focus`); e-store raced two animation frames and ArrowUp could land on the
  first item.
- Signals are read in JSX, not component bodies.
- `touch-target` on the trigger; no `role="separator"` on the `<hr>`.
- Replaced our earlier popover-only menu (`Menu.Root id` + `Menu.Item` / `Menu.Link`, rows not
  focusable, `role="group"`): e-store's has the APG roles and keyboard model ours lacked.

Proof (2026-11-23): keyboard model against the APG (read by a second agent); focus behaviour
against the HTML spec's popover section; run in Chrome on `/menu/` and `/account-menu/`. M3
sizes (48dp items, 112-280dp wide, 4dp corner, level 2) are e-store's, not re-read on
m3.material.io; M3 Expressive menus look different and are NOT done.

## Usage

```tsx
const sort = useSignal("name");
<Menu.Root>
  <Menu.Trigger look="outlined">Sort</Menu.Trigger>
  <Menu.Content>
    <Menu.Item href="/help/">Help</Menu.Item>
    <Menu.Separator />
    <Menu.RadioGroup value={sort} aria-label="Sort by">
      <Menu.RadioItem value="name">Name</Menu.RadioItem>
      <Menu.RadioItem value="date">Date</Menu.RadioItem>
    </Menu.RadioGroup>
  </Menu.Content>
</Menu.Root>;
```

## Submenus (ported 2026-11-24 from e-store's `Menu.Sub`, 2026-11-11)

Structure and names as e-store's: a `SubContent` is a nested `popover="auto"` in its parent's DOM
(opening it keeps the parent open; hiding the root hides it); choosing a row closes the ROOT
(`rootContentRef`); hovering another row of the same menu closes a sibling's open submenu.
Playground: `/menu/` ("Share"). The site uses it since 2026-11-24 for the account menu's Busy
durations (`account-menu.md` "Busy durations"); `SubTrigger checked` (NEW) gives a row whose
submenu holds the current choice the checked fill.

Fixed from e-store (review agent 2026-11-24, then run in Chrome):

- Hover opens without moving focus (`data-qds-menu-focus="none"`); e-store's open handler focused
  the submenu's first row on hover.
- Tab closes the whole menu tree (APG), from a row of any level (`menu-keys.ts`); e-store had no
  Tab handling, and ours closed only the submenu.
- Open-on-first / open-on-last focus counts only the menu's OWN rows (a submenu's rows are in its
  DOM).
- A last placement fallback, `--qds-menu-scroll-below-end` (below the trigger row, end edges
  lined up): at 360-390px the account menu leaves too little room beside it. Run at 390px: the
  submenu flipped to the start side (151px).
- A keyboard-made click (`detail` 0) does not open it twice; the keys open it with the first row
  focused; ArrowLeft closes it and focuses its trigger.

Keyboard run in Chrome 2026-11-24 (account menu, before the owner switched it to a segmented
row): Enter opens the menu on "Theme", Right opens the submenu on "Light", Down, Left back to
"Theme", Enter / Space open it on the first row, Enter chooses and closes all with focus on the
trigger, Escape closes one level, Tab closes all. Not run: RTL (Left / Right are not mirrored),
touch, Safari / Firefox (`position-try`).

M3, read 2026-11-24 at m3.material.io/components/menus/guidelines: "Submenus should open next
to the parent menu item without overlapping it"; "best used on large screens"; on compact
windows "consider adapting menus into bottom sheets". The narrow fallback overlaps the parent: a
known departure.

## Control rows (`data-qds-menu-row`, `menuRowKeys`, NEW 2026-11-24)

A group of controls inside a menu that is not a menu row (the account menu's segmented theme
button): mark it `data-qds-menu-row` and give it `onKeyDown$={menuRowKeys}`. It is then one stop
in the menu's Up / Down / Home / End (at its pressed control, else its first button), its own
Left / Right stay its own, and Tab closes the menu tree as from a row. Not in e-store.

## Width (PROOFED 2026-11-24)

m3.material.io/components/menus/specs, read in Chrome 2026-11-24: "Container width 112dp min,
280dp max". `Menu.Content` is `min-w-28 max-w-70` (112 / 280px). Rows are not clipped or
shortened: no row has an overflow or ellipsis rule. (The "…" the owner saw was the account menu's
own label text, now "Theme colors".)

## Right-to-left placement (L10, 2026-11-25)

`side="bottom"` / `"top"` set `inset-inline-start` / `inset-inline-end` (were `left` / `right`).
`anchor(start)` resolves against the containing block's direction, so in right-to-left
`left: anchor(start)` was the trigger's RIGHT edge. Measured in Chrome with `position-try: none`
(the base position, before fallbacks): before, RTL trigger 759-871, menu 871-1007 (beside it);
after, trigger 753-865, menu 729-865 (end edges level, as LTR's start edges). With the fallbacks on,
LTR 510-654 under a 510-621 trigger, RTL 734-878 under 767-878; `align="end"` (account menu) LTR
1164-1380 under 1340-1380, RTL 8-224 under 8-48. The `@position-try` rules' `left / right: auto`
still reset the logical insets (they are one property group; `@position-try` declarations win).
PROOFED 2026-11-25 (Chrome; second agent agreed, and suggested `position-area` for the base as a
simpler later form). NOT PROOFED: Safari / Firefox. Still open: submenu Left / Right keys are not
mirrored in right-to-left (above).
