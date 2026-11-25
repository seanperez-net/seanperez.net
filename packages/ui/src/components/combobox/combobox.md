# Combobox

A searchable select: a text input with `role="combobox"` filters a `role="listbox"` popover. From
e-store's `components/combobox/` (2026-11-23).

- APG: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ (list autocomplete, manual selection)
- M3: exposed dropdown menu https://m3.material.io/components/menus/overview, outlined text field
  https://m3.material.io/components/text-fields/specs
- MDN: Popover API, CSS anchor positioning (`anchor()`, `anchor-size()`, `position-try-fallbacks`)

## Parts

| Part                  | Element                                                  | What                                                |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| `Combobox.Root`       | `<div>`                                                  | State, hidden form input, error text                |
| `Combobox.Input`      | `<div>` + `<input role="combobox">` + `<label>` + button | The field, its floating label, clear / open button  |
| `Combobox.Content`    | `<div popover role="listbox">`                           | The list, anchored under (or over) the field        |
| `Combobox.Item`       | `<div role="option">`                                    | One option, hidden when it does not match           |
| `Combobox.Group`      | `<div role="group">`                                     | Named by its GroupLabel                             |
| `Combobox.GroupLabel` | `<div role="presentation">`                              |                                                     |
| `Combobox.Empty`      | `<div role="none">`                                      | Shown only when no option is visible (CSS `:has()`) |

## API

`Root`: `variant` (`outlined` default, `tonal`), `value`, `bind:value`, `onValueChange$` (choice or clear), `disabled`, `name`, `error`
(text; also `aria-invalid` on the input), `displayValue` (the chosen label at first render),
`id` (goes to the INPUT), `...PropsOf<"div">`.

`Input`: `label`, `placeholder` (shown once the label floated), `clearIcon` (`close`),
`expandIcon` (`expand_more`), `clearLabel` (`"Clear"`), `openLabel` (`"Show options"`),
`actionIcon` + `actionLabel` + `onAction$` (see below), `onInput$`, `onKeyDown$`, `onClick$`,
`...PropsOf<"input">`.

### Free text, remote options, a trailing action (NEW 2026-11-24, not in e-store)

For the app's place field (`apps/web/src/components/place-field.tsx`: Location inputs whose
suggestions come from the Maps app's Photon search). e-store's Combobox has none of these.

- `Root freeText`: the typed text IS the value. The input itself posts it under `name` (no
  hidden input); `value` / `bind:value` is the text, follows every edit (and `onValueChange$`
  runs for each), and a value set from outside is shown in the field; choosing an option puts its
  `label` in the field; closing the list keeps what was typed. APG combobox, list autocomplete
  with a free value.
- `Root filter={false}`: options are not hidden by the typed text, for options the caller already
  chose for it (Photon matches "Muenchen" to "München", which the substring filter would hide).
- `Root supportingText`: M3 text field supporting text under the field (`aria-describedby`); an
  `error` replaces it.
- `Input actionIcon` / `actionLabel` / `onAction$`: one trailing icon button before the clear /
  open button (M3 text fields allow a trailing icon button), named by `actionLabel` (also its
  plain tooltip). It IS a Tab stop: a separate command, unlike the clear / open button.

Proof: APG combobox (free value allowed in list autocomplete); M3 text fields (supporting text,
trailing icon button). A second agent (2026-11-24) recommended exactly these additions over a
listbox built in the app. Checked in Chrome 2026-11-24 (/profile/ dialog, /admin/profile): "Hav"
gives Havana, Cuba first; ArrowDown + Enter chooses without submitting; the form posts the text;
the action button runs; light and dark.

`Content`: `onToggle$` (runs beside its own), `...PropsOf<"div">`.

`Item`: `value` and `label` (required: shown, matched, put in the field), `keywords`,
`disabled`, `selectedIcon` (`check`), `onClick$`. Children follow the label.

## Keys (focus never leaves the input)

