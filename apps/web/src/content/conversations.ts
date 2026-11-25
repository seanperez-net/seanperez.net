/**
 * The Messages app's demo conversations (owner, 2026-11-24: "add a messages section"; later the
 * same day: "look at the chat.google.com how they do it ... we need spaces apps shortcuts").
 * Static, public-safe content seen by the VISITOR, a guest account "You" (owner decision
 * 2026-11-25, memory `visitor-is-guest-you`; until then the site looked signed in as the owner):
 * NO email address, NO phone, no real people but the owner, who is a separate person here.
 * Client-safe (no server imports): the list, the threads and the details panel import it.
 *
 * Arranged as Google Chat's nav (measured in Chrome 2026-11-24, PLAN.md): Shortcuts (Home,
 * Mentions, Starred: `MESSAGES_SHORTCUTS`), then `MESSAGES_SECTIONS`:
 * - Direct messages: `sean-perez`, the owner's direct thread with the visitor (his ONE welcome
 *   message, which the visitor may delete in their browser), then `you`, the visitor's own
 *   "(you)" thread ("notes to self", empty).
 * - Spaces: `site-updates`. (The `devices` space, where made-up devices posted alerts, was
 *   dropped 2026-11-25 with the demo devices: the visitor's only device is their own browser,
 *   `components/this-device.ts`, which has nothing to post, and the owner wants it to have
 *   nothing to do with him.)
 * - Apps: `assistant` (listed ONCE, under Apps, since 2026-11-24: an app is not a person).
 * Since 2026-11-24 these sections are the scaffold's DRAWER (`MESSAGES_DRAWER_GROUPS`, owner:
 * "the shortcuts etc are in the drawer why are you not using our drawer for this"); the list
 * pane shows the chosen shortcut's conversations.
 * The people in them are ACCOUNTS (`content/accounts.ts`), the one record Contacts shares.
 * The assistant is a placeholder: no AI is connected; its replies are canned and stream in this
 * browser only (the seam for a real one, `PLAN.md`).
 *
 * Times are fixed ISO instants printed in UTC (as the feed's dates), so the server's HTML and
 * the browser agree.
 */
import {
  DEFAULT_CHAT_LABELS,
  chatPlainText,
  type ChatConversation,
  type ChatKind,
  type ChatMessage,
  type ChatPerson,
  type ChatRef,
} from "@seanperez/chat";
import type { IconName, LayoutDrawerItem } from "@seanperez/ui";
import {
  ASSISTANT_ACCOUNT,
  GUEST_ACCOUNT,
  OWNER_ACCOUNT,
  findAccount,
  toChatPerson,
} from "./accounts";

/** The viewer: the guest account (the account menu's user, same id, so the avatar's tone matches). */
export const ME: ChatPerson = toChatPerson(GUEST_ACCOUNT);

/** The site's owner, a separate person (his welcome message, his posts in the spaces). */
const SEAN = toChatPerson(OWNER_ACCOUNT);

const ASSISTANT = toChatPerson(ASSISTANT_ACCOUNT);

/** A member's Contacts page, if its account has one (the owner, the assistant). */
export const contactOf = (person: ChatPerson) =>
  findAccount(person.id)?.contactId ?? null;

export interface DemoThread {
  id: string;
  kind: ChatKind;
  /** What the conversation shows as (the other side; the space itself for a space). */
  person: ChatPerson;
  /** The list's and the header's title. */
  title: string;
  /** The header's second line: what it is. */
  subtitle: string;
  /** Everyone in it, the viewer included (the details panel). */
  members: ChatPerson[];
  unread: number;
  /** Listed under Shortcuts > Starred. */
  starred?: boolean;
  /** A message in it names the viewer: listed under Shortcuts > Mentions. */
  mentionsMe?: boolean;
  messages: ChatMessage[];
}

/** Each message, with the author and `mine` filled in. */
const said = (
  author: ChatPerson,
  id: string,
  createdAt: string,
  body: string,
  status?: ChatMessage["status"],
  extra?: Pick<ChatMessage, "refs" | "embeds">,
): ChatMessage => ({
  id,
  author,
  body,
  createdAt,
  mine: author.id === ME.id,
  status: author.id === ME.id ? (status ?? "read") : undefined,
  ...extra,
});

/**
 * Embeds in the demo (2026-11-24, owner: "our chat also should have links able to be embedded
 * like for useContact in the message"): a person chip (`<@id>`) is an ACCOUNT with its Contacts
 * page; a place chip (`<#id>`) would open the map there (`?at=<lat>,<lng>,<zoom>z`,
 * `components/map-url.ts`; none in the demo since 2026-11-25). Link cards are static data:
 * nothing is fetched.
 */
