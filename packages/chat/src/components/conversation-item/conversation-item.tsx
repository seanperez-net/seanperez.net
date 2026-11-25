import { component$ } from "@qwik.dev/core";
import { Avatar, List } from "@seanperez/ui";
import { tv } from "tailwind-variants/lite";
import { chatLabels, fillLabel, type ChatLabels } from "../../labels";
import type { ChatConversation, ChatPerson } from "../../types";
import { CHAT_LOCALE, CHAT_TIME_ZONE, formatListTime } from "../../utils";

/**
 * The unread count at a row's end. Our `Badge` is placed on an icon only (no inline placement:
 * `packages/ui/CLAUDE.md`), so the count is a small pill of its own here, in M3's large badge
 * colours (`error` / `on-error`, 16dp high, label-small), its words for screen readers.
 */
export const conversationItemVariants = tv({
  slots: {
    unread:
      "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-label-small text-on-error",
  },
});

/** A conversation's avatar: the person's picture or initials, or a device / assistant icon. */
export const ChatAvatar = component$<{
  person: ChatPerson;
  /** Avatar sizes: `md` 40dp (list rows), `appbar` 32, `lg` 56, `xs` 24 (a person chip). */
  size?: "xs" | "appbar" | "md" | "lg";
}>(({ person, size = "md" }) => (
  <Avatar
    // With an icon the circle shows it instead of initials (`fallbackIcon` needs no name).
    name={person.icon ? undefined : person.name}
    src={person.image ?? undefined}
    seed={person.seed ?? person.id}
    fallbackIcon={person.icon}
    presence={person.presence ?? undefined}
    size={size}
    decorative
  />
));

export interface ChatConversationItemProps {
  conversation: ChatConversation;
  /** The conversation's page (the row is a router link: the URL is the selection). */
  href: string;
  /** The conversation open beside the list (two-pane), or the current page. */
  selected?: boolean;
  /** A label for the row, e.g. "Sean Perez (you)"; default the person's name. */
  title?: string;
  labels?: Partial<ChatLabels>;
  locale?: string;
  timeZone?: string;
}

/**
 * One row of the conversation list: avatar, name, the last message ("You: ..." for your own),
 * its date and the unread count. From e-store's conversation row (`chat-workspace.tsx`: a
 * two-line `List.Item` with an avatar `start`, the preview as `supportingText`, the time as
 * `trailingSupportingText`, the unread badge as `end`), but a LINK row (`href`) as the site's
 * Contacts list, not e-store's listbox option with the selection in a client signal. Put it
 * in a `List.Root rovingFocus` (one Tab stop, arrows between rows). The link is named by its
 * content (name, last message, date, unread), as a messenger's row is read.
 */
export const ChatConversationItem = component$<ChatConversationItemProps>(
  ({
    conversation: c,
    href,
    selected,
    title,
    labels,
    locale = CHAT_LOCALE,
    timeZone = CHAT_TIME_ZONE,
  }) => {
    const L = chatLabels(labels);
    const name = title ?? c.person.name;
    const last = c.lastMessage;
    const preview = last ? `${last.mine ? `${L.you}: ` : ""}${last.body}` : "";
    const unread = c.unread > 0 ? fillLabel(L.unread, { count: c.unread }) : "";
    return (
      <List.Item
        data-chat-conversation={c.id}
        data-unread={c.unread > 0 ? "" : undefined}
        href={href}
        selected={selected}
        lines="two-line"
        supportingLines="one"
        start={<ChatAvatar person={c.person} />}
        headline={name}
        supportingText={preview || undefined}
        trailingSupportingText={formatListTime(
          c.lastMessageAt,
          locale,
          timeZone,
        )}
        end={
          c.unread > 0 ? (
            <span class={conversationItemVariants().unread()}>
              <span aria-hidden="true">{c.unread > 99 ? "99+" : c.unread}</span>
              <span class="sr-only">{unread}</span>
            </span>
          ) : undefined
        }
      />
    );
  },
);
