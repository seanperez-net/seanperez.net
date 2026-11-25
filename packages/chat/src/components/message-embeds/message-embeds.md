# Message embeds (links, chips, link cards)

2026-11-24 (owner: "our chat also should have links able to be embedded like for useContact in
the message"). Exports: `renderChatBody`, `ChatRefChip`, `ChatLinkCard`, `ChatMessageEmbeds`;
data helpers in `src/body.ts` (`chatBodyTokens`, `chatPlainText`, `chatLinkHref`,
`chatEmbedHost`). `ChatMessageBubble` uses them; a host only fills the data.

## Data (`types.ts`)

`body` stays PLAIN TEXT (search, previews and edits keep working). In it:

| In `body`                    | Needs                                           | Drawn as                                                       | From                                                                      |
| ---------------------------- | ----------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `https://...` / `http://...` | nothing                                         | an inline link, new tab                                        | e-store feed `tokenize.ts` rules, cut down (no bare domains, no TLD list) |
| `<@id>`                      | `refs: [{ kind: "person", id, person, href? }]` | a person chip: 24dp avatar + name, a link to `href` (same tab) | e-store `@estore/chat` mention token (PORTED); the chip is NEW            |
| `<#id>`                      | `refs: [{ kind: "place", id, label, href }]`    | a place chip: pin + label, a link to the map                   | NEW                                                                       |

`embeds: [{ kind: "link", url, title, siteName?, description?, imageUrl? }]`: link cards under
the bubble (e-store's feed `FeedEmbed`, link kind, cut down; PORTED). Static data: nothing is
fetched. A token with no matching ref shows `labels.unknownRef` ("Unknown"), never the raw id.
`chatPlainText(message, labels)` gives the body with tokens as names (`@Name`) for list previews.

## Look

- Chip: 24dp pill (fits a 24dp line of `body-large`), `surface` / `on-surface`, `label-large`,
  M3 state layer (8 / 10 / 12%), `focus-ring`. Not our `Chip` (a button with no link form and no
  avatar, 32dp): built on `UnstyledButton type="link"` (router `Link`, `safeHref`). A person with
  no `href` is the same pill as a `<span>` (not a link).
- Off-site link: underlined, then the library's external mark (`open_in_new`, 16dp, mirrored in
  RTL, named by `labels.externalLink`, "external link, opens in a new tab"); `target="_blank"`,
  `rel="external nofollow ugc noopener noreferrer"` (`ugc` / `nofollow`: user-written).
- Link card: e-store's `EmbedCard` (`look="m3"`): outlined `Card.Root as="a"` (`rel` external,
  new tab), max 28rem, picture 1.91:1, the Open Graph 1200 x 630 shape (e-store's is 3:2, Farcaster's; changed 2026-11-24 because it cropped OG images) (`alt=""`, lazy, `no-referrer`), source line `body-small`
  `on-surface-variant` with `open_in_new`, title `title-small`, description `body-medium`, two
  lines.

## ARIA

- Chips are links named by their visible text (the person's name, the place); the avatar and the
  pin are decorative.
- A card is ONE link (nothing focusable inside), named "Title (site), external link, opens in a
  new tab" (e-store's pattern). Cards sit OUTSIDE the bubble's `<p>` and its sr-only "Name, time:"
  prefix: no nested links, no block content in a paragraph.
- Body text stays text nodes: never HTML.
- A streaming reply is plain text until it lands whole.
