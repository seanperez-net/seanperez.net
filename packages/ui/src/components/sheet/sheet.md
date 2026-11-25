# Sheet (M3 standard bottom sheet)

A non-modal bottom sheet with preset heights (detents) beside the page. Specs:
https://m3.material.io/components/bottom-sheets (specs, guidelines, accessibility read
2026-11-23). The MODAL bottom sheet is `Modal position="bottom"` with `Modal.DragHandle`.

From e-store's `Sheet` and `sheet-detents.ts` (detents, drag with fling snap, the handle's keys,
the live-region announcement, raising the detent when keyboard focus lands below the edge).

## API

| Prop                    | Default                                               |                                               |
| ----------------------- | ----------------------------------------------------- | --------------------------------------------- |
| `detents`               | peek 14.25rem / half 50% / full `calc(100% - 4.5rem)` | heights, smallest first; `label` is announced |
| `detent`, `bind:detent` | the first                                             | current detent id                             |
| `onDetentChange$`       | —                                                     |                                               |
| `label`                 | "Sheet"                                               | the region's name                             |
| `handleLabel`           | "Resize sheet"                                        | the drag handle's name                        |
| `id`, `class`           |                                                       | on the sheet element (no other host props)    |
| `q:slot="header"`       |                                                       | above the body; drags the sheet too           |

Handle: a button (`aria-expanded`, in the tab order). Enter / Space cycle the detents,
ArrowUp / ArrowDown step, Home / End go to the ends. A drag snaps to the nearest detent
(velocity projected 150ms). The press is the single-pointer alternative to dragging
(WCAG 2.5.7).

## Left out from e-store

`anchor="container"` and its offset style, the bottom and floating yields (we have no bottom bar
or floating buttons), the data-attribute pass-through, e-store's unit tests.

The peek height (14.25rem) is e-store's own number; M3 gives none.

`atTop` and the height are `useComputed$` (e-store read the detent signal in the component body,
Q12). `useVisibleTask$` (document-ready) is kept from e-store: the drag needs synchronous pointer
capture and click swallowing that a lazy `$()` cannot give.

## Proof

- PROOFED 2026-11-23: M3 specs (surface-container-low, 28dp top corners, level 1, 640dp max,
  drag handle 32x4 in 48dp, on-surface-variant 40%, 72dp top margin) and accessibility (handle
  is a labelled button that cycles heights).
- Measured in Chrome: 640 wide, 28px corners, peek 228 / half 392 / full 711 of 783; press,
  End, Home and a pointer drag move it; "Collapsed" announced.
