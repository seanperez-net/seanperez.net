# Modal

Material 3 dialogs and sheets on the native `<dialog>` element, opened with `showModal()`. The
browser supplies the scrim (`::backdrop`), the focus trap, the inert page behind and Escape.

- https://m3.material.io/components/dialogs/specs
- https://m3.material.io/components/side-sheets/specs
- https://m3.material.io/components/bottom-sheets/specs
- https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

A smaller copy of e-store's `Modal` (same part names). e-store's `Dialog` is the same thing as
`Modal position="center"`, so there is no separate Dialog here.

PROOFED 2026-11-23 against MDN browser-compat-data, Apple's Safari release notes and the installed
Qwik 2.0.0-rc.5 (`packages/ui/.claude/notes/modal-ios-proof-2026-11-23.md`). Run in Chrome on
macOS. NOT yet run on an iPhone: the hand-test list is in that note.

## Parts

| Part                     | Element     | What                                                         |
| ------------------------ | ----------- | ------------------------------------------------------------ |
| `Modal.Root`             | `<div>`     | Holds the open state. `display: contents`.                   |
| `Modal.Trigger`          | `<button>`  | Opens it. Optional: any control can write `bind:open`.       |
| `Modal.Content`          | `<dialog>`  | The surface. Always rendered closed.                         |
| `Modal.CloseTitleAction` | `<div>`     | A bar with a close button and a title (sheets, full screen). |
| `Modal.Header`           | `<header>`  | Holds Title and Description (basic dialog).                  |
| `Modal.Title`            | `<h2>`      | Names the dialog (`aria-labelledby`).                        |
| `Modal.Description`      | `<p>`       | Describes the dialog (`aria-describedby`).                   |
| `Modal.Section`          | `<section>` | The part that scrolls.                                       |
| `Modal.Footer`           | `<footer>`  | The actions.                                                 |
| `Modal.Close`            | `<button>`  | A text button that closes it.                                |
| `Modal.DragHandle`       | `<button>`  | Bottom sheet only: the M3 drag handle (first child of Content). |

## API

`Modal.Root`

| Prop                  | Type                                                        | Default    | What                           |
| --------------------- | ----------------------------------------------------------- | ---------- | ------------------------------ |
| `bind:open`           | `Signal<boolean>`                                           | own signal | Open state                     |
| `position`            | `"center" \| "fullScreen" \| "bottom" \| "left" \| "right"` | `"center"` | Which M3 surface it is         |
| `closeOnOutsideClick` | `boolean`                                                   | `true`     | A press on the scrim closes it |
| `alert`               | `boolean`                                                   | `false`    | `role="alertdialog"`           |

`Modal.CloseTitleAction`: `title?: string`, `closeIcon?: IconName` (`"close"`),
`closeLabel?: string` (`"Close"`), `namesDialog?: boolean` (the title names the dialog; use it
when there is no `Modal.Title`), `actionLabel?: string` and `onAction$` (a text button at the
end, M3 full-screen dialog "Save"; it does not close the dialog by itself). The close button
leads on a `left` sheet and on a full-screen dialog (M3: close, headline, action) and trails
elsewhere. Its plain tooltip is `data-tooltip` (`TooltipProvider`), not `title`.

`Modal.Header`: `icon?: IconName`: the M3 hero icon (24dp, `secondary`) above the title; with it
the header is centred (M3: "if a dialog has an icon, the headline is center-aligned").

`Modal.Section`: `padding?: "default" | "none"`, `dividers?: boolean` (M3 dialog dividers: a 1dp
`outline-variant` line above and below scrolling content).

`Modal.DragHandle`: `label?: string` ("Drag handle"). With it a bottom sheet opens at most half
the window high (M3: a modal sheet's initial height is capped at 50%). A press (Enter / Space /
click) expands it to full height and back (`aria-expanded`); a drag up expands, a drag down
collapses, and closes it when already collapsed. The sheet follows the pointer down while
dragging. The press is the single-pointer alternative (WCAG 2.5.7).

