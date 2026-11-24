# Avatar

A person's or brand's picture, with initials (or an icon) as the fallback, an optional presence
ring and glyph, and a group with a `+N` counter. From e-store's `components/avatar/` (ported in
full 2026-11-23): Material 3 sizes and colours with a Base UI-shaped compound API.

- **M3**: there is no avatar page. The sizes come from the components that hold one: top app bar
  trailing avatar 32dp, search bar 30dp, list item leading 40dp; full circle; initials in
  `on-*-container` on `*-container`.
- **Base UI**: https://base-ui.com/react/components/avatar (part names and the load-status model).
- **MDN**: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img

## Parts

| Part                  | Element                                    | What                                                                                          |
| --------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `Avatar`              | `<span>`                                   | Props-only form: `Root` + `Image` (with `src`) + `Fallback` (initials, else `fallbackIcon`)   |
| `Avatar.Root`         | `<span data-qds-avatar>`                   | The circle. Holds the image's load status in context; `data-size`, `data-tone`, `data-status` |
| `Avatar.Image`        | `<img data-qds-avatar-image>`              | Reports `loading` / `loaded` / `error`; `hidden` after an error. Nothing without `src`        |
| `Avatar.Fallback`     | `<span data-qds-avatar-fallback>`          | Shown while there is no image or it failed; optional `delay`                                  |
| `Avatar.Group`        | `<div role="group" data-qds-avatar-group>` | Overlapping avatars with a `+N` counter                                                       |
| `AvatarPresenceGlyph` | `<span aria-hidden>`                       | The presence glyph alone, for a status picker row                                             |

Helpers (Qwik-free, `avatar-utils.ts`): `initialsOf(name)` (two letters: first two words, or a
word's first two letters, an email's local part, a handle without `@`; never splits a surrogate
pair) and `avatarTone(seed)` (`primary` / `secondary` / `tertiary` from an FNV-1a hash; same seed,
same colour).

## API: `Avatar` (props only)

| Prop             | Type                                                  | Default       | What                                                                |
| ---------------- | ----------------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| `src`            | `string \| null`                                      |               | Unset, empty or failing: the fallback shows                         |
| `name`           | `string`                                              |               | The initials, the tone seed and the accessible name                 |
| `alt`            | `string`                                              | `name`        | The image's text and the fallback's label                           |
| `seed`           | `string`                                              | `name ?? alt` | What the tone comes from (an id survives a rename)                  |
| `size`           | see below                                             | `md`          |                                                                     |
| `tone`           | `"primary" \| "secondary" \| "tertiary" \| "neutral"` | from `seed`   |                                                                     |
| `edge`           | `"none" \| "hairline"`                                | `none`        | A 1px `outline-variant` box-shadow ring hugging the circle          |
| `fallbackIcon`   | `IconName`                                            | `person`      | With neither a picture nor initials                                 |
| `delay`          | `number` (ms)                                         | `0`           | `Avatar.Fallback delay`                                             |
| `decorative`     | `boolean`                                             | `false`       | Hidden from screen readers (the name is beside it, or on a control) |
| `presence`       | `"online" \| "away" \| "busy" \| "offline" \| null`   |               | Ring + glyph, and the word in the name ("Ada Lovelace, Busy")       |
| `presenceLabels` | `Partial<Record<AvatarPresence, string>>`             | English       | The words                                                           |
| `class`, ...rest | span attributes                                       |               | On the root; `class` on the presence wrapper when there is one      |

Parts: `Avatar.Root` (`size`, `tone`, `seed`, `edge`), `Avatar.Image` (`src`, `alt` required,
`onLoadingStatusChange$`; put it BEFORE the fallback: it marks the root `loading` in a `useTask$`
that runs on the server), `Avatar.Fallback` (`delay`, `label`), `Avatar.Group` (`items`, `max`,
`total`, `size`, `overflowLabel` "more", `label`).

Sizes: `xs` 24, `search` 30, `appbar` 32, `md` 40 (default), `post` 48, `lg` 56, `xl` 80,
`profile` 96, `2xl` 144. The type scale (about 40% of the diameter) and the fallback icon move
with it.

## Presence

`online` a filled dot (`positive`), `away` a crescent (`warning`), `busy` a bar (`error`),
`offline` a hollow ring (`outline`): a different SHAPE per state, not colour alone (WCAG 1.4.1).
The ring is an `outline` with an offset, so the root's `overflow-hidden` does not clip it and a
`hairline` edge (a box-shadow) shows with it. The glyph sits outside the clipping root, in a
`data-qds-avatar-presence` wrapper. Its cut-out is `--avatar-presence-cutout`, else `--field-bg`
(declared by every `bg-surface*` utility in `tokens/utilities.css`), else `surface`.
`positive` and `warning` are NOT M3 roles: `tokens/color/status.css`, e-store's values, flipped
for dark.

## ARIA

- The fallback is `role="img"` named `alt || name` (plus the presence word); the image's `alt`
  carries the same. `decorative`: `alt=""`, fallback `aria-hidden`. No live region.
- The initials are CSS generated content (`data-qds-avatar-initials`), not a text node: inside a
  named control a visible "AL" would not match its name (WCAG 2.5.3).
- A hidden part carries `hidden`, so it is out of the accessibility tree.
- Group: `role="group"` named by `label`; the counter is `role="img"` named "2 more".

## SSR and resumption

With a `src`, SSR renders the `<img>` (`data-loading`) and hides the fallback. `onLoad$` /
`onError$` set `loaded` / `error`. An image that failed before Qwik resumed fired its event into
nothing, so a `useVisibleTask$` reads `img.complete` and `naturalWidth` once.

## Where it differs from e-store

- Signals are read in JSX, never in a component body (Qwik rc.5 best practice; e-store reads
  `status` in `Image` and `Fallback` bodies).
- `fallbackIcon` is an `IconName` (our icons are a fixed set). No `DataAttrs` type, no CMS files.
- Replaced our earlier one-component avatar (no presence, group or parts). Kept from ours: none
  of it; e-store's helpers and classes were the same, and its compound parts and presence are a
  superset.

Proof (2026-11-23): NOT PROOFED against an M3 avatar spec (none exists); the sizes trace to the
M3 app bar, search and list specs via e-store's notes, not re-read. Checked in Chrome: broken URL
falls back to initials, presence ring and glyph, group counter, light and dark.

## Usage

```tsx
<Avatar name="Ada Lovelace" />
<Avatar src={user.image} name={user.name} size="appbar" presence="online" decorative />
<Avatar.Group items={people} max={3} size="appbar" label="Attendees" />
<Avatar.Root size="xl" seed={user.id}>
  <Avatar.Image src={user.image} alt={user.name} />
  <Avatar.Fallback label={user.name}>{initialsOf(user.name)}</Avatar.Fallback>
</Avatar.Root>
```
