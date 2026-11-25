# MessagesWindow

The floating Messages window (Gmail's / Google Chat's pop-up chat, owner 2026-11-24): docked at
the bottom END of the viewport, a `TitleBar` (avatar, name, actions), the transcript
(`MessageList`), the typing line and the composer. NON-MODAL: the page behind stays usable.
Email and chat are one conversation in Messages (owner, 2026-11-24), so this is a Messages
thread, not a separate chat product.

NEW, not in e-store as a component. Its pattern is e-store's mail compose window
(`packages/mail/src/components/compose-window.tsx`: a top-layer non-modal window, `TitleBar
size="sm" tone="container"`, minimize, focus back to the opener), changed where the proof and
the second agent said so (below).

## Props

| Prop                                                                         | Type                                         | Default                                                          | What                                                                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `person`                                                                     | `ChatPerson`                                 | required                                                         | The title bar's avatar                                                                |
| `title`                                                                      | `string`                                     | required                                                         | The heading; names the window and the log ("Messages with {title}")                   |
| `messages`                                                                   | `ChatMessage[]`                              | required                                                         | The transcript                                                                        |
| `streaming`                                                                  | `ChatMessage \| null`                        |                                                                  | A reply still arriving (`MessageList`)                                                |
| `typingName` / `typingKind`                                                  | `string \| null` / `"typing" \| "replying"`  | / `"typing"`                                                     | The typing line                                                                       |
| `onSend$`                                                                    | `QRL<(text) => boolean \| void \| Promise>`  | required                                                         | The host's send (`MessageComposer`)                                                   |
| `onClose$`                                                                   | `QRL<() => void>`                            | required                                                         | After the exit animation; the host unmounts the window                               |
| `onDelete$`                                                                  | `QRL<(id) => void>`                          |                                                                  | Each message's Delete action (`MessageList onDelete$`, 2026-11-25); Escape inside its menu closes the menu only |
| `openFullHref`                                                               | `string`                                     |                                                                  | Shows "Open in Messages" (`open_in_full`, a router link)                              |
| `onVideoCall$`                                                               | `QRL<(el) => void>`                          |                                                                  | Shows the video call button (`videocam`); the host decides what it does               |
| `opener`                                                                     | `NoSerialize<HTMLElement>`                   | the focused element at open                                      | Where focus returns on close                                                          |
| `composerPlaceholder`                                                        | `string`                                     | `labels.composerPlaceholder`                                     |                                                                                       |
| `minimizeIcon` / `restoreIcon` / `openFullIcon` / `closeIcon` / `videoCallIcon` | `IconName`                                | `minimize` / `expand_less` / `open_in_full` / `close` / `videocam` | Icons as props (rule U4)                                                              |
| `labels`                                                                     | `Partial<ChatLabels>`                        |                                                                  | `windowMinimize`, `windowOpenFull`, `windowClose`, `videoCall` and the chat's own     |

Mount it on the CLIENT, after a user action (the host renders it when a page asks): it opens
itself on mount and moves focus.

## Element, ARIA, keys

- `<section popover="manual" role="dialog" aria-labelledby={heading}>` in the top layer. No
  `aria-modal`: it is not modal. Rule L18: non-modal overlays are popovers, never a z-index over
  the scaffold. `manual`: no light dismiss, and other popovers (menus, the snackbar) opening do
  not close it (MDN Popover API, read 2026-11-24). A later `showModal()` stacks above it and
  makes it inert (top-layer order is insertion order), which is right. The snackbar re-raises
  itself above it (`stayOnTop`).
- Not a `<dialog>` (e-store's is `<dialog popover="manual">`): as a popover the element adds only
  the implicit `dialog` role; `dialog.close()` and `cancel` do nothing without `open`, and the UA's
  `dialog:not([open]) { display: none }` needs an author `display` to show it (HTML spec; second
  agent). `dialog.show()` is non-modal but not in the top layer (MDN `<dialog>`).
- Opens with `openPopover`, closes with `closeAnimated` then `hidePopover()` (rule L26), then
  `onClose$`. Escape anywhere in it closes it, unless an inner control already handled the key
  (`defaultPrevented`); a `manual` popover gets no Escape from the browser (MDN: non-modal dialogs
  do not close on Escape by default; the APG dialog pattern closes on Escape).
- Focus: the composer on open; on close back to `opener` (or the element focused when it opened)
  when focus was in the window or is lost, never stolen from where the visitor went meanwhile
  (APG dialog; e-store's rule). Unmounted by the host without a close (another conversation, a
  navigation): the popover is hidden and the same focus rule applies.
- Minimize: the title bar only, 256px wide (Gmail). The body gets `hidden` (no Tab stops in it)
  but stays mounted, so a draft is kept. The button keeps its name "Minimize" and carries
  `aria-expanded` + `aria-controls` (APG Disclosure; the second agent: do not swap the name too).
  Its icon swaps (`minimize` / `expand_less`). The window keeps its role and name.

## Size and place

360px by 480px (`min()` against the viewport), 24px from the end edge, flush with the bottom,
16dp top corners (`rounded-t-lg`), `bg-surface`, elevation 3 (`shadow-3`), the title bar on
`surface-container-low`. HOUSE values from Gmail / Google Chat's pop-up chat (not an M3
component). Logical insets (`inset-e-6`): checked in Chrome with `dir="rtl"`, it sits 24px from
the left edge. It covers whatever is at the bottom end, the supporting pane included (as Gmail's
windows do).

Compact (under 600px): the HOST opens the conversation's page instead (`apps/web`
`messages-window-host.tsx`; second agent: a floating window on a phone would be a full-screen
sheet duplicating that page, with iOS keyboard and fixed-bottom problems). A window left open
while the viewport narrows spans the width (`max-sm:inset-x-0`).

## Motion

Enters the screen from its bottom edge, M3's bottom-sheet pair (`modal.md` "Motion", from
m3.material.io "Applying easing and duration"): 400ms (`medium-4`) Emphasized decelerate in, a
24px rise and a fade; 200ms (`short-4`) Emphasized accelerate out. Enter by `@starting-style`,
exit by `data-closing` on the still-open popover (`closeAnimated`), so Safari and Firefox, which
cannot transition `overlay`, play it in the top layer. Only the vertical axis moves: nothing to
mirror in RTL. Height and width transition with the minimize. `motion-reduce:transition-none`
(rule L23): no transition, nothing for `closeAnimated` to wait for.

PROOFED in Chrome 2026-11-24 (1697px window, rAF samples): enter 0 to 1 opacity and 24px to 0 in
about 400ms; exit by Close in 200ms, `:popover-open` until the last frame, then focus back on the
opener; Escape from the composer closes it the same way. NOT PROOFED: Safari / iOS (no device
here), reduced motion (read from the classes, not emulated).

## Second agent (fresh, 2026-11-24, not given this design)

Asked whether e-store's `<dialog popover="manual">` + `TitleBar` is right and whether something
is simpler. It said: `popover="manual"` on a `section role="dialog"` (taken); TitleBar's 40dp is
not M3, mark it house (done, `title-bar.md`); minimize as a disclosure with a stable name
(taken); under 600px go to the Messages page (taken); Escape closes and focus returns to the
recorded opener (taken); one window at a time (taken, the host); `autofocus` on the composer
instead of `.focus()` (NOT taken: `TextField` does not pass `autofocus` to its textarea today,
and a library change for it was out of scope; the window focuses the composer by id after
`openPopover`). It also warned the bottom-centre snackbar can overlap the window between 600 and
about 1000px: it does, and the snackbar stays above it (`stayOnTop`).
