# MessageComposer

A multi-line field (`TextField type="textarea"`) and a send `IconButton` (filled, `md`, 56dp,
the field's height). From e-store's `MessageComposer`, without mentions, threads or the store
port.

## API

| Prop          | Type                                             | Default     |                                             |
| ------------- | ------------------------------------------------ | ----------- | ------------------------------------------- |
| `onSend$`     | `QRL<(text) => boolean \| void \| Promise<...>>` | required    | The host sends; return `false` to keep text |
| `id`          | `string`                                         | `useId`     | The textarea's id (a host focuses it)       |
| `name`        | `string`                                         | `"message"` |                                             |
| `placeholder` | `string`                                         | "Message"   |                                             |
| `hint`        | `string`                                         | key hint    | The supporting line                         |
| `disabled`    | `boolean`                                        | `false`     |                                             |
| `readOnly`    | `string`                                         | none        | A note replaces the field (read-only chat)  |
| `sendIcon`    | `IconName`                                       | `send`      |                                             |
| `labels`      | `Partial<ChatLabels>`                            | English     | `composerLabel`, `send`, ...                |

`onSend$` is the seam for every backend: a server action, a local echo, an assistant's stream.

## Keys and behaviour

- Enter sends, Shift+Enter adds a line (`aria-label` "Write a message", hint under the field).
  A `sync$` on the `<form>` stops the newline and calls `requestSubmit()` (Qwik rc.5
  "sync$() Synchronous Events": a `$()`runs too late to`preventDefault`), so a key and a
  click take one path. The submit reads the textarea, not the signal.
- An IME's committing Enter never sends (`isComposing`, and Safari's `keyCode` 229).
- `enterkeyhint="send"`; `autocomplete="off"` on the form (a message is not form history).
- The field grows with its line breaks up to five rows, then scrolls (`rows` from the text;
  soft-wrapped lines do not grow it).
- The send button is disabled while the text is blank or a send is running.
- It never focuses itself: the host focuses it (by `id`) after a user action.

Open (owner): on touch keyboards Enter-sends leaves no newline key; e.g. Enter = newline when
the pointer is coarse (a `matchMedia` check inside the `sync$`). Not done.

## Read-only conversations (2026-11-25)

`readOnly="Only Sean posts here. Updates come from the site's feed."` draws that note in the
composer's place, for a conversation nobody here can write in (the site's Site updates channel,
like a Discord announcement channel: the owner posts in the admin app, everyone reads). No field
and no send button: `onSend$` is never called. Chosen over `disabled` + `hint` after the RULE 2
review: a disabled textarea is not focusable (keyboard and screen-reader users tabbing through
never reach its hint) and a disabled field's supporting text is `on-surface` 38%, too faint for
the only explanation on the screen. The note is `body-medium`, `on-surface-variant`, on
`surface-container` (a different role from the pane's `surface`, rule S1). It takes `id` and
`tabindex="-1"`, so a host that focuses the composer when a conversation opens focuses the note.
