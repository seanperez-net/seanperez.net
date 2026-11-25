# MessageList

The transcript: a scroller that starts at the newest message, around an ARIA `log` of the
messages, with a day heading before each day's first message. Name and scroller from e-store's
`@estore/chat` `MessageList` / `chat-workspace.tsx` (`flex-col-reverse`, DOM oldest first). The
log, the day headings and bubbles (not flat rows; Google Chat's DM anatomy, see
`message-bubble.md`) are NEW, not in e-store. Only the viewer's last message shows its status.

## API

| Prop              | Type                  | Default   |                                                        |
| ----------------- | --------------------- | --------- | ------------------------------------------------------ |
| `messages`        | `ChatMessage[]`       | required  | Oldest first                                           |
| `label`           | `string`              | required  | The log's name: "Messages with Truck 4"                |
| `streaming`       | `ChatMessage \| null` | -         | A reply still arriving, drawn after the log (see ARIA) |
| `labels`          | `Partial<ChatLabels>` | English   | Passed to the bubbles                                  |
| `onDelete$`       | `QRL<(id) => void>`   | -         | Each message gets an actions menu with Delete (2026-11-25); the host confirms and deletes |
| `dayHeadingLevel` | `2`-`6`               | `3`       | The day headings                                       |
| `locale`          | `string`              | `"en-US"` | Printed dates and times                                |
| `timeZone`        | `string`              | `"UTC"`   | Fixed, so server HTML and browser agree                |
| `class`, ...rest  | div attributes        |           | On the scroller (layout only)                          |

The scroller is `flex-1 min-h-0`: put it in a flex column with a bounded height.

## ARIA

- `role="log"` on a wrapper `<div>` (WAI-ARIA 1.2: new information added in order; implicit
  `aria-live="polite"`, `aria-relevant="additions text"`), `aria-live="polite"` set as well
  for older screen readers, named by `label`. The `<ol>` inside keeps its list semantics; each
  day heading is its own `<li>` (`ChatDaySeparator`).
- Content present when the region first renders is not announced: the history is quiet on
  load. Give each conversation a NEW `MessageList` (key it, or render it in the conversation's
  route), or switching conversations reads every message as an addition.
- Streaming: the in-progress reply is drawn OUTSIDE the log with `aria-hidden="true"` (and
  `aria-busy`), so it is not spoken token by token. Show `ChatTypingIndicator kind="replying"`
  meanwhile; when the stream ends, add the whole message to `messages`: one `<li>`, announced
  once. Checked in Chrome 2026-11-24 with a MutationObserver on the log: one addition per sent
  message and one for the finished reply. Screen reader output NOT tested (VoiceOver / NVDA).

## Usage

```tsx
<MessageList messages={messages.value} streaming={reply.value} label="Messages with Ada" />
<ChatTypingIndicator name={reply.value ? "Assistant" : null} kind="replying" />
<MessageComposer onSend$={send$} />
```
