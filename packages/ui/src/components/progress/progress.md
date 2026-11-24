# Progress indicators

M3 Expressive linear and circular progress indicators: determinate or indeterminate, flat or
wavy, default (4dp) or thick (8dp). Specs: https://m3.material.io/components/progress-indicators
(specs, guidelines, accessibility read in Chrome 2026-11-23). Motion and wave numbers from
androidx Compose material3 `ProgressIndicator.kt` / `WavyProgressIndicator.kt` (fetched
2026-11-23), because the M3 pages give no keyframes.

From e-store's `Progress` (`Progress.Linear` / `Progress.Circular`, `value` / `max`,
`valueText`, `aria-label` / `aria-labelledby`, `role="progressbar"`), brought up to Expressive.

## API (both)

| Prop | Default | |
|---|---|---|
| `value` | — | 0..`max`; omit for indeterminate |
| `max` | 1 | |
| `wavy` | false | wavy active indicator |
| `thickness` | `"default"` | `"thick"`: 8dp stroke (M3's sample of the configurable thickness) |
| `valueText` | — | `aria-valuetext` |
| `aria-label` / `aria-labelledby` | — | M3: always name it, e.g. "Loading news article" |
| `Linear` `stopIndicator` | true | the 4dp dot at the track's end (keep it unless the track has 3:1 contrast) |

## Numbers

- Active indicator `primary`, track `secondary-container` (Expressive; e-store's
  `surface-container-highest` is the older baseline), 4dp gap between them.
- Linear: 4dp high (thick 8), stop 4dp (thick: 2dp in from the end). Wavy: amplitude 3dp,
  wavelength 40dp determinate / 20dp indeterminate, box 10dp (thick 14dp). The wave is a CSS
  mask tile (`progress-wave*` utilities) moving one wavelength per second.
- Circular: 40dp, stroke 4 (thick 44 / 8); wavy 48dp (thick 52), amplitude 1.6, wavelength about
  15dp (whole waves round the ring).
- Wavy determinate is flat below 10% and from 95% (Compose's default amplitude function).
- Indeterminate linear: two lines over 1750ms (Compose timings); circular: arc 10% to 87% over
  6s, a 1080deg turn plus 90deg steps every 1.5s.
- RTL: the determinate bar fills from the inline start by flex alone; the indeterminate bar
  (physical coordinates) is mirrored (`rtl:-scale-x-100`). Checked in Chrome with `dir=rtl`.
- `aria-valuenow` is the clamped value.

## Left out (e-store extras not in M3 Expressive)

Buffer, `fourColor`, sm / md / lg circular sizes, the `surface` track option, `getValueLabel$`.

## Proof

- PROOFED 2026-11-23: colours, sizes, gap, stop indicator, configurations, ARIA (M3 pages,
  WAI-ARIA 1.2 `progressbar`); timings against the Compose source.
- Measured in Chrome: linear 4 / 8 / 10 / 14px boxes, indicator at 40% of 448 = 179px, 4px gap,
  4x4 stop; circular boxes 40 / 44 / 48 / 52.
- NOT PROOFED: the wave shape and motion are an approximation (CSS mask and SVG path), compared
  by eye only, not against a Compose rendering.
- `prefers-reduced-motion`: the wave stops; the indeterminate motion still runs (it is the only
  signal of activity).
