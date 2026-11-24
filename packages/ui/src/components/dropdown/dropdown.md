# Dropdown

A menu button: a trigger that opens a menu of commands. From e-store's `components/dropdown/`
(2026-11-23).

- APG: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ and /menu/
- M3: https://m3.material.io/components/menus/specs

## Dropdown or Select?

|           | Dropdown                                                     | Select                                          |
| --------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Is        | a menu of COMMANDS (Edit, Duplicate)                         | a FORM CONTROL with a value                     |
| Roles     | button + `role="menu"` / `menuitem*`                         | `combobox` (select-only) + `listbox` / `option` |
| Value     | none of its own (checkbox / radio rows hold their own state) | one chosen value, posted under `name`           |
| Closes on | choosing a command                                           | choosing an option                              |

## Parts

Shared with `Menu` (`components/menu/`, read `menu.md` for their props): `Dropdown.Root`,
`.Trigger`, `.Content` (and its e-store alias `.Popover`), `.Item`, `.RadioGroup`, `.RadioItem`,
`.Separator`. Added here:

| Part                     | Element                         | What                                                                                                                      |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Dropdown.CheckboxItem`  | `<div role="menuitemcheckbox">` | `checked` / `bind:checked`, `onCheckedChange$`, `disabled`, `closeOnSelect` (default `false`), `size`, `checkedHighlight` |
| `Dropdown.ItemIndicator` | `<span>`                        | A row's trailing slot (a check), pushed to the end                                                                        |
| `Dropdown.Group`         | `<div role="group">`            | Named by its GroupLabel (`aria-labelledby`)                                                                               |
| `Dropdown.GroupLabel`    | `<div role="presentation">`     | 48dp `label-large` heading                                                                                                |

## Keys

As Menu (APG menu): ArrowDown / ArrowUp on the trigger open on the first / last row; in the menu
the arrows wrap, Home / End, type-ahead, Enter / Space choose, Escape closes and returns focus,
Tab closes and moves on. `CheckboxItem` uses the same keys (`utils/menu-keys.ts`).

## Usage

```tsx
<Dropdown.Root>
  <Dropdown.Trigger>View</Dropdown.Trigger>
  <Dropdown.Content>
    <Dropdown.Group>
      <Dropdown.GroupLabel>Actions</Dropdown.GroupLabel>
      <Dropdown.Item onClick$={edit}>Edit</Dropdown.Item>
    </Dropdown.Group>
    <Dropdown.Separator />
    <Dropdown.CheckboxItem bind:checked={hidden}>
      Show hidden files
      <Dropdown.ItemIndicator>
        {hidden.value && <Icon name="check" size="sm" />}
      </Dropdown.ItemIndicator>
    </Dropdown.CheckboxItem>
  </Dropdown.Content>
</Dropdown.Root>
```

## Where it differs from e-store

- e-store's Dropdown is an older, smaller copy of its own Menu (same context shape, item variants
  and keys, written twice). Ours does not duplicate it: the shared parts ARE `Menu`'s, so the
  Menu port's fixes (focus returns to the trigger only when it was in the menu; Tab closes;
  signals in JSX; 48dp trigger target) apply here too.
- `CheckboxItem` takes `checked` (boolean) + `bind:checked`; e-store's `checked` was a Signal prop.
- `Group` is named by its `GroupLabel`; e-store's was unnamed. `Group` has no `px-3` (e-store's
  indented its rows 12dp more than ungrouped rows).
- `ItemIndicator` uses logical `ms-auto ps-2` (e-store `ml-auto pl-2`).
- Left out: the `filled` / `tonal` trigger looks (`unstyled` is now on `Menu.Trigger`, 2026-11-23), and
  Popover's `flip` / `gutter`.
- `Menu` and `Dropdown` share one copy of the menu keys, `utils/menu-keys.ts` (merged
  2026-11-23; menu.tsx had kept a private duplicate).

PROOFED 2026-11-23: APG menu button / menu. Checked in Chrome: arrows from the trigger, End,
checkbox row toggles with Space and click without closing, group named, no console errors.
