# Slider

Material Design 3 Expressive slider: pick a value (or a range) along a track.
Specs: https://m3.material.io/components/sliders/specs (guidelines and accessibility pages read
2026-11-23). Tokens: material-web 34.0.21 `_md-comp-slider.scss`; structure after material-web's
`md-slider` (`slider.ts`, `_slider.scss`).

New, NOT from e-store: e-store's `Slider` is the pre-Expressive design (see "Differs from
e-store" below).

## How it is built

- One real `<input type="range">` per handle (two for `range`), covering the whole slider and
  22px past each end, `opacity: 0`, with a 48px native thumb (a finger-sized target: iOS Safari
  only drags a range from its thumb). The input gives the keyboard, the screen reader role and
  name, RTL, vertical writing mode, form submission and pointer dragging.
- The visible parts (track segments, handle bars, stops, inset icon, value indicator) are spans
  with `pointer-events: none`, placed from `--start` / `--end` (fractions 0..1) that the root sets
  in `style`. The server HTML is already correct before JavaScript runs.
- The handle slot for a fraction f starts at `f * (100% - 4px)` of the track. The 48px thumb's
  centre travels from 24px to `100% - 24px` of the 44px-wider input, which is `2px + f * (100% -
4px)` of the track: the drawn handle's centre. So the browser's pointer-to-value mapping and the
  drawing agree (measured in Chrome). A press within 24px of the handle grabs it without jumping.
- The handle narrows (4 to 2px) by width and a margin, so only its width animates; its position
  never transitions (it would trail the track while dragging).
- Track segments stop 6px before and start 6px after the 4px handle slot: the gap is empty space,
  so it works on any background.
- Everything is placed with logical properties along the inline axis, so RTL mirrors it. The
  vertical slider is the same drawing inside `writing-mode: vertical-lr; direction: rtl` (the
  start is at the bottom), which also turns the native input vertical.
