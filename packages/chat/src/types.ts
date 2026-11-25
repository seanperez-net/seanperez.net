// The chat's view types. Names and shapes from e-store's `@estore/chat` `src/types.ts`
// (`ChatPerson`, `ChatConversation`, `ChatMessage`, `ChatPreview`), cut to what a small
// messenger needs: spaces only as a kind + members (2026-11-24); no threads, mentions, reactions,
// pins or invites. Added (new, not in
// e-store): `ChatMessage.status` (a sent message's delivery state, for the bubble) and
// `ChatMessage.streaming` (an assistant reply still arriving: the seam for an AI conversation).

import type { AvatarPresence, IconName } from "@seanperez/ui";

export type ChatPresence = AvatarPresence;

/** What a person (or a device, or an assistant) shows as. Plain data: no email, no phone. */
export interface ChatPerson {
  id: string;
  name: string;
  /** A picture URL; none = initials (or `icon`) on a toned circle. */
  image?: string | null;
  presence?: ChatPresence | null;
  /** The avatar's tone seed (an id survives a rename); default `id`. */
  seed?: string;
  /** Shown on the avatar instead of initials (a device, an assistant). */
  icon?: IconName;
}

/**
 * Who a conversation is with. `direct`: a person. `device`: a device's own thread (alerts it
 * sends). `assistant`: an AI assistant (replies stream). `self`: notes to yourself. `space`: a
 * group conversation with several authors (e-store's `space`, added 2026-11-24 for the Google
 * Chat layout). Only the avatar, the header and the composer's hint differ; the components are
 * the same (e-store has `direct` / `space` only).
 */
export type ChatKind = "direct" | "device" | "assistant" | "self" | "space";

/** The list row's last line (e-store's `ChatPreview`, without mentions). */
export interface ChatPreview {
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface ChatConversation {
  id: string;
  kind: ChatKind;
  /**
   * What the conversation shows as: the other side, the viewer for `self`, the space itself
   * for a `space` (its name and an icon such as `groups`).
   */
  person: ChatPerson;
  /** Everyone in it (a space's members); absent = the viewer and `person`. */
  members?: ChatPerson[];
  lastMessage: ChatPreview | null;
  /** ISO time of the last message (the list's sort key and time). */
  lastMessageAt: string;
  unread: number;
}

/**
 * A sent message's state, as messengers show it under an outgoing bubble (new, not in
 * e-store). `failed` = not sent; the host decides what retry means.
 */
export type ChatMessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface ChatMessage {
  id: string;
  author: ChatPerson;
  /**
   * Plain text: line breaks kept, never HTML or markdown. `http(s)://` addresses in it become
   * links; `<@id>` / `<#id>` tokens become chips (`refs`).
   */
  body: string;
  createdAt: string;
  /** The viewer wrote it: an outgoing bubble. */
  mine: boolean;
  /** Outgoing only; absent = no status line. */
  status?: ChatMessageStatus;
  /**
   * The text is still arriving (an assistant's streamed reply). `MessageList` draws such a
   * message OUTSIDE its log (`streaming` prop, hidden from assistive tech) and the host adds the
   * finished message to `messages` when the stream ends, so it is announced once, whole.
   */
  streaming?: boolean;
  /** What the body's `<@id>` / `<#id>` tokens name (`ChatRef`). */
  refs?: ChatRef[];
  /** Link previews under the bubble (`ChatLinkEmbed`). */
  embeds?: ChatLinkEmbed[];
}

/**
 * Someone or somewhere a message's `body` names with a TOKEN, drawn as a chip that links to it
 * (2026-11-24, owner: "our chat also should have links able to be embedded like for
 * useContact in the message"). The body stays plain text with the token in place:
 * - `<@id>`: a person (e-store's `@estore/chat` mention token, `mentions.ts`, same shape);
 *   drawn as Google Chat's people smart chip (avatar + name), linking to `href` (their
 *   Contacts page) when there is one.
 * - `<#id>`: a place (NEW, not in e-store), drawn as a chip with a pin, linking to `href` (the
 *   map at that place).
 * A token with no matching entry is drawn as `labels.unknownRef`, never as the raw id.
 * `chatPlainText` gives the body with tokens as names (list previews, search, notifications).
 */
export type ChatRef =
  | {
      kind: "person";
      id: string;
      person: ChatPerson;
      /** Their page on this site (same tab); none = a chip that is not a link. */
      href?: string | null;
    }
  | {
      kind: "place";
      id: string;
      label: string;
      /** The map at this place (same tab). */
      href: string;
    };

/**
 * A link preview drawn under the bubble: e-store's feed `FeedEmbed` (`packages/feed/src/types.ts`,
 * the `link` kind) cut to what a static card needs. The host supplies it (the demo's data is
 * static: no unfurl fetch here); the host name is derived from `url`, never stored.
 */
export interface ChatLinkEmbed {
  kind: "link";
  /**
   * An `http:` / `https:` address; anything else draws no card. With `internal`, a path on
   * this site instead (`/feed/<slug>/`).
   */
  url: string;
  /**
   * A page on the HOST's own site (2026-11-25, the Site updates channel's posts): `url` is a
   * site path, opened in the same tab by the router (`Card.Root as="link"`), with no external
   * mark and no `rel="external nofollow ugc"`. Set by the host, never inferred from the URL;
   * a `url` that is not a plain site path (`/...`, not `//` or `/\`) draws no card.
   */
  internal?: boolean;
  title: string;
  /** The site's own name (Open Graph `og:site_name`); default the host name. */
  siteName?: string | null;
  description?: string | null;
  /** A picture (3:2), shown with `alt=""` (the title names the card). */
  imageUrl?: string | null;
}
