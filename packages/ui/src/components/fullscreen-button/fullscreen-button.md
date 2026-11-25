# FullscreenButton

A toggle that puts one element (a pane) in full screen with the Fullscreen API, and takes it out
again. Used by `Layout.PaneHeader fullscreen`; use it free-standing only for an element you own.

From e-store's `FullscreenButton` (`components/fullscreen-button/`, 2026-11-24), cut from a media
player's button to any element: `targetId` replaces `mediaId` / `containerId`, and the iPhone
video fallback (`webkitEnterFullscreen()` on a `<video>`) is left out (there is no video).

M3: a standard `IconButton` (https://m3.material.io/components/icon-buttons). Icons
`fullscreen` / `fullscreen_exit` (Material Symbols Outlined, gstatic, 2026-11-24).

## API

| Prop | Type | Default | Description |
|---|---|---|---|
| `targetId` | `string` | required | `id` of the element made full screen |
| `label` | `string` | `'Full screen'` | constant accessible name and tooltip |
| `enterIcon` / `exitIcon` | `IconName` | `'fullscreen'` / `'fullscreen_exit'` | |
| `look`, `size` | IconButton props | `'standard'`, `'sm'` | |
| `onFullscreenChange$` | `QRL<(on: boolean) => void>` | none | every change, read from events |

## Behaviour (e-store's)

- Absent (a `<span hidden>`, no button) on the server and wherever the element cannot go full
  screen: no `Element.requestFullscreen` (iPhone Safari: MDN BCD "Only available on iPad, not on
  iPhone"), or `document.fullscreenEnabled` false (an iframe whose `allow` refuses `fullscreen`,
  Permissions-Policy). Read in a `document-ready` visible task. A same-origin iframe without an
  `allow` attribute IS allowed (the policy's default allowlist is `'self'`). Checked in Chrome
  2026-11-24: shown on the page and in a same-origin iframe; absent in
  `<iframe allow="fullscreen 'none'">`.
- The click is a NATIVE listener added by that task, not an `onClick$`: `requestFullscreen()`
  needs the click's transient activation, which a lazily loaded `$()` handler can outlive.
- `aria-pressed` and the icon follow `fullscreenchange` (`document.fullscreenElement ===
  target`), never the click: the request can be refused, and Escape leaves full screen without
  a click. A refusal is swallowed (`.catch`).
- A showing popover cannot go full screen (Fullscreen spec, "fullscreen element ready check"),
  which is why `Layout.SupportingPane` has no such button: below 840px it is a popover sheet.

## What iPhone gets

No button (no dead control). On compact screens the primary pane already fills the width. The map
on `/maps/` is different: MapLibre's own control falls back to a CSS "pseudo full screen" there
(see `apps/web/src/components/map-view.tsx`).

## Overlays while an element is full screen (Fullscreen and HTML specs)

- Entering full screen closes open `popover="auto"` popups (menus, rich tooltips): the spec runs
  "hide popovers until".
- Anything shown AFTER (a menu opened from the pane, the plain tooltip, a snackbar, a dialog)
  enters the top layer above the full-screen element, wherever its DOM is. A `manual` popover
  already showing before (a snackbar mid-message) stays under it until it is shown again.
- Elements outside the full-screen element are not painted (rail, app bar, companion rail).

## ARIA

WAI-ARIA APG toggle button: constant name, `aria-pressed`, `aria-controls` = the target. Escape
leaves full screen (the browser's).

## Web standards

[Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API),
[Fullscreen spec](https://fullscreen.spec.whatwg.org/). The UA's `:fullscreen` rule makes the
element fixed, inset 0, 100% wide and high; its `::backdrop` is black, so the element needs an
opaque fill and square corners (`Layout.Pane` has both: `bg-surface`,
`[&:fullscreen]:rounded-none`; Tailwind 4.3.5 has no `fullscreen:` variant).

CSS hook: `data-qds-fullscreen-button`.

## Tested

Chrome, 2026-11-24 (dev server): the button renders in the Contacts pane header, light and dark,
no console errors; a click calls `requestFullscreen()` on `<main>` with transient activation. The
automated Chrome refused every full-screen request ("not granted", the same for a bare test
button calling `document.documentElement.requestFullscreen()`), so entering full screen, the
pressed state and Escape are NOT verified in a real session yet: check by hand.
