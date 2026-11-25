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

| Part                     | Element     | What                                                            |
| ------------------------ | ----------- | --------------------------------------------------------------- |
| `Modal.Root`             | `<div>`     | Holds the open state. `display: contents`.                      |
| `Modal.Trigger`          | `<button>`  | Opens it. Optional: any control can write `bind:open`.          |
| `Modal.Content`          | `<dialog>`  | The surface. Always rendered closed.                            |
| `Modal.CloseTitleAction` | `<div>`     | A bar with a close button and a title (sheets, full screen).    |
| `Modal.Header`           | `<header>`  | Holds Title and Description (basic dialog).                     |
| `Modal.Title`            | `<h2>`      | Names the dialog (`aria-labelledby`).                           |
| `Modal.Description`      | `<p>`       | Describes the dialog (`aria-describedby`).                      |
| `Modal.Section`          | `<section>` | The part that scrolls.                                          |
| `Modal.Footer`           | `<footer>`  | The actions.                                                    |
| `Modal.Close`            | `<button>`  | A text button that closes it.                                   |
| `Modal.DragHandle`       | `<button>`  | Bottom sheet only: the M3 drag handle (first child of Content). |

## API

`Modal.Root`

| Prop                  | Type                                                        | Default    | What                           |
| --------------------- | ----------------------------------------------------------- | ---------- | ------------------------------ |
| `bind:open`           | `Signal<boolean>`                                           | own signal | Open state                     |
| `position`            | `"center" \| "fullScreen" \| "adaptive" \| "bottom" \| "left" \| "right"` | `"center"` | Which M3 surface it is         |
| `closeOnOutsideClick` | `boolean`                                                   | `true`     | A press on the scrim closes it |
| `alert`               | `boolean`                                                   | `false`    | `role="alertdialog"`           |

`Modal.Content`: `<dialog>` props (not `open`, which the Root owns) and `onClose$` (after the
dialog closed, by any means). `Modal.Trigger` and `Modal.Close`: `<button>` props; their
`onClick$` runs after their own open / close.

