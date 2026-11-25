import { component$ } from "@qwik.dev/core";
import {
  routeLoader$,
  useLocation,
  useNavigate,
  type DocumentHead,
} from "@qwik.dev/router";
import { Badge, Chip, ChipGroup, Icon, Layout, List } from "@seanperez/ui";
import { formatDate } from "../../../feed/format";
import {
  listMessages,
  type MessageFilter,
} from "../../../messages/messages.server";

/** `?show=verified` / `?show=unverified`; anything else is all. */
const filterOf = (url: URL): MessageFilter => {
  const show = url.searchParams.get("show");
  return show === "verified" || show === "unverified" ? show : "all";
};

/**
 * The contact form's inbox, newest first. Under `routes/admin/`, so `admin/layout.tsx`'s
 * `onRequest` gates the page and its loader JSON (Cloudflare Access, fails closed). The static
 * `messages` segment wins over `admin/[id]` (router `findChild`: static child first).
 */
export const useMessages = routeLoader$(async ({ platform, url }) => {
  try {
    return {
      ok: true as const,
      messages: await listMessages(platform.env.DB, filterOf(url)),
    };
  } catch (error) {
    // Most likely migration 0003 is not applied to this database yet.
    console.error("admin: messages list failed", error);
    return { ok: false as const, messages: [] };
  }
}, { search: ["show"] });

export default component$(() => {
  const list = useMessages();
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <Layout.Pane role="primary">
      {/* No "All posts" button: Posts is the admin rail's first destination. */}
      <Layout.PaneHeader title="Messages" />
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid content-start gap-2">
        {/* Contact accounts (2026-11-25): a message is "Unverified" until its sender confirms the
          address (link or code). Filter chips (M3: filter chips narrow content); one at a time. */}
        <ChipGroup label="Show">
          {(["verified", "unverified"] as const).map((show) => (
            <Chip
              key={show}
              type="filter"
              label={show === "verified" ? "Verified" : "Unverified"}
              selected={filterOf(loc.url) === show}
              onSelectedChange$={(on) =>
                nav(on ? `/admin/messages/?show=${show}` : "/admin/messages/")
              }
            />
          ))}
        </ChipGroup>
        {!list.value.ok ? (
          <p role="alert" class="text-body-large text-error">
            The messages could not be read. Is migration 0003 applied?
          </p>
        ) : list.value.messages.length === 0 ? (
          <p class="text-body-large text-on-surface-variant">
            No messages yet.
          </p>
        ) : (
          <List.Root aria-label="Messages">
            {list.value.messages.map((message) => (
              <List.Item
                key={message.id}
                href={`/admin/messages/${message.id}/`}
                // A plain link (full page load): the router's <Link> prefetches a route's
                // loaders on hover / focus (`prefetchData` "intent"), and opening a message
                // marks it read, so a hover must not run it (second agent's review).
                reload
                headline={message.name}
                // Text, never HTML: Qwik escapes it.
                supportingText={message.preview}
                supportingLines="one"
                trailingSupportingText={
                  message.confirmed_at
                    ? formatDate(message.created_at)
                    : `Unverified · ${formatDate(message.created_at)}`
                }
                start={
                  message.read_at ? (
                    <Icon name="mail" />
                  ) : (
                    <Badge.Root>
                      <Icon name="mail" />
                      <Badge.Badge label="Unread" />
                    </Badge.Root>
                  )
                }
              />
            ))}
          </List.Root>
        )}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = {
  title: "Messages · Admin",
  meta: [{ name: "robots", content: "noindex", key: "robots" }],
};
