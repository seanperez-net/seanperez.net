# @seanperez/chat

The chat UI for seanperez.net's Messages app, and later an AI assistant's conversation. Built
only on `@seanperez/ui` components through their props; no data, no backend: a host passes
plain data in and gets text out through `MessageComposer onSend$`.

Scaffolded with `pnpm create qwik@rc library ./chat` (2026-11-24), like `packages/ui`;
departures are logged in the workspace's `QWIK-DEFAULTS.md`. Structure and names follow
e-store's `@estore/chat` (read-only reference), cut to a small messenger; what is new is said in
each component's `.md`.

## Parts

| Export                                                               | What                                                                                 | `.md`                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------- |
| `ChatConversationItem`                                               | A conversation row (link) for `List.Root rovingFocus`                                | `components/conversation-item/` |
| `ChatAvatar`                                                         | A person's, device's or assistant's avatar                                           | `components/conversation-item/` |
| `ChatMessageBubble`                                                  | One message: Google Chat's DM anatomy (group header with avatar, name, time), status | `components/message-bubble/`    |
| `ChatDaySeparator`                                                   | The day heading in the transcript                                                    | `components/day-separator/`     |
| `MessageList`                                                        | The transcript: scroller + ARIA log + streaming slot                                 | `components/message-list/`      |
| `MessageComposer`                                                    | Field + send button; Enter sends, Shift+Enter adds a line                            | `components/message-composer/`  |
| `ChatTypingIndicator`                                                | "X is typing…" / "X is replying…" (polite status)                                    | `components/typing-indicator/`  |
| `MessagesWindow` | The floating, non-modal Messages window (Gmail / Google Chat pop-up): `TitleBar`, transcript, composer; minimize, open in Messages, video call slot | `components/messages-window/` |
| `renderChatBody`, `ChatRefChip`, `ChatLinkCard`, `ChatMessageEmbeds` | Links, person / place chips (`<@id>` / `<#id>`) and link cards in a message          | `components/message-embeds/`    |
| types, labels, utils                                                 | `ChatMessage`, `ChatConversation`, `ChatPerson`; `DEFAULT_CHAT_LABELS`; date helpers |                                 |

## Spaces (2026-11-24)

`ChatKind` has `space` (e-store's name) and `ChatConversation.members`; a space's `person` is the
space itself (name + `groups` icon). Messages already carry their `author`, so several authors
need nothing more. No roles, invites, threads or mentions model: the host's demo data marks
mentions and stars (`apps/web/src/content/conversations.ts`).

## Embeds (2026-11-24)

`ChatMessage.refs` (what `<@id>` / `<#id>` tokens in the body name) and `ChatMessage.embeds`
(link cards); `http(s)://` addresses in the body become links. See
`components/message-embeds/message-embeds.md`. A host shows previews with `chatPlainText`.

## The AI seam

`ChatMessage.streaming` and `MessageList streaming`: a reply still arriving is drawn after the
log, hidden from assistive tech; `ChatTypingIndicator kind="replying"` says it is coming; the
host adds the finished message to `messages` (announced once). A host's `onSend$` can call any
backend; nothing here does.

## Using it in an app

- `package.json`: `"@seanperez/chat": "workspace:*"`. The app imports the BUILT `lib/`: run
  the root `pnpm build` (ui, then chat, then the app) after changing the package.
- The app's CSS scans the package's classes: `@source "<path>/packages/chat/src";` beside the
  UI library's (`apps/web/src/global.css`). The package ships no CSS.
- Dates print in a fixed locale and zone (default `en-US`, `UTC`), never relative to now, so
  server HTML and the browser agree.

## Develop

`pnpm dev:chat` at the monorepo root (or `pnpm dev` here): the demo route `src/routes/index.tsx`
with `src/routes/_data/mock-chat.ts` (made-up people). `pnpm lint`, `pnpm exec tsc --noEmit`,
`pnpm build`. `@seanperez/ui` is a PEER dependency (and a dev one): the build externalises
`dependencies` + `peerDependencies`, so it is never bundled into `lib/`.