| Key            | Action                                                                |
| -------------- | --------------------------------------------------------------------- |
| ArrowDown / Up | Opens the list; moves the highlight (wraps), skipping disabled        |
| Enter          | Chooses the highlighted option (and does not submit the form)         |
| Escape         | Closes the list; the field shows the chosen label again               |
| Tab            | Closes the list (focus out) and moves on                              |
| Typing         | Filters by `label` + `keywords`, opens the list, clears the highlight |

The highlight is `aria-activedescendant` on the input and `data-highlighted` on the option (a
12% layer and an inward 3dp ring). The clear / open button is not a Tab stop (APG) and keeps
focus in the input; in "open" mode it is the popover's `popovertarget`, so the browser toggles
the list.

The list is `popover="manual"`, not `auto`: an auto popover is light-dismissed by a pointerdown
in the input (it is neither inside the popover nor its invoker), which put the chosen label back
over the typed text. The input closes it on Escape and on focus out (APG: the list closes when
the field loses focus). The list is named by the field's `<label>` (`aria-labelledby`), not by
the input, whose value would become the name (accname 1.2, step 2E).

A mouse press on the list, an option or the button never takes focus from the input: each has a
`sync$` `onMouseDown$` that prevents the default (a consumer's own `onMouseDown$` on
`Combobox.Content` / `Combobox.Item` runs after it). FIXED 2026-11-24: these were bare
`preventdefault:mousedown` attributes, which qwikloader (installed `@qwik.dev/core` 2.0.0-rc.5,
`dispatch` / `addEventOrRoot`) reads only for event types some element has a handler for
(defaults `click`, `input`). On a page with no mousedown handler a press focused the listbox
(`tabIndex={-1}`), the input's focus-out closed the list, and a slow press chose nothing (a quick
click still won the race). The playground hid it: the app bar's Search registers `mousedown`.

## Where it differs from e-store

- Highlight is state (`highlightedId`) rendered into the DOM; e-store's `sync$` wrote
  `data-qds-highlighted` and `aria-activedescendant` straight into the DOM and never set the
  signal, so after typing the active descendant could point at a hidden option.
- No `useVisibleTask$`: `onToggle$` on the popover keeps `open` in step; the list width is
  `min-width: anchor-size(width)` instead of a measured `--trigger-width`.
- `Empty` shows only with no visible option; e-store documented that but always rendered it.
- `Item.label` is required; e-store's optional `label` fell back to `''` (never matched, and chose
  an empty label).
- `aria-invalid` / `aria-describedby` (error) on the input; e-store put `aria-invalid` on the
  wrapper `div` (not allowed on a generic) and linked no error.
- `Group` is named by its `GroupLabel`; e-store's group had no name.
- The button's names are props; it uses `popovertarget` in open mode; clearing calls
  `onValueChange$("")`.
- Invalid + focused keeps the error color on the outline and label (M3 error state).
- Signals read in JSX / `useComputed$`; logical properties.
- NOT DONE (second agent, 2026-11-23): a `value` / `bind:value` set from outside does not update
  the text in the field; pass `displayValue` with it. Doing it needs each Item to register its
  label in the context.
- `variant="tonal"` on Root (added 2026-11-23, e-store's): 40dp `surface-container` field, 14px,
  no floating label (it names the input through `aria-labelledby`), placeholder always shown,
  2dp inset primary ring on focus, `error-container` when invalid. Not in M3, NOT PROOFED. Checked
  in Chrome: height, colors, name.
- Left out: the anchor polyfill (dynamic import).

## Browser support

Popover API and CSS anchor positioning: current Chrome, Edge, Safari 26 and Firefox. Without
anchor positioning the list opens at the popover's default (top-layer) position.

PROOFED 2026-11-23: APG combobox (keys, roles, `aria-activedescendant`), MDN Popover and anchor
positioning, Qwik rc.5. Checked in Chrome: arrows, Enter, Escape restore, typing filter,
keywords, Empty, groups named, clear button, error state, flip above when there is no room.
