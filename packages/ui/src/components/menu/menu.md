# Menu

Material 3 menu on the Popover API, from e-store's `components/menu/` (2026-11-23): a menu
button (`Menu.Trigger`) opening a `role="menu"` popover in the top layer.

- **M3**: https://m3.material.io/components/menus/specs
- **WAI-ARIA APG**: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ and
  https://www.w3.org/WAI/ARIA/apg/patterns/menu/
- **Popover API**: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API

## Parts

| Part              | Element                          | Role / attributes                                                         |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------- |
| `Menu.Root`       | `<div>`                          | Context: ids, refs, `open`                                                |
| `Menu.Trigger`    | `<button>`                       | `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, `popovertarget` |
| `Menu.Content`    | `<div>`                          | `role="menu"`, `popover="auto"`, `aria-labelledby` the trigger            |
| `Menu.Item`       | `<div>` / `<a>`                  | `role="menuitem"`, `tabindex="-1"`; `href` makes a real link              |
| `Menu.RadioGroup` | `<div>`                          | `role="group"` (name it with `aria-label`), shared value                  |
| `Menu.RadioItem`  | `<div>` / `<button type=submit>` | `role="menuitemradio"`, `aria-checked`; `name` makes a no-JS submit       |
| `Menu.Separator`  | `<hr>`                           | implicit `separator`                                                      |

## API

- `Menu.Root`: `open?: Signal<boolean>`, `onOpenChange$`.
- `Menu.Trigger`: `look` `outlined` (default) / `plain` / `bare` (no padding: an avatar);
  `size` `xs` 32dp / `sm` 40dp (default); 48dp touch target either way. `unstyled` (e-store's
  `Dropdown.Trigger unstyled`, ported 2026-11-23): none of these classes, the host draws it
  (`SplitButton.Trigger`, `FABMenu.Trigger`); the ARIA, popover and keys stay.
- `Menu.Content`: `align` `start` (default) / `end`; `side` `bottom` (default) / `top`;
  `floating` (no anchored position). Anchored with CSS anchor positioning, 4px from the
  trigger, flipping when it would leave the window; the last fallback scrolls
  (`tokens/components/menu.css`).
- `Menu.Item`: `size` `default` (min 48dp) / `dense` (min 32dp), `disabled`, `closeOnSelect`
  (default `true`), `href`, `target`, `onClick$`.
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