- Range: each input is clipped (`clip-path`) to its side of the midpoint between the handles, so
  a press goes to the nearer handle (material-web's method). A handle cannot pass the other one
  (clamped in the `input` handler).
- Focus and press styles are CSS only: `peer-focus-visible` / `peer-active` on the handle and the
  value indicator. The only script is the `input` handler that writes the value.

## API

| Prop                                                | Type                                   | Default                  | Notes                                                                          |
| --------------------------------------------------- | -------------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `variant`                                           | `"standard" \| "centered" \| "range"`  | `"standard"`             |                                                                                |
| `orientation`                                       | `"horizontal" \| "vertical"`           | `"horizontal"`           | `range` is always horizontal                                                   |
| `size`                                              | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | `"xs"`                   | track 16/24/40/56/96, handle 44/44/52/68/108                                   |
| `min`, `max`, `step`                                | `number`                               | `0`, `100`, `1`          | native snapping                                                                |
| `stops`                                             | `boolean`                              | `false`                  | a stop at each step (not drawn above 100 steps)                                |
| `bind:value` / `value`                              | `Signal<number>` / `number`            | min (centered: middle)   | standard, centered                                                             |
| `bind:start` / `start`                              | `Signal<number>` / `number`            | `min`                    | range                                                                          |
| `bind:end` / `end`                                  | `Signal<number>` / `number`            | `max`                    | range                                                                          |
| `onValueChange$`                                    | `QRL<(value, handle) => void>`         |                          | `handle`: `"value" \| "start" \| "end"`; every move                            |
| `icon`                                              | `IconName`                             |                          | standard, md / lg / xl only                                                    |
| `iconAtMin`                                         | `IconName`                             |                          | replaces `icon` at the minimum                                                 |
| `valueIndicator`                                    | `boolean`                              | `false`                  | bubble above the handle while pressed or keyboard-focused                      |
| `disabled`                                          | `boolean`                              | `false`                  |                                                                                |
| `name` / `startName`, `endName`                     | `string`                               |                          | form field names                                                               |
| `label`                                             | `string`                               |                          | visible label above, linked to the input(s)                                    |
| `startLabel`, `endLabel`                            | `string`                               | `"Minimum"`, `"Maximum"` | range: each handle's own name                                                  |
| `valueText` / `startValueText`, `endValueText`      | `string`                               |                          | `aria-valuetext` and the indicator's text                                      |
| `aria-label`, `aria-labelledby`, `aria-describedby` | `string`                               |                          | go to the input (range: the group)                                             |
| `class`, `style`, other `div` props                 |                                        |                          | on the root; `--slider-length` sets a vertical slider's height (default 15rem) |

Why `bind:start` + `bind:end` and not a tuple: each is a plain number signal, so a form or a
price filter binds them separately, nothing allocates an array per move, and the names match
material-web (`valueStart` / `valueEnd`, `nameStart` / `nameEnd`).

Why `valueText` is a string and not a format QRL: `aria-valuetext` has to change in the same
frame as the value; a QRL would be async and lazy-loaded. The parent computes it in JSX
(`valueText={`${volume.value}%`}`).

## ARIA

- Each handle is a native `<input type="range">` (implicit `slider` role, APG slider pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/slider/). Arrow keys, Page Up / Down, Home, End are
  native. RTL arrows follow the native control.
- Standard / centered: named by `<label for>` when `label` is given, else `aria-labelledby` /
  `aria-label`; an `id` prop goes to the input, so an outside `<label for>` reaches it. Vertical
  sets `aria-orientation="vertical"`. No name given = an unnamed slider (no warning).
- Range: the root is `role="group"` named by the label; each input has its own `aria-label`
  (`startLabel` / `endLabel`). Both inputs report the overall min / max. md-slider also sets
  `aria-valuemax` (start) / `aria-valuemin` (end) to the other handle; left out here because ARIA
  in HTML says authors SHOULD NOT set them on an element with native `min` / `max`.
- Inputs have `autocomplete="off"`: Firefox would restore a reloaded value without an `input`
  event and leave the drawing behind. A `form.reset()` has the same problem and is NOT handled.
- The drawn parts and the value indicator are `aria-hidden` / not focusable.

## Usage

```tsx
<Slider label="Volume" size="md" icon="volume_up" iconAtMin="volume_off" bind:value={volume} />
<Slider variant="centered" label="Balance" min={-50} max={50} valueIndicator bind:value={balance} />
<Slider variant="range" label="Price" startLabel="Minimum price" endLabel="Maximum price"
  min={0} max={500} step={10} stops bind:start={low} bind:end={high} />
<Slider orientation="vertical" aria-label="Brightness" bind:value={brightness} />
```

## Spec items and their proof status

| Item                                                                                                                                                            | Status                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variants standard / centered / range; range has no inset icon and is not vertical                                                                               | done (spec as given)                                                                                                                                                |
| Sizes: track, outer corner, handle, inset icon and padding                                                                                                      | done; measured in Chrome. PROOFED 2026-11-23 against the m3.material.io slider token tables (each size set opened, "expand all"): XS 16 / 8 / 44, S 24 / 8 / 44, M 40 / 12 / 52 (icon 24, padding 6), L 56 / 16 / 68 (24, 6), XL 96 / 28 / 108 (32, 8). The M handle IS 52; material-web `latest` (44) is behind the spec |
| Handle 4dp, 2dp when focused or pressed, primary, full corner                                                                                                   | done; 2px measured on keyboard focus                                                                                                                                |
| 6dp gap on both sides of the handle, as space                                                                                                                   | done; measured                                                                                                                                                      |
| Inner corner 2dp next to the handle                                                                                                                             | done; NOT PROOFED (material-web token only)                                                                                                                         |
| Centered: active from the middle; inactive and active meet flush (square) at the middle                                                                         | done; the square join is NOT PROOFED (no spec drawing read for it)                                                                                                  |
| Active `primary`, inactive `secondary-container`                                                                                                                | done                                                                                                                                                                |
| Stops 4dp: `on-primary` on active, `on-secondary-container` on inactive; end stops 4dp in                                                                       | done. The stop under a handle is hidden; stops closer than ~10px to a handle are not (keep steps few)                                                               |
| Inset icon: `on-primary` in the active track, moves past the handle in `on-secondary-container` when the active track is shorter than icon + 2 x padding        | done (container query on the active segment)                                                                                                                        |
| Value indicator: `inverse-surface` / `inverse-on-surface`, `text-label-large` (14/20), 44 high, min 48 wide, 12dp above the handle, on press and keyboard focus | done; horizontal padding 12px NOT PROOFED. Vertical: shown on the block-start (left) side                                                                           |
| Focus ring on the handle: secondary, 3dp, 2dp offset                                                                                                            | done with our focus-ring tokens; NOT PROOFED (no M3 token). Static: the focus-ring utility's grow animation is not applied to the handle                            |
| No state layers                                                                                                                                                 | done                                                                                                                                                                |
| Disabled: handle and active 0.38 on-surface, inactive 0.12, stops 0.38                                                                                          | done (active-track stops `inverse-on-surface`, material-web's disabled-selected stop colour)                                                                        |
| Motion: handle width and indicator, `short-3` + `standard` easing, none under reduced motion                                                                    | done; NOT PROOFED (no M3 numbers)                                                                                                                                   |
| Touch target at least 48dp across the track                                                                                                                     | done (track box `max(48px, handle)`; input 44px longer than the track; `touch-action: pan-y` / `pan-x` so a drag along the track moves it)                          |
| RTL mirrors                                                                                                                                                     | done; checked in Chrome with `dir="rtl"`                                                                                                                            |

## Browser support

- Vertical range input (`writing-mode` on form controls): Chrome 124, Firefox 120, Safari 16.5
  (MDN BCD `html.elements.input.type_range.vertical_orientation`). Older browsers draw the
  vertical slider correctly but the native input stays horizontal inside the box, so dragging
  maps along the wrong axis; the keyboard still works.
- Container queries (inset icon move): Chrome 105, Firefox 110, Safari 16.
- `:dir()` (via Tailwind `rtl:`, range clipping in RTL): Chrome 120, Firefox 49, Safari 16.4.
- Forced colours (Windows High Contrast): `forced-color-adjust: none` on the track, with system
  colours (`Highlight` active, `Canvas` + `CanvasText` outline inactive, `CanvasText` handle,
  `GrayText` disabled). NOT checked in forced colours.
- Checked in Chrome only (macOS). Firefox (`::-moz-range-thumb` 48px) and iOS Safari not run.

## Not done / limits

- Range handles that sit on the same value do not "flip" on drag as md-slider's do: a press on
  the left half moves the start, on the right half the end, and each is clamped at the other.
- No hover state (Expressive removed state layers; md-slider's hover colour is the same primary).
- Value indicator for `valueText` longer than a few characters grows wide; it stays centred.
- No commit event (`change` on release); `onValueChange$` fires on every move.
- Values from props / signals outside min..max are clamped for the drawing and the indicator,
  not written back; a range start above its end is drawn sorted.
- The moved inset icon sits up to 6px further along while the handle is within 6px of the
  start (it is placed from the active segment's end, which cannot go below 0).
- Centered: within about 8px past the middle, the inactive segment's end next to the handle gap
  is square instead of the 2dp inner corner.
- Vertical: the value indicator opens on the left and needs room there.

## Differs from e-store

e-store's `Slider` (`packages/ui/src/components/slider/`) is the pre-2023 M3 design: a 20px
round handle on a 4px track, state layers, a `bg-primary` value label, 2px ticks, a custom
`role="slider"` element driven by pointer maths. This one follows M3 Expressive and drives
native inputs. See e-store findings items 21 and 22.

## Availability (m3.material.io, read 2026-11-23)

M3 Expressive: standard, centered, range, and discrete as the "stops" configuration; vertical and
the inset icon are Expressive only. Sizes S, M, L, XL are "Available on Android Views (MDC-Android).
Available as tokens on other platforms": there is no official web component for them, so ours is
built from those tokens. (In baseline M3, centered was "web only".)