const personRef = (person: ChatPerson): ChatRef => {
  const contact = findAccount(person.id)?.contactId;
  return {
    kind: "person",
    id: person.id,
    person,
    href: contact ? `/contacts/${contact}/` : null,
  };
};
export const THREADS: DemoThread[] = [
  {
    id: "assistant",
    kind: "assistant",
    person: ASSISTANT,
    title: "Assistant",
    subtitle: "App · placeholder, not connected",
    members: [ME, ASSISTANT],
    unread: 0,
    messages: [
      said(
        ASSISTANT,
        "a1",
        "2026-11-24T15:00:00Z",
        "Hi! I'm the assistant's placeholder. No AI is connected to this demo yet: my replies are canned, and nothing you type here leaves this page.",
      ),
    ],
  },
  {
    id: "site-updates",
    kind: "space",
    person: { id: "site-updates", name: "Site updates", icon: "groups" },
    title: "Site updates",
    subtitle: "Space · 3 members",
    members: [ME, SEAN, ASSISTANT],
    unread: 0,
    messages: [
      said(
        SEAN,
        "u1",
        "2026-11-23T20:05:00Z",
        "Contacts is live: list-detail, the résumé in the profile, and a Contact me panel.",
      ),
      said(
        SEAN,
        "u2",
        "2026-11-24T16:20:00Z",
        "Messages now follows Google Chat's layout: shortcuts, direct messages, spaces and apps. The code: https://github.com/seanperez-net/seanperez.net",
        undefined,
        {
          embeds: [
            {
              kind: "link",
              url: "https://github.com/seanperez-net/seanperez.net",
              title: "seanperez-net/seanperez.net",
              siteName: "GitHub",
              description:
                "The site's monorepo: Qwik v2, Tailwind v4 and Material 3 on Cloudflare Workers.",
            },
          ],
        },
      ),
      said(
        ASSISTANT,
        "u3",
        "2026-11-24T16:21:00Z",
        "Noted. Spaces, apps and shortcuts are demo data for now: no backend yet. Ask <@assistant> for more, or use Contact me to reach Sean. The plain page: https://seanperez-net.github.io",
        undefined,
        {
          refs: [personRef(ASSISTANT)],
          embeds: [
            {
              kind: "link",
              url: "https://seanperez-net.github.io",
              title: "Sean Perez: projects and code",
              siteName: "seanperez-net.github.io",
              description:
                "Projects and code. Links to the website and the source on GitHub.",
              imageUrl: "https://seanperez-net.github.io/og-image.png",
            },
          ],
        },
      ),
    ],
  },
  {
    // The ADMIN account's message to everyone (2026-11-25, owner: "have one message there as an
    // example ... a general message to the user ... it can be deleted"; later: "its only a message
    // thats sent to everyone from the sean perez admin account"): the same welcome reaches every
    // visitor, FROM the admin TO them; it is not a chat with a signed-in Sean.
    // Deleting it hides it in the visitor's browser (`messages.local` `hidden`); a reply stays
    // there too, "Not sent" (`use-demo-thread.ts`). NO address in it: Contact me is the way.
    id: OWNER_ACCOUNT.chatId!,
    kind: "direct",
    person: SEAN,
    title: OWNER_ACCOUNT.name,
    subtitle: "Admin · message to everyone",
    members: [ME, SEAN],
    unread: 1,
    messages: [
      said(
        SEAN,
        "w1",
        "2026-11-25T12:00:00Z",
        "Hi, and welcome! I'm Sean, I built this site.\n\nEverything here is a working app, and this copy is yours: your profile, contacts, messages and status are saved in this browser only, and nothing you change is sent to me or to anyone else.\n\nWant to reach me? Write here and press Send: Contact me opens with your message, add your name and email, and it comes straight to me.\n\nYou can delete this message whenever you like. Enjoy looking around!",
      ),
    ],
  },
  {
    // The visitor's own "(you)" thread (notes to self), empty until they write in it. Saved in
    // their browser like every other message; nothing to send, so a note is "Sent" at once.
    id: GUEST_ACCOUNT.chatId!,
    kind: "self",
    person: ME,
    title: GUEST_ACCOUNT.name,
    subtitle: "Notes to self",
    members: [ME],
    unread: 0,
    starred: true,
    messages: [],
  },
];

export const messagesHref = (id: string) =>
  id ? `/messages/${id}/` : "/messages/";

/** Google Chat's nav sections under Shortcuts, in its order. */
export const MESSAGES_SECTIONS: {
  id: "direct" | "spaces" | "apps";
  label: string;
  threads: string[];
}[] = [
  {
    id: "direct",
    label: "Direct messages",
    threads: [OWNER_ACCOUNT.chatId!, GUEST_ACCOUNT.chatId!],
  },
  { id: "spaces", label: "Spaces", threads: ["site-updates"] },
  { id: "apps", label: "Apps", threads: ["assistant"] },
];

/**
 * The Shortcuts section: Home (`/messages/` itself) and two filtered views shown in the detail
 * pane. Their slugs are reserved: no thread may use them (checked below).
 */
