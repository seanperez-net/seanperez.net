import { component$ } from "@qwik.dev/core";
import type { JSXOutput } from "@qwik.dev/core";
import { Card, Icon, UnstyledButton } from "@seanperez/ui";
import { tv } from "tailwind-variants/lite";
import {
  chatEmbedHost,
  chatBodyTokens,
  chatLinkHref,
  chatSitePath,
  chatRefFor,
  chatRefName,
} from "../../body";
import { chatLabels, type ChatLabels } from "../../labels";
import type { ChatLinkEmbed, ChatMessage, ChatRef } from "../../types";
import { ChatAvatar } from "../conversation-item/conversation-item";

/**
 * A message's embeds (2026-11-24): the body's links and chips, and its link cards.
 *
 * - Chips (`ChatRefChip`): NEW, not in e-store (its mentions are coloured text, `message-body.tsx`).
 *   Google Chat's people smart chip: a pill in the line of text with the person's avatar and
 *   name, a link to their page. A place chip has a pin instead. Our `Chip` is a button with no
 *   link form and no avatar (M3 assist chip: 32dp, too tall for a 24dp line of text), so the
 *   chip is drawn here on the library's link primitive (`UnstyledButton type="link"`: the
 *   router's `Link`, the `href` through `safeHref`), in the M3 chip's colours and state layer.
 * - Links: an `http(s)://` address in the text (`chatBodyTokens`) is a link to a page OFF the
 *   site: a new tab, `rel="external nofollow ugc"` (+ `noopener noreferrer` from the new tab;
 *   `ugc` / `nofollow`: written by a user), and the library's external mark (`open_in_new`,
 *   mirrored in RTL, read as `labels.externalLink`), as `Button` / `List.Item` do for
 *   `rel="external"`.
 * - Link card (`ChatLinkCard`): e-store's feed `EmbedCard` link card (`packages/feed/src/
 *   components/embed-card.tsx`, `look="m3"`), ported: an outlined `Card.Root as="a"` (ONE link,
 *   nothing focusable inside), the picture 1.91:1 (Open Graph) with `alt=""`, the source line (body-small,
 *   `open_in_new`), the title (title-small), the description (body-medium, two lines). The demo's
 *   data is static: nothing is fetched (e-store loads pictures through its own proxy).
 */
export const messageEmbedsVariants = tv({
  slots: {
    // 24dp high so it sits in a 24dp line of `body-large` text without opening the line up.
    chip: [
      "relative inline-flex h-6 max-w-full items-center gap-1 rounded-full align-bottom",
      "bg-surface text-label-large text-on-surface no-underline",
      "focus-ring cursor-pointer",
      // M3 state layer (8 / 10 / 12%).
      "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
      "before:bg-on-surface before:opacity-0 before:content-['']",
      "hover:before:opacity-hover focus-visible:before:opacity-focus active:before:opacity-pressed",
    ],
    chipText: "truncate",
    link: "underline underline-offset-2 wrap-anywhere focus-ring rounded-xs",
    // The column of link cards: each card fills it, at most 28rem (e-store's card width).
    cards: "flex w-full min-w-0 max-w-md flex-col gap-2 pt-1",
    cardSource:
      "flex items-center gap-1 text-body-small text-on-surface-variant",
    cardTitle: "text-title-small text-on-surface wrap-break-word",
    cardDescription: "line-clamp-2 text-body-medium text-on-surface-variant",
    cardContent: "flex flex-col gap-1 p-4",
  },
  variants: {
    kind: {
      // The avatar fills the chip's start (M3 input chip with an avatar: the avatar inset 4dp
      // in a 32dp chip; here 0 in 24dp).
      person: { chip: "pe-2" },
      place: { chip: "ps-1 pe-2" },
      // A person with no page: the same pill, not a link (no state layer, no pointer).
      static: { chip: "pe-2 cursor-default before:hidden" },
    },
  },
});

/** A `<@id>` / `<#id>` token as a chip: a link to the person's page or the place on the map. */
export const ChatRefChip = component$<{
  chipRef: ChatRef | undefined;
  labels?: Partial<ChatLabels>;
}>(({ chipRef: ref, labels }) => {
  const L = chatLabels(labels);
  const name = chatRefName(ref, L);
  if (ref?.kind === "place") {
    const s = messageEmbedsVariants({ kind: "place" });
    return (
      <UnstyledButton
        type="link"
        href={ref.href}
        data-chat-ref="place"
        class={s.chip()}
      >
        <Icon name="location_on" size="xs" />
        <span class={s.chipText()}>{name}</span>
      </UnstyledButton>
    );
  }
  // The avatar is decorative (`ChatAvatar` draws it so): the link's name is the person's name.
  const avatar = ref ? (
    <ChatAvatar person={{ ...ref.person, presence: null }} size="xs" />
  ) : (
    <Icon name="person" size="xs" />
  );
  if (ref?.href) {
    const s = messageEmbedsVariants({ kind: "person" });
    return (
      <UnstyledButton
        type="link"
        href={ref.href}
        data-chat-ref="person"
        class={s.chip()}
      >
        {avatar}
        <span class={s.chipText()}>{name}</span>
      </UnstyledButton>
    );
  }
  const s = messageEmbedsVariants({ kind: "static" });
  return (
    <span data-chat-ref="person" class={s.chip()}>
      {avatar}
      <span class={s.chipText()}>{name}</span>
    </span>
  );
});

