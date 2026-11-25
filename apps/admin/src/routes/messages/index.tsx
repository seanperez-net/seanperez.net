import { component$ } from "@qwik.dev/core";
import {
  routeLoader$,
  useLocation,
  useNavigate,
  type DocumentHead,
} from "@qwik.dev/router";
import { Badge, Chip, ChipGroup, Icon, Layout, List } from "@seanperez/ui";
import { formatDate } from "@seanperez/server/feed/format";
import {
  listMessages,
  type MessageFilter,
  type MessageSource,
} from "@seanperez/db/messages/messages.server";
import { dmarcPassed } from "@seanperez/server/mail/inbound.server";

/** `?show=verified` / `?show=unverified`; anything else is all. */
const filterOf = (url: URL): MessageFilter => {
  const show = url.searchParams.get("show");
  return show === "verified" || show === "unverified" ? show : "all";
};

/** `?source=form` / `?source=email` (migration 0006: mail to sean@); anything else is both. */
const sourceOf = (url: URL): MessageSource | "all" => {
  const source = url.searchParams.get("source");
  return source === "form" || source === "email" ? source : "all";
};

/** The inbox URL with one filter changed and the other kept. */
const inboxHref = (url: URL, key: "show" | "source", value: string | null) => {
  const next = new URLSearchParams();
  for (const k of ["show", "source"] as const) {
    const v = k === key ? value : url.searchParams.get(k);
    if (v) next.set(k, v);
  }
  const query = next.toString();
  return `/messages/${query ? `?${query}` : ""}`;
};

/**
 * The contact form's inbox, newest first. The app's root `layout.tsx` `onRequest` gates the page
 * and its loader JSON (Cloudflare Access, fails closed). The static `messages` segment wins over
 * `[id]` (router `findChild`: static child first).
 */
export const useMessages = routeLoader$(
  async ({ platform, url }) => {
    try {
      return {
        ok: true as const,
        messages: (
          await listMessages(platform.env.DB, filterOf(url), sourceOf(url))
        ).map((m) => ({
          ...m,
          // A mail without dmarc=pass from mx.cloudflare.net: its From may be forged.
          flagged: m.source === "email" && !dmarcPassed(m.auth),
        })),
      };
    } catch (error) {
      // Most likely migration 0003 is not applied to this database yet.
      console.error("admin: messages list failed", error);
      return { ok: false as const, messages: [] };
    }
  },
  { search: ["show", "source"] },
);

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
                nav(inboxHref(loc.url, "show", on ? show : null))
              }
            />
          ))}
        </ChipGroup>
        {/* Where it came from (2026-11-25): the Contact me form, or a mail to sean@ that Email
          Routing handed to the Worker (`mail/inbound.server.ts`; the Gmail copy is forwarded
          first). One at a time, beside the Verified / Unverified filter. */}
        <ChipGroup label="Source">
          {(["form", "email"] as const).map((source) => (
            <Chip
              key={source}
              type="filter"
              label={source === "form" ? "Form" : "Email"}
              selected={sourceOf(loc.url) === source}
              onSelectedChange$={(on) =>
                nav(inboxHref(loc.url, "source", on ? source : null))
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
                href={`/messages/${message.id}/`}
                // A plain link (full page load): the router's <Link> prefetches a route's
                // loaders on hover / focus (`prefetchData` "intent"), and opening a message
                // marks it read, so a hover must not run it (second agent's review).
                reload
                headline={message.name}
                // Text, never HTML: Qwik escapes it. An email shows its subject first.
                supportingText={
                  message.subject
                    ? `${message.subject} · ${message.preview}`
                    : message.preview
                }
                supportingLines="one"
                trailingSupportingText={[
                  message.source === "email" ? "Email" : "",
                  message.flagged ? "Not authenticated" : "",
                  message.confirmed_at ? "" : "Unverified",
                  formatDate(message.created_at),
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
