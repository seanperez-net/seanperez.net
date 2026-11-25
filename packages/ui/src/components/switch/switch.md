# Switch

Material 3 switch. https://m3.material.io/components/switch/specs
Tokens: material-web v0_192 `_md-comp-switch.scss`. APG: https://www.w3.org/WAI/ARIA/apg/patterns/switch/

## API

| Prop           | Type                             | Default   | What                                                      |
| -------------- | -------------------------------- | --------- | --------------------------------------------------------- |
| `label`        | `string`                         |           | The text beside the switch                                |
| `checked`      | `boolean`                        | `false`   | Starting state when nothing is bound                      |
| `bind:checked` | `Signal<boolean>`                |           | Two-way state owned by the parent                         |
| `icons`        | `"none" \| "selected" \| "both"` | `"none"`  | Icons in the handle (M3 "with icon")                      |
| `checkIcon`    | `IconName`                       | `"check"` | Shown while on                                            |
| `uncheckIcon`  | `IconName`                       | `"close"` | Shown while off (`icons="both"`)                          |
| `size`         | `"md" \| "sm"`                   | `"md"`    | `sm`: e-store's 0.75 scale (not M3)                       |
| `description`  | `string`                         |           | A line under the label, in `aria-describedby`             |
| `error`        | `string`                         |           | Error under the label, `aria-describedby`, `aria-invalid` |
| ...rest        | `PropsOf<"input">`               |           | `disabled`, `name`, `value`, `required`, ... on the input |

## ARIA

A native checkbox with `role="switch"` inside its `<label>`: the label names it, Space toggles it
(the browser's), it posts under `name` with a form, `disabled` and `required` are native.
With a `description` or `error`, the label text gets its own id and names the input through
`aria-labelledby`: the `<label>` holds all three lines, and without it the description joined
the switch's name ("Notifications Sent to your phone"; fixed in the 2026-11-23 review).

## Sizes and colors (M3 tokens)

Track 52 x 32, 2dp outline. Handle: off 16dp `outline`, on 24dp `on-primary`, with icons 24dp
both ways, pressed 28dp. Hover / focus / pressed handle: `on-surface-variant` off,
`primary-container` on. State layer: a 40dp circle around the handle, `on-surface` off,
`primary` on. Icons 16dp: on `on-primary-container`, off `surface-container-highest`.
Disabled: track 12%, handle off `on-surface` 38%, on `surface`. Focus: the `focus-ring`
utility around the track. The row is 48dp to the pointer (`touch-target`). Positions are
logical (`inset-s-*`), so the handle runs the other way in RTL.

## Styles

`switchVariants` (tv) slots: `root`, `control`, `text`, `description`, `error`, `track` (the
input), `handle`, `onIcon`, `offIcon`; variants `icons`, `size`.

## Usage

```tsx
const on = useSignal(true);
<Switch label="Notifications" bind:checked={on} icons="selected" />;
```

## Ours or e-store's (compared 2026-11-23, owner's rule: keep the better one)

KEPT OURS, with e-store's options added. e-store's switch is a nine-part compound
(`Root`, `Trigger`, `HandleContainer`, `Thumb`, `Track`, `Label`, `Description`, `Error`,
`HiddenInput`) on a `<button role="switch">` plus a hidden checkbox for forms.

| On the merits                        | Ours (native checkbox)                                                          | e-store (button + hidden checkbox)             |
| ------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| APG switch                           | `role="switch"` on a checkbox is allowed (ARIA in HTML); Space toggles natively | also correct (Space and Enter from the button) |
| Form posting, `required`, `disabled` | native                                                                          | a second, hidden input kept in step by code    |
| Label                                | `<label>` wraps the input                                                       | `<label for>` pointing at the button           |
| Size                                 | one component, ~150 lines                                                       | nine parts, a headless layer and context       |
| M3 visuals                           | same sizes and colors; now also icons, focus colors, state layer                | icons via the Material Symbols font            |

Taken from e-store: `icons` / `showOnlySelectedIcon` (as `icons="both" | "selected"`), the
`focus-ring` utility, the focus handle colors. Added 2026-11-23: `size="sm"` (e-store's 0.75
scale: 39x24 track, handle 12 / 18 / pressed 21, 12dp icons; not an M3 size, NOT PROOFED) and
its `Description` / `Error` parts as `description` / `error` props (one component here): both in
the input's `aria-describedby`, `error` also `aria-invalid` (not while disabled). Checked in
Chrome: both sizes in every icon mode, handle positions, describedby, error color. Differs: the icons are props
(`checkIcon`, `uncheckIcon`) and inline SVG; the unselected icon color is M3's
`surface-container-highest` (e-store left it the inherited color).

PROOFED 2026-11-23: material-web switch tokens, APG switch, MDN `switch` role. Checked in Chrome:
52x32 track, 16 / 24dp handle centred at 16 / 36px, 48px target, Space toggles, focus ring 3px,
icons in both modes.
