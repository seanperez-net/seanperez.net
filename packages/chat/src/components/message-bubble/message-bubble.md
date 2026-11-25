# ChatMessageBubble

One message: incoming at the start, outgoing at the end (logical alignment, flips in RTL). NEW,
not in e-store (its rows are flat). M3 has no chat bubble component.

Anatomy from Google Chat's web DMs (measured with `getComputedStyle` in Chrome, 2026-11-24;
Google Chat DMs ARE bubbles, so they were kept, second agent agreed):

- A group (one author, `startsGroup`: within five minutes, same day) opens with a HEADER line:
  incoming = a 32dp `ChatAvatar` in a start column + "Name time" (`label-large` name,
  `label-small` time); outgoing = the time at the end. Later bubbles of the group have no header
  and keep the avatar column empty. Google: 32px avatar, 11px/16 500 time over the group.
- Corners 20dp (`rounded-lg-increased`; Google 20px), the author's side 4dp (`xs`) where a bubble
  joins the one above (Google 4px). Width `min(40rem, 85%)` (Google: max 640px).
- Colours stay M3 role pairs: outgoing `primary-container` / `on-primary-container` (Google: its
  `primary-container` #d3e3fd with on-surface text), incoming `surface-container-high` /
  `on-surface` (Google: a neutral #f2f2f2 from its baseline scheme). Ours hold contrast in dark
  and with any seed colour.
- Status only under the viewer's LAST message (`showStatus`, set by `MessageList`), as Google
  shows one receipt; `failed` ("Not sent") shows on every failed message.
- Not taken (future): hover actions (Google: three quick reactions, Add reaction, Reply in thread,
  Quote, More), read-receipt avatars, reactions.

## API

| Prop                 | Type                  | Default        |                                                 |
| -------------------- | --------------------- | -------------- | ----------------------------------------------- |
| `message`            | `ChatMessage`         | required       | `mine`, `status`, `streaming` decide the look   |
| `groupStart`         | `boolean`             | `true`         | First of a run by one author: the header line   |
| `showStatus`         | `boolean`             | `true`         | The status line (`failed` shows regardless)     |
| `as`                 | `"li" \| "div"`       | `"li"`         | `div` for the streaming bubble outside the list |
| `onDelete$`          | `QRL<(id) => void>`   | -              | The actions menu (Delete); see below            |
| `moreIcon`, `deleteIcon` | `IconName`        | `more_vert`, `delete` | The menu's trigger and Delete icons      |
| `labels`             | `Partial<ChatLabels>` | English        | `you`, `status*`                                |
| `locale`, `timeZone` | `string`              | `en-US`, `UTC` |                                                 |

Status (outgoing only): `sending` (schedule), `sent` (check), `delivered` / `read` (done_all),
`failed` (error, "Not sent"). The icon is decorative; the word is shown and spoken.

## ARIA

- The sender and time are said in words in every bubble (an sr-only "Truck 4, 2:03 PM:" before
  the body): side and colour say nothing to a screen reader, and a grouped bubble shows no name.
  The visual header line is `aria-hidden` (it would repeat them).
- `<time datetime>` in the header. `aria-busy="true"` while `streaming`.
- The body is plain text (`white-space: pre-wrap`): line breaks kept, never HTML. Since
  2026-11-24 its links and `<@id>` / `<#id>` chips are drawn by `renderChatBody`, and
  `message.embeds` as link cards UNDER the bubble (outside its `<p>`, on the author's side, max
  28rem): `message-embeds/message-embeds.md`.

## Actions menu (2026-11-25)

With `onDelete$`, each message gets a `more_vert` menu button beside its bubble (on the bubble's
inner side: after an incoming one, before an outgoing one), named "Message actions: {name}"
(`labels.messageActions`), holding ONE item, Delete (`labels.deleteMessage`,
`data-chat-delete="<id>"`). FROM E-STORE (`@estore/chat` `message-list.tsx`: `Menu.Trigger
look="plain" size="xs"`, `Menu.Content align="end"`, `Menu.Item` with an icon, hidden until hover
or focus), cut to Delete; e-store's reply, edit, pin, star and mark-unread items are left out.
Differences: it shows on any message the host allows (here: every message, the visitor's copy),
it stays visible while its menu is open, and it is always visible on a coarse pointer (touch has
no hover). The confirm dialog is the HOST's (e-store keeps its `ChatConfirmDialog` in the list;
ours keeps the library free of storage and wording).
