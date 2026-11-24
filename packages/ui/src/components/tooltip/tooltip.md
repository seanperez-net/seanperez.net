# Tooltip

M3 plain and rich tooltips. Specs: https://m3.material.io/components/tooltips (specs, guidelines,
accessibility read in Chrome 2026-11-23). Two parts:

1. **`TooltipProvider` + `data-tooltip`: the PLAIN LABEL tooltip of every control.** Differs from
   e-store (global instead of per-trigger), owner-requested 2026-11-23, modelled on e-store's
   `RippleProvider` (document listeners, no per-control component). `Layout.Root` mounts it (the
   only edit to `layout.tsx`: one import, one element). `IconButton` sets `data-tooltip` on every
   button, replacing its native `title`. The modal bar's close button does the same.
2. **`Tooltip.Root` / `Trigger` / `Content`: DESCRIPTION and RICH tooltips** (e-store's
   component, ported).

## 1. Plain label tooltip (provider)

Put `data-tooltip` on a control that has an `aria-label`; the tip shows that label. Optional
`data-tooltip-side="bottom"` (M3: below the control in an app bar). The tip is `role="tooltip"`
`aria-hidden="true"` with no `aria-describedby`: the control's name is already its `aria-label`,
so a screen reader hears it once (e-store's `type="label"`).

- Hover (mouse / pen): shows after 700ms (e-store's delay; M3 gives none). Keyboard focus
  (`:focus-visible`): at once. A click that focuses it does not show it.
- Leaves 1.5s after the pointer leaves the control (M3), stays while the pointer is on the tip
  (WCAG 1.4.13 hoverable), leaves at once on blur or on a press of the control.
- Escape closes it and goes no further (a `sync$` that cancels the key), so a dialog around the
  control stays open; the same control shows no tip again until the pointer has left it.
- Follows its control when the page or a pane scrolls. Placed above (below if no room), 4dp away,
  8dp inside the window, at most 320dp and never wider than the window.
- Not shown: on touch (no hover; `title` showed nothing there either), for a control inside
  `Tooltip.Trigger`, for a control named only by `aria-labelledby`, and on hover over a disabled
  control. ONE provider per document.

Why not `title` (MDN, `title` attribute, accessibility concerns): it cannot be styled, does not
show on keyboard focus or touch, and alongside `aria-label` some screen readers read the name
twice.

Why measured placement and not CSS anchor positioning: anchor positioning is Baseline only since
2026-09 (MDN) and this library loads no polyfill. Moving to it (it would follow scroll by itself)
is an option for the owner.

## 2. `Tooltip` component

```tsx
<Tooltip.Root id="share-tip">
  <Tooltip.Trigger>
    <Button label="Share" aria-describedby="share-tip" />
  </Tooltip.Trigger>
  <Tooltip.Content>Anyone with the link can view</Tooltip.Content>
</Tooltip.Root>
```

| Part / prop                                                                 |                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Root` `id`                                                                 | the tip's id; put it in the control's `aria-describedby` (server HTML)                      |
| `Root` `delay` (700), `open`, `bind:open`, `type` (`description` / `label`) | e-store's                                                                                   |
| `Root` `persistent`                                                         | M3 persistent rich tooltip: opens on click, `popover="auto"` light dismiss                  |
| `Content` `variant`                                                         | `plain` (inverse-surface, body-small, 4dp corners) or `rich`                                |
| `Content` `side`                                                            | `top` (plain default) / `bottom` (rich default) / `left` / `right`; moves to stay on screen |
| `Content` `subhead`                                                         | rich: title-small, on-surface-variant                                                       |
| `q:slot="actions"`                                                          | rich: up to two `Button look="text"`                                                        |

Rich: `surface-container`, level 2, 12dp corners, padding 12 / 16 / 8 (12 without actions),
body-medium on-surface-variant, starts at the control's middle and extends to the inline end.
One tooltip at a time (opening one closes any other, the provider's included). Escape anywhere
closes it. Focus order: control, then the tip's buttons (Tab from the control into the tip keeps
it open); no focus trap.

Escape closes an open `Tooltip` and goes no further (a `sync$` cancels the key), like the
provider, so a dialog around the control stays open. A persistent tip: a click on its control
closes it again (the light dismiss on pointerdown is not undone by the click). `open` on the Root
shows the tip once the page is live (`qinit`). The provider and the component close each other:
one tip at a time.

M3 gives rich tooltips `role="tooltip"`; the second-agent review suggested a non-modal
`role="dialog"` when a rich tip has buttons (APG: a tooltip never takes focus). Kept as M3 says;
an open question for the owner.

## Left out from e-store

CSS anchor positioning with `positionTryFallbacks` (replaced by `tooltip-place.ts`), `hoverable`
(always hoverable now: WCAG 1.4.13), e-store's `max-w-50 whitespace-nowrap` (M3: up to 320dp,
wrapping).

## Proof

- PROOFED 2026-11-23: M3 specs (colours, type, sizes, padding, 1.5s), APG tooltip pattern,
  WCAG 2.2 1.4.13, MDN `title` and popover; Qwik rc.5 `useOnDocument` (qwikloader captures
  document events). Second agent reviewed the provider: fixes applied (scroll follows instead
  of hiding, Escape stays dismissed and does not close a dialog, stale label after a press,
  stranded tip, no double tip inside `Tooltip.Trigger`, narrow windows, timers reset on toggle).
- Measured in Chrome: plain tip 24px high, 4px radius, 4 / 8 padding, 12/16 type, 4px from the
  control, centred, below when no room above; hides 1.5s after leaving; shows on keyboard focus,
  not on programmatic focus after a mouse; Escape in a full-screen dialog closes the tip and
  leaves the dialog open. Rich: 12px radius, 12 / 16 / 8 padding, `surface-container`.
- Second review of the whole port (fresh agent, code only): fixed a persistent tip that could
  not be closed by its control, `open` not showing on load, the two Escape behaviours, one-way
  one-at-a-time, a scroll listener per closed tip. Re-run in Chrome after the fixes.
- NOT tested: real touch devices, screen readers.
