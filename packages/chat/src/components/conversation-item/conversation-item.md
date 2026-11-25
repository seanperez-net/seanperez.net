# ChatConversationItem, ChatAvatar

One conversation row: avatar, name, the last message ("You: ..." for your own, one line), its
date and the unread count. From e-store's conversation row in `chat-workspace.tsx` (a two-line
`List.Item`: avatar `start`, preview `supportingText`, time `trailingSupportingText`, unread
`end`), but a LINK row (`href`), as the site's Contacts list: the URL is the selection
(e-store: a listbox option and a client signal). Use it inside `List.Root rovingFocus`.

| Prop                 | Type                  | Default        |                               |
| -------------------- | --------------------- | -------------- | ----------------------------- |
| `conversation`       | `ChatConversation`    | required       |                               |
| `href`               | `string`              | required       | The conversation's page       |
| `selected`           | `boolean`             | -              | Open beside the list          |
| `title`              | `string`              | person's name  | "Sean Perez (you)"            |
| `labels`             | `Partial<ChatLabels>` | English        | `you`, `unread`               |
| `locale`, `timeZone` | `string`              | `en-US`, `UTC` | The date ("Nov 24", absolute) |

The unread count is part of the row's TRAILING SUPPORTING TEXT (M3 lists "Trailing text": a
date or a count), under the time, in the list item's trailing-text style (label-small,
on-surface-variant), bold; "99+" above 99, its words ("2 unread") in an sr-only span. Owner
2026-11-25: M3's trailing text, not a hand-drawn pill (until then an `error` / `on-error` pill in
`end`). The link is named by its content: name, last message, date, unread.

`ChatAvatar` (`person`, `size` `appbar` | `md` | `lg`): the library `Avatar`, decorative, with
the person's initials, picture, or `icon` (a device, an assistant) through `fallbackIcon`.
