# Separator (M3 divider)

A thin line that groups content. Specs: https://m3.material.io/components/divider/specs (read in
Chrome 2026-11-23): `outline-variant`, 1dp; full width, inset (16dp at the start), middle inset
(16dp both ends); horizontal or vertical. Decorative: M3 sets no contrast minimum.

From e-store's `Separator` (`components/separator/separator.tsx`: a `<div>` with
`role="separator"` / `"none"`, `orientation`, `decorative`), with M3's `variant` added.

## API

| Prop | Type | Default | |
|---|---|---|---|
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | `aria-orientation` is set only when vertical (horizontal is the role's default) |
| `variant` | `"fullWidth" \| "inset" \| "middleInset"` | `"fullWidth"` | logical margins (`ms-4`, `mx-4`; vertical: `mt-4`, `my-4`) |
| `decorative` | `boolean` | `false` | `role="none"`: purely visual, hidden from assistive tech (e-store's default kept) |

Vertical dividers stretch to their flex row (`self-stretch`).

## ARIA

`role="separator"` is a non-focusable structural separator (WAI-ARIA 1.2); `aria-orientation`
defaults to horizontal. Use `decorative` where the line repeats a grouping already given by
headings or lists.

## Proof

PROOFED 2026-11-23: M3 divider specs and accessibility pages (Chrome), WAI-ARIA 1.2 `separator`.
Measured in Chrome: 1px high, `outline-variant`, 16px inset, vertical middle inset 16px top and
bottom.