export const MESSAGES_SHORTCUTS: {
  slug: "" | "mentions" | "starred";
  label: string;
  icon: IconName;
  /** The view's line when nothing matches. */
  empty: string;
}[] = [
  { slug: "", label: "Home", icon: "home", empty: "" },
  {
    slug: "mentions",
    label: "Mentions",
    icon: "alternate_email",
    empty: "No one has mentioned you yet.",
  },
  {
    slug: "starred",
    label: "Starred",
    icon: "star",
    empty: "Nothing starred yet.",
  },
];

export type MessagesShortcut = "mentions" | "starred";

export const isShortcut = (slug: string): slug is MessagesShortcut =>
  slug === "mentions" || slug === "starred";

// A thread id that is a shortcut's slug would be shadowed by the static route: fail the build.
for (const t of THREADS) {
  if (isShortcut(t.id)) throw new Error(`Reserved Messages id: ${t.id}`);
}

/** The threads a list view shows: Home (`""`) all, Mentions and Starred the matching ones. */
export const shortcutThreads = (slug: "" | MessagesShortcut) =>
  slug === ""
    ? THREADS
    : THREADS.filter((t) => (slug === "mentions" ? t.mentionsMe : t.starred));

/**
 * The Messages app's navigation as the scaffold's DRAWER (2026-11-24, owner: "the shortcuts etc
 * are in the drawer why are you not using our drawer for this"; Google Chat's nav). Each section
 * is a GROUP (a drawer item with its own `items`, e-store's level-2 expandable row), all open,
 * as Google Chat's sections start. `routes/layout.tsx` hangs these under the rail's Messages
 * destination, on `/messages/` routes only. Plain data (no QRLs): it is serialised with the
 * layout config.
 */
export const MESSAGES_DRAWER_GROUPS: LayoutDrawerItem[] = [
  {
    label: "Shortcuts",
    open: true,
    items: MESSAGES_SHORTCUTS.map((s) => ({
      href: messagesHref(s.slug),
      label: s.label,
      icon: s.icon,
    })),
  },
  ...MESSAGES_SECTIONS.map((section) => ({
    label: section.label,
    open: true,
    items: section.threads.map((id) => {
      const thread = THREADS.find((t) => t.id === id)!;
      return {
        href: messagesHref(id),
        label: thread.title,
        // The row's icon (2026-11-24, drawer hierarchy): the conversation's own (a space's
        // `groups`, the assistant's `smart_toy`), a person's `person`. Google Chat shows small
        // avatars here; a drawer item takes an icon name only.
        icon: thread.person.icon ?? ("person" as IconName),
      };
    }),
  })),
];

export const findThread = (id: string) => THREADS.find((t) => t.id === id);

/** A thread as the list shows it (`ChatConversationItem`). */
export function toConversation(
  t: DemoThread,
  unread = t.unread,
): ChatConversation {
  const last = t.messages[t.messages.length - 1];
  return {
    id: t.id,
    kind: t.kind,
    person: t.person,
    members: t.members,
    lastMessage: last
      ? {
          // A space's preview says who wrote it ("Sean Perez: ..."); "You: " is the row's own.
          // Tokens as names (`<@id>` -> "@Name"), never raw.
          body:
            t.kind === "space" && !last.mine
              ? `${last.author.name}: ${chatPlainText(last, DEFAULT_CHAT_LABELS)}`
              : chatPlainText(last, DEFAULT_CHAT_LABELS),
          createdAt: last.createdAt,
          mine: last.mine,
        }
      : null,
    lastMessageAt: last?.createdAt ?? "",
    unread,
  };
}

/** The canned assistant reply, streamed in this browser only (the seam, no AI call). */
export const ASSISTANT_REPLY =
  "Thanks! I can't answer yet: no AI is connected to this demo. When one is, its reply will stream in here, word by word, like this one did.";

/**
 * What a send to someone else says (the assistant answers locally; notes to self need no notice).
 * Since 2026-11-25 the visitor is a guest, not a "demo account": the message is kept in their
 * browser, "Not sent", and the snackbar's action opens Contact me (the real way to the owner).
 */
export const MESSAGES_DEMO_NOTICE =
  "Saved in your browser, not sent. To reach Sean, use Contact me.";

/** "New chat" (the rail FAB) and the other demo-only controls. */
export const MESSAGES_NEW_CHAT_NOTICE =
  "New chats can't be started on this site yet.";
export const MESSAGES_SEARCH_NOTICE =
  "Search in a conversation isn't built yet.";

/**
 * The Messages window's video call button (owner, 2026-11-24: "the video chat as well or meet").
 * A placeholder: a snackbar, as Search, rather than a disabled button (a disabled button is not
 * focusable, so its tooltip could not say why; the notice names the reason at once).
 */
export const MESSAGES_VIDEO_NOTICE =
  "Video calls aren't available on this demo.";
