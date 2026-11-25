import { component$ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  z,
  zod$,
  type DocumentHead,
} from "@qwik.dev/router";
import { Button, Layout, List } from "@seanperez/ui";
import {
  deleteAccount,
  listAccounts,
  purgeExpired,
} from "@seanperez/data/account/account.server";
import { requireAdmin } from "@seanperez/data/feed/access.server";
import { formatDate } from "@seanperez/data/feed/format";

/**
 * Contact accounts (2026-11-25, plan 3.3): every account a first message made, verified or not,
 * with its message count and last day seen; delete one (for a request by email). Under
 * the admin app, so its root `layout.tsx` gates it (Cloudflare Access, fails closed). Opening it
 * also runs the 7-day purge (no cron), so the list never shows an account past its time.
 */
export const useAccounts = routeLoader$(async (ev) => {
  await requireAdmin(ev);
  const db = ev.platform.env.DB;
  try {
    await purgeExpired(db);
    return { ok: true as const, accounts: await listAccounts(db) };
  } catch (error) {
    console.error("admin: accounts list failed", error);
    return { ok: false as const, accounts: [] };
  }
});

export const useDeleteAccount = routeAction$(
  async (data, ev) => {
    await requireAdmin(ev);
    await deleteAccount(ev.platform.env.DB, data.id);
    return { deleted: true };
  },
  {
    invalidate: [useAccounts],
    validation: [zod$({ id: z.string().uuid() })],
  },
);

export default component$(() => {
  const list = useAccounts();
  const remove = useDeleteAccount();
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title="Accounts" />
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid content-start gap-2">
        <p class="text-body-medium text-on-surface-variant">
          Made by a first message in Contact me. Unverified accounts are deleted
          after 7 days. Deleting an account keeps its verified messages in the
          inbox.
        </p>
        {!list.value.ok ? (
          <p role="alert" class="text-body-large text-error">
            The accounts could not be read. Is migration 0004 applied?
          </p>
        ) : list.value.accounts.length === 0 ? (
          <p class="text-body-large text-on-surface-variant">
            No accounts yet.
          </p>
        ) : (
          <List.Root aria-label="Accounts">
            {list.value.accounts.map((a) => (
              <List.Item
                key={a.id}
                headline={a.name}
                // Text, never HTML: Qwik escapes it. The address is shown only here (Access).
                supportingText={`${a.email} · ${a.verified_at ? "Verified" : "Unverified"} · ${a.messages} message${a.messages === 1 ? "" : "s"}`}
                trailingSupportingText={
                  a.last_seen_at
                    ? `Seen ${a.last_seen_at}`
                    : formatDate(a.created_at)
                }
                // A Button, not a <Form>: the router's Form is a plain function component and
                // cannot be serialized inside a JSX prop (Qwik Q34, crashed `pnpm dev`).
                end={
                  <Button
                    look="text"
                    label="Delete"
                    aria-label={`Delete ${a.name}'s account`}
                    isLoading={remove.isRunning}
                    onClick$={() => remove.submit({ id: a.id })}
                  />
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
  title: "Accounts · Admin",
  meta: [{ name: "robots", content: "noindex", key: "robots" }],
};