/** The body as text, off-site links and chips. Text stays text nodes: never HTML. */
export function renderChatBody(
  message: Pick<ChatMessage, "body" | "refs">,
  labels?: Partial<ChatLabels>,
): JSXOutput {
  const L = chatLabels(labels);
  const s = messageEmbedsVariants();
  const tokens = chatBodyTokens(message.body);
  if (tokens.length === 1 && tokens[0].type === "text") return tokens[0].text;
  return (
    <>
      {tokens.map((t, i) => {
        if (t.type === "text") return t.text;
        if (t.type === "ref")
          return (
            <ChatRefChip
              key={`ref-${i}`}
              chipRef={chatRefFor(message.refs, t)}
              labels={labels}
            />
          );
        return (
          <UnstyledButton
            key={`url-${i}`}
            type="link"
            href={t.href}
            target="_blank"
            rel="external nofollow ugc"
            class={s.link()}
          >
            {t.text}
            <Icon
              name="open_in_new"
              size="xs"
              label={L.externalLink}
              class="ms-0.5 inline-block align-[-0.125em] rtl:-scale-x-100"
            />
          </UnstyledButton>
        );
      })}
    </>
  );
}

/** One link preview: ONE link (the whole card), opening the page in a new tab. */
export const ChatLinkCard = component$<{
  embed: ChatLinkEmbed;
  labels?: Partial<ChatLabels>;
}>(({ embed, labels }) => {
  const L = chatLabels(labels);
  const s = messageEmbedsVariants();
  // A page on the host's own site (`internal`, 2026-11-25: the Site updates channel's posts):
  // the router's link, same tab, no external mark or rel; the source line has no icon.
  if (embed.internal) {
    const path = chatSitePath(embed.url);
    if (!path) return null;
    return (
      <Card.Root
        as="link"
        href={path}
        variant="outlined"
        data-chat-embed="internal"
        aria-label={
          embed.siteName ? `${embed.title} (${embed.siteName})` : embed.title
        }
      >
        <div class={s.cardContent()}>
          {embed.siteName && <p class={s.cardSource()}>{embed.siteName}</p>}
          <p class={s.cardTitle()}>{embed.title}</p>
          {embed.description && (
            <p class={s.cardDescription()}>{embed.description}</p>
          )}
        </div>
      </Card.Root>
    );
  }
  const href = chatLinkHref(embed.url);
  if (!href) return null;
  const source = embed.siteName || chatEmbedHost(href);
  return (
    <Card.Root
      as="a"
      href={href}
      target="_blank"
      rel="external nofollow ugc"
      variant="outlined"
      data-chat-embed="link"
      // e-store's name: the title and the source, then where it opens.
      aria-label={`${embed.title} (${source}), ${L.externalLink}`}
      // No `class`: the card clips its own corners (`Card.Root` is `overflow-hidden`) and the
      // `cards` column sets the width (m3-hierarchy checklist 5: no class on library parts).
    >
      {embed.imageUrl && (
        // e-store's media box (lazy, no referrer), but 1.91:1, not e-store's 3:2: 3:2 is the
        // Farcaster embed ratio; a link card shows the page's Open Graph image, 1200 x 630
        // (1.91:1) by convention (our own og-image too), so 3:2 cropped its sides. `Card.Media`
        // without `src` is the documented slot for your own media (`card.md`): its `src` form
        // has no `loading` / `referrerPolicy` and no crop to a ratio.
        <Card.Media>
          <img
            src={embed.imageUrl}
            alt=""
            width={1200}
            height={630}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            class="block aspect-[1200/630] h-auto w-full object-cover"
          />
        </Card.Media>
      )}
      <div class={s.cardContent()}>
        <p class={s.cardSource()}>
          <Icon name="open_in_new" size="xs" class="rtl:-scale-x-100" />
          {source}
        </p>
        <p class={s.cardTitle()}>{embed.title}</p>
        {embed.description && (
          <p class={s.cardDescription()}>{embed.description}</p>
        )}
      </div>
    </Card.Root>
  );
});

/** A message's link cards, under its bubble. */
export const ChatMessageEmbeds = component$<{
  embeds: readonly ChatLinkEmbed[];
  labels?: Partial<ChatLabels>;
}>(({ embeds, labels }) => {
  const s = messageEmbedsVariants();
  return (
    <div data-chat-embeds="" class={s.cards()}>
      {embeds.map((e, i) => (
        <ChatLinkCard key={`${i}:${e.url}`} embed={e} labels={labels} />
      ))}
    </div>
  );
});