| Position     | M3 component            | Surface                                              | Size                                |
| ------------ | ----------------------- | ---------------------------------------------------- | ----------------------------------- |
| `center`     | Basic dialog            | `surface-container-high`, 28px corners, level 3      | 280 to 560px, 24px from the window  |
| `fullScreen` | Full-screen dialog      | `surface-container-high`                             | the window                          |
| `bottom`     | Modal bottom sheet      | `surface-container-low`, 28px top corners, level 1   | at most 640px wide; 72px below the window top (56px once wider than 640px) |
| `left`       | Modal navigation drawer | `surface-container-low`, 16px inner corners, level 1 | at most 400px wide                  |
| `right`      | Modal side sheet        | same                                                 | same                                |

CSS hooks a host may set on `Modal.Content`: `--modal-sheet-width` (a side sheet's width,
default 100% up to 400px) and `--modal-bar-inset` (the bar's side inset, default 24px).

## ARIA and keys

Native `dialog` role, `aria-labelledby` from `Modal.Title` (or the bar's title with
`namesDialog`), `aria-describedby` from `Modal.Description`. Escape closes; focus moves into the
dialog on open and back to the opener on close; Tab stays inside. All of that is the browser's.
`Modal.Trigger` has `aria-haspopup="dialog"`.

A name passed on `Modal.Content` wins (2026-11-23): `aria-labelledby` replaces the Title
default, `aria-label` drops it (a Title would otherwise outrank the label, accname), and
`aria-describedby` replaces the Description default. Without them nothing changes. Prefer
`aria-labelledby` on a visible heading over `aria-label` (ARIA in HTML: visible labels first).

## Browser support

`<dialog>` and `::backdrop`: iOS Safari 15.4. Open animation: 17.5. Close animation: 18.0 (older
versions just appear and disappear). Not used, because iOS only has them in the 27.3 beta:
`closedby`, CloseWatcher. On a phone there is no Escape key, so every sheet needs a visible
close button (`Modal.CloseTitleAction` or `Modal.Close`).

Put a form in `center` or `fullScreen`, not `bottom`: the iOS keyboard covers the bottom of a
bottom sheet.

## Where it differs from e-store's Modal

Left out: `mode` (always modal), `top`, `scrim={false}`, `maxHeight`, Container, Grid, DragBar,
Media, Image, nested levels, and the JavaScript scroll lock on `<html>`.

Dialog (2026-11-23): the M3 basic and full-screen dialogs ARE `position="center"` and
`"fullScreen"`; no separate Dialog component (e-store has both `Dialog` and `Modal`; ours keeps
one implementation). Added from e-store's Modal: the Header hero icon, the bar's action (here
`actionLabel` + `onAction$`, e-store: an `action` JSX prop and `actionPlacement`). Differs: the
close button LEADS on a full-screen dialog (M3 specs); e-store's trails it.

New, not in e-store:

- The scrim press is recorded by a `sync$` handler. With e-store's two lazy `$()` handlers the
  first press after a page load was lost (seen in Chrome, 2026-11-23).
- `overscroll-contain` on the dialog and the Section (iOS scroll chaining).
- The bar's `title` is a string and `closeIcon` an icon name (e-store: JSX).
- `--modal-sheet-width` and `--modal-bar-inset`.
- `center`'s minimum is `min(280px, 100dvw - 48px)` (M3 280dp), so a 320px window still fits.
- `Modal.DragHandle` is ours: e-store's DragHandle drives detents; this one has M3's two states
  (half, full) and closes on a drag down.

Proof (2026-11-23): PROOFED against the M3 dialog and bottom sheet specs and accessibility pages
and the APG dialog pattern. Measured in Chrome: basic dialog 28px corners, icon 24px
`secondary`, centred header, 16px gaps, dividers 1px `outline-variant`; full-screen bar 56px,
close at the start, Save at the end; bottom sheet 50% high with the handle, 56px from the top
when expanded, handle 48px, press / drag up / drag down / drag down again closes.

## Usage

```tsx
const open = useSignal(false);

<Modal.Root bind:open={open}>
  <Modal.Trigger>Delete</Modal.Trigger>
  <Modal.Content>
    <Modal.Header>
      <Modal.Title>Delete this page?</Modal.Title>
      <Modal.Description>This cannot be undone.</Modal.Description>
    </Modal.Header>
    <Modal.Footer>
      <Modal.Close>Cancel</Modal.Close>
      <Button label="Delete" onClick$={() => (open.value = false)} />
    </Modal.Footer>
  </Modal.Content>
</Modal.Root>;
```