`Modal.CloseTitleAction`: `title?: string`, `closeIcon?: IconName` (`"close"`),
`closeLabel?: string` (`"Close"`), `namesDialog?: boolean` (the title names the dialog; use it
when there is no `Modal.Title`), `actionLabel?: string` and `onAction$` (a text button at the
end, M3 full-screen dialog "Save"; it does not close the dialog by itself), `actionType?:
"button" | "submit"` (`"button"`; `"submit"` when the bar sits inside the dialog's `<form>`). The close button
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

| Position     | M3 component            | Surface                                              | Size                                                                       |
| ------------ | ----------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `center`     | Basic dialog            | `surface-container-high`, 28px corners, level 3      | 280 to 560px, 24px from the window                                         |
| `fullScreen` | Full-screen dialog      | `surface-container-high`                             | the window                                                                 |
| `adaptive`   | Full-screen dialog below 600px, basic dialog from 600px | as those two | the window; from 600px 560px (or the window less 24px a side) |
| `bottom`     | Modal bottom sheet      | `surface-container-low`, 28px top corners, level 1   | at most 640px wide; 72px below the window top (56px once wider than 640px) |
| `left`       | Modal navigation drawer | `surface-container-low`, 16px inner corners, level 1 | at most 400px wide                                                         |
| `right`      | Modal side sheet        | same                                                 | same                                                                       |

CSS hooks a host may set on `Modal.Content`: `--modal-sheet-width` (a side sheet's width,
default 100% up to 400px) and `--modal-bar-inset` (the bar's side inset, default 24px).

## Adaptive dialog (`position="adaptive"`, 2026-11-24)

For a dialog that holds a form. Owner, 2026-11-24: "why is the edit profile so strange skinny".
Cause: `center` sets only `min-width` / `max-width`; the `<dialog>`'s own UA width is
`fit-content`, so a dialog of text fields shrank to its inputs' intrinsic width (`size=20`,
about 170-200px each) and opened 291px wide in a 1920px window. `center` is not changed: M3's
basic dialog width is dynamic, and an alert should stay narrow.

M3 (m3.material.io/components/dialogs/specs and /guidelines, read in Chrome 2026-11-24): basic
dialog "Container width: Min 280dp; Max 560dp"; full-screen dialog "Container width; Max 560dp",
header 56dp (close, headline, text button); "Full-screen dialogs may be used for ... Dialogs that
include components which require keyboard input, such as form fields ... When changes aren't
saved instantly"; "Full-screen dialogs are for compact breakpoints only ... For medium and
expanded breakpoints, use a basic dialog"; "Dialogs can swap variants as the breakpoint changes".

So `adaptive` is `fullScreen` below 600px and a `center` dialog at its full width (560px) from
600px, in CSS only (`max-sm:` / `sm:` classes, every one a literal; no breakpoint read in render,
rule L19). Its parts follow:

| Part | Below 600px | From 600px |
| --- | --- | --- |
| `Modal.CloseTitleAction` (close, title, `actionLabel="Save" actionType="submit"`) | shown, 56px | hidden |
| `Modal.Header` + `Modal.Title` | hidden | shown |
| `Modal.Footer` (Cancel, Save) | hidden | shown |

Give it all three. Keep the `<form>` around the bar too, so both Saves submit it. The `Modal.Title`
names the dialog at both widths (an `aria-labelledby` target that is `display: none` still names
it, accname); leave `namesDialog` off on the bar. Motion is each side's own (`fullScreen`'s
400 / 200ms, `center`'s 500 / 150ms); `closeAnimated` waits for whichever runs. A window that
crosses 600px while it is open swaps variant in place (M3 allows it).

From e-store? Its profile edit dialog (`packages/feed/src/components/profile-edit-dialog.tsx`)
does the same swap by reading `layout.breakpoint` in render and passing `position`, with
`class="w-full"` on `Modal.Content`. Not taken: it breaks L19 (SSR renders the compact form,
then flips) and our no-`class=`-override rule. NEW here, proofed by a second agent (2026-11-24),
which agreed: the cause, `adaptive` over a `w-full` on `center`, CSS-only.

PROOFED 2026-11-24 in Chrome: 1568px window, 560px wide, 28px corners, link fields 436px (no
cut-off text), Header + Footer shown, bar hidden; enter 500ms (fade, 50px drop), exit by Cancel
150ms, still `:modal` to the last frame, focus back on the opener. 390px iframe: the whole
frame, 0px corners, 56px bar (close first, Save `type="submit"` last), Header / Footer hidden;
enter 400ms (48px rise), bar Save submits and exits. Light and dark. NOT PROOFED: Safari / iOS.

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

`<dialog>` and `::backdrop`: iOS Safari 15.4. Open animation (`@starting-style`): 17.5; older
versions just appear. Close animation: every version, because it plays BEFORE `close()` (see
"Motion"); it no longer needs `overlay`, which Safari and Firefox do not support. Not used, because iOS only has them in the 27.3 beta:
`closedby`, CloseWatcher. On a phone there is no Escape key, so every sheet needs a visible
close button (`Modal.CloseTitleAction` or `Modal.Close`).

Put a form in `center` or `fullScreen`, not `bottom`: the iOS keyboard covers the bottom of a
bottom sheet.

## Motion (2026-11-24)

Owner, 2026-11-24: the drawer's close "is not correct" on iOS. Cause: the exit was CSS only
(`transition-discrete` on `display` and `overlay`), run AFTER `dialog.close()`. `close()` takes the
dialog out of the top layer at once and its `::backdrop` with it; only a browser that can
transition `overlay` (Chrome 117+) keeps it painted on top meanwhile. Safari (iOS too) and Firefox
cannot (MDN `overlay`), so there the scrim vanished in one frame and the drawer slid out UNDER
the page.

Now (`utils/top-layer.ts` `closeAnimated`, as material-web's dialog and the owner's dog-travel
`useDialog().closeModal`): the Root sets `data-closing` on the still-open dialog, the
`open:data-closing:` classes give it the closed look, it waits for those transitions (on the
dialog and its `::backdrop` only, via `getAnimations()`, 600ms timeout), then `close()`. Escape:
`preventdefault:cancel` + `onCancel$` route it through the same path (when Chrome makes `cancel`
uncancellable, a second Escape without a click in between, it closes at once). Opened again
mid-exit: `openModal` drops `data-closing` and the enter transition runs back from where it is
(checked in Chrome). Reduced motion: `motion-reduce:transition-none` (dialog and scrim): no
transition, nothing to wait for, it opens and closes at once (rule L23).

| Position | Enter | Exit | Source |
| --- | --- | --- | --- |
| `left` (modal navigation drawer), `right` (side sheet) | slide, 500ms (`long-2`) Emphasized | 200ms (`short-4`) Emphasized | M3 "Applying easing and duration": "This drawer enters and exits temporarily with Emphasized easing"; enter long, exit short ("Enter vs. exit transitions"). The 500 / 200 pair is that page's example, not a per-component number |
| `bottom` (modal bottom sheet) | slide up, 400ms (`medium-4`) Emphasized decelerate | 200ms Emphasized accelerate | same page: "This Bottom sheet enters with Emphasized decelerate and exits permanently with Emphasized accelerate" + the suggested pairs |
| `fullScreen` | fade + 48px rise, 400ms Emphasized decelerate | 200ms Emphasized accelerate | the suggested pairs (enter / exit the screen) |
| `center` (basic dialog) | fade + 50px drop, 500ms Emphasized | 150ms (`short-3`) Emphasized accelerate | material-web `dialog/internal/animations.ts` (an implementation, not the spec; its container-height clip is left out). No scale: M3 transition patterns ("Scale and z-axis motion is avoided") |
| scrim (`::backdrop`, 32%) | linear, same duration | linear, same duration | material-web's scrim |

Easings (m3.material.io/styles/motion/easing-and-duration/tokens-specs, read 2026-11-24):
Emphasized decelerate `cubic-bezier(0.05, 0.7, 0.1, 1)`, Emphasized accelerate
`cubic-bezier(0.3, 0, 0.8, 0.15)` (PROOFED). Emphasized itself has no CSS value on M3 ("N/A, use
Standard as a fallback"); `--ease-emphasized` is material-web's `cubic-bezier(.3,0,0,1)`
(`internal/motion/animation.ts`), NOT PROOFED as M3. Open for the owner: a CSS `linear()` copy of
M3's Android path (Safari 17.2+), or M3 Expressive's spring curves (the motion overview's web table:
"use springs when possible", but the easing and duration system "is still used for transitions").

PROOFED 2026-11-24 in Chrome (rAF samples of `translate`, scrim opacity, `:modal`): drawer at
390px in, 500ms; out by scrim click and by its close button, 200ms, still `:modal` until the last
frame, then focus back on "Open menu"; dialog out by Escape, 150ms, focus back on its trigger.
NOT PROOFED: Safari / iOS (owner to check on the iPhone), reduced motion run live (the CSS rule
was read from the stylesheet, not emulated).

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
- `closeOnOutsideClick` and `alert` are reactive (2026-11-23, as `position`): signals in the
  context, read in the handler and in JSX, so a change applies to the mounted Root (they were
  read once at creation).
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
