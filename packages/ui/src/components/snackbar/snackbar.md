# Snackbar

M3 snackbar: a short message at the bottom of the window, one at a time, with an optional action
and close button. Specs: https://m3.material.io/components/snackbar (specs, guidelines,
accessibility read in Chrome 2026-11-23).

From e-store's `Snackbar` (`Snackbar.Root` provider with a queue, `useSnackbar()` returning
`showSnackbar$` / `closeSnackbar$`, `popover="manual"` container kept above later overlays by
`stayOnTop`, `role="status"` polite live region, Escape, inverse colors).

```tsx
<Snackbar.Root>
  ...a component that calls
  const { showSnackbar$ } = useSnackbar();
  showSnackbar$({ message: "Photo archived", action: "Undo", onAction$: undo$ });
</Snackbar.Root>
```

## API

`Snackbar.Root`: `duration` (5000), `position` (`center` / `start`, from 600dp), `closeLabel`
("Dismiss"), `closeIcon` (`close`).

`SnackbarConfig`: `message`, `action`, `longerAction` (the action on its own line under the text,
M3's fifth configuration), `showClose`, `duration` (0 = stays), `onAction$`, `onDismiss$`.

## Behaviour

- One at a time; later ones queue and show after the current one's 150ms exit.
- Leaves by itself after `duration` (M3: 4 to 10s), never when it has an action (M3
  accessibility). The action closes it.
- Escape closes it when focus is in it. Alt+G moves focus to its first button (M3 accessibility:
  "a keyboard shortcut to focus on actionable snackbars"); the key is cancelled.
- The live region is a separate visually hidden `role="status"` outside the popover (a closed
  popover is `display: none`, so not in the accessibility tree), always in the page; its text is
  set 100ms after the snackbar shows (text put in at the same moment is often missed). Focus is
  never moved to it. When it closes with focus inside (after Alt+G), focus goes back to where it
  was. A queued message does not restart the timer of the one showing.
- Compact windows: 16dp from the sides and the bottom. From 600dp: 344 to 672dp wide, centred or
  24dp from the start.
- Measured in Chrome: one line 344x48, two lines 68 high, 672 max, 16px from the bottom,
  `inverse-surface`, 4px corners, action `inverse-primary`.

## Left out from e-store (not M3, or not needed)

`top` and `end` positions, `containerClass` / `surfaceClass`, the external `queue` signal,
`Snackbar.Message` (SSR `<dialog open>`), standalone `Snackbar.Action` / `Snackbar.Close` parts,
the cross-Root wait loop (one Root here), the JavaScript full-width check (CSS breakpoints instead).

## Proof

- PROOFED 2026-11-23: M3 specs (colors, 48 / 68dp, corners, level 3, padding), guidelines (one
  at a time, queue, auto-dismiss, actions do not auto-dismiss), accessibility (polite, Esc,
  Alt+G); WAI-ARIA `status`; `stayOnTop` against the HTML top-layer order.
- Not tested: screen reader announcement.
