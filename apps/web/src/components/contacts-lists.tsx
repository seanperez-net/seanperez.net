import {
  $,
  component$,
  useComputed$,
  useContext,
  useSignal,
} from "@qwik.dev/core";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  List,
} from "@seanperez/ui";
import type { IconName } from "@seanperez/ui";
import { forgetCounts } from "../contacts/frequency";
import { commit, plural, useContactsSnackbar } from "../contacts/local-actions";
import {
  TRASH_DAYS,
  findDuplicates,
  mergeContacts,
  purgeContacts,
  recoverContacts,
  restoreContacts,
  restoreSite,
  trashDaysLeft,
  trashedContacts,
  type LocalContact,
} from "../contacts/local-book";
import {
  localBookId,
  localContactHref,
  localRowKey,
} from "../contacts/local-context";
import { ConfirmDialog } from "./contacts-dialogs";

/**
 * The Contacts list pane's two lists that are not plain contact rows (2026-11-24), in the
 * layout's ONE list body (`routes/contacts/layout.tsx`):
 *
 * - `ContactsTrash`: PORTED from e-store's `ContactsTrash` (`packages/contacts/src/components/
 *   contacts-trash.tsx`): a row per contact with the days left, Recover, and Delete forever
 *   (confirmed). Differs: no own heading or "Empty trash" (the layout's pane header has the
 *   title and "Empty Trash now", Google's words, as e-store's `showHeader={false}` host does),
 *   our Avatar, the name links to the contact's page;
 * - `ContactsMerge`: Google's Merge & fix (FEATURES 6.1-6.3): one card per group of contacts that
 *   look like one person (the same name, email or phone; `findDuplicates`), Merge on each, "Merge
 *   all" in the layout's header (`mergeAll`). NEW (e-store has no merge). Merged contacts become one,
 *   with Undo.
 */

/** A site contact as the Trash shows it (from the layout's loader). */
export interface TrashSiteRow {
  id: string;
  name: string;
  seed: string;
  icon?: IconName;
}

export const ContactsTrash = component$<{ site: TrashSiteRow[] }>(
  ({ site }) => {
    const state = useContext(localBookId);
    const { showSnackbar$ } = useContactsSnackbar();
    const rows = useComputed$(() => trashedContacts(state.book.value));
    // Site contacts deleted forever from the visitor's contacts (owner, 2026-11-24): always a way back.
    const hidden = useComputed$(() =>
      site.filter((r) => state.book.value.hiddenSite.includes(r.id)),
    );
    const restoreSite$ = $(async (id: string, name: string) => {
      await commit(state, (book) => ({ book: restoreSite(book, [id]) }));
      await showSnackbar$({ message: `${name} is back in your contacts` });
    });
    const purgeOpen = useSignal(false);
    const siteOf = (id?: string) =>
      id ? site.find((x) => x.id === id) : undefined;
    const purging = useSignal<{
      id: string;
      name: string;
      site: boolean;
    } | null>(null);

    const recover$ = $(async (id: string, name: string) => {
      await commit(state, (book, now) => ({
        book: recoverContacts(book, [id], now),
      }));
      await showSnackbar$({ message: `${name} recovered` });
    });
    const purge$ = $(async () => {
      const p = purging.value;
      if (!p) return;
      await commit(state, (book, now) => ({
        book: purgeContacts(book, [p.id], now),
      }));
      forgetCounts([localRowKey(p.id)]);
      await showSnackbar$({ message: `${p.name} deleted forever` });
    });

    return (
      <>
        <p class="text-body-medium text-on-surface-variant">
          {`Contacts in the Trash are deleted for good after ${TRASH_DAYS} days.`}
        </p>
        {hidden.value.length > 0 && (
          <List.Root padding="none" aria-label="Site contacts you deleted">
            {hidden.value.map((r) => (
              <List.Item
                key={r.id}
                data-contact-id={r.id}
                start={
                  <Avatar
                    name={r.icon ? undefined : r.name}
                    seed={r.seed}
                    fallbackIcon={r.icon}
                    size="md"
                    decorative
                  />
                }
                headline={r.name}
                supportingText="Deleted. The site keeps a copy."
                end={
                  <IconButton
                    icon="undo"
                    label={`Restore ${r.name}`}
                    onClick$={() => restoreSite$(r.id, r.name)}
                  />
                }
              />
            ))}
          </List.Root>
        )}
        {rows.value.length === 0 && hidden.value.length === 0 ? (
          <EmptyState
            size="sm"
            icon="delete"
            headline="No contacts in Trash"
            description={`Contacts you delete stay here for ${TRASH_DAYS} days.`}
          />
        ) : (
          <List.Root padding="none" aria-label="Contacts in Trash">
            {rows.value.map((c) => {
              const left = trashDaysLeft(c, Date.now());
              return (
                <List.Item
                  key={c.id}
                  data-contact-id={localRowKey(c.id)}
                  start={
                    <Avatar
                      name={siteOf(c.siteId)?.icon ? undefined : c.name}
                      seed={siteOf(c.siteId)?.seed ?? c.id}
                      fallbackIcon={siteOf(c.siteId)?.icon}
                      size="md"
                      decorative
                    />
                  }
                  headline={c.name}
                  supportingText={
                    left < 1
                      ? "Deleted forever today"
                      : left === 1
                        ? "1 day left"
                        : `${left} days left`
                  }
                  end={
                    <div class="flex items-center">
                      {/* Icon buttons, not a text "Recover" (side-panes-avoid-overflow, 2026-11-24: at 1000px
                          with the drawer and a companion open, the text button left the name one letter). */}
                      <IconButton
                        icon="undo"
                        label={`Recover ${c.name}`}
                        onClick$={() => recover$(c.id, c.name)}
                      />
                      <IconButton
                        icon="delete"
                        label={`Delete ${c.name} forever`}
                        aria-haspopup="dialog"
                        onClick$={() => {
                          purging.value = {
                            id: c.id,
                            name: c.name,
                            site: !!c.siteId,
                          };
                          purgeOpen.value = true;
                        }}
                      />
                    </div>
                  }
                />
              );
            })}
          </List.Root>
        )}
        <ConfirmDialog
          open={purgeOpen}
          title="Delete forever?"
          description={
            purging.value?.site
              ? `${purging.value.name} will be removed from your contacts. The site keeps its own copy: Restore brings it back.`
              : `${purging.value?.name ?? "This contact"} will be deleted forever. This cannot be undone.`
          }
          confirmLabel="Delete forever"
          onConfirm$={purge$}
        />
      </>
    );
  },
);

/**
 * Merges each group (one change for all), with Undo; `groups` are lists of ids. A plain function,
 * not a `$`-named QRL: the optimizer reads an imported `name$(...)` call as a QRL marker.
 */
export async function mergeGroups(
  state: Parameters<typeof commit>[0],
  groups: string[][],
  showSnackbar$: ReturnType<typeof useContactsSnackbar>["showSnackbar$"],
) {
  {
    const change = await commit(state, (book, now) => {
      let next = book;
      const before: LocalContact[] = [];
      let merged = 0;
      for (const ids of groups) {
        const r = mergeContacts(next, ids, now);
        if (!r.kept) continue;
        next = r.book;
        before.push(...r.before);
        merged++;
      }
      return { book: next, result: { before, merged } };
    });
    const { before, merged } = change.result;
    if (!merged) return;
    await showSnackbar$({
      message:
        merged === 1
          ? `Merged ${before.length} contacts`
          : `Merged ${plural(merged, "group", "groups")}`,
      action: "Undo",
      showClose: true,
      onAction$: $(async () => {
        await commit(state, (book, now) => ({
          book: restoreContacts(book, before, now),
        }));
      }),
    });
  }
}

export const ContactsMerge = component$(() => {
  const state = useContext(localBookId);
  const { showSnackbar$ } = useContactsSnackbar();
  const groups = useComputed$(() => findDuplicates(state.book.value));
  return groups.value.length === 0 ? (
    <EmptyState
      size="sm"
      icon="auto_fix_high"
      headline="No duplicates"
      description="Contacts with the same name, email or phone show up here to merge."
    />
  ) : (
    <div class="grid gap-3">
      <p class="text-body-medium text-on-surface-variant">
        {`${plural(groups.value.length, "group", "groups")} of contacts ${groups.value.length === 1 ? "looks" : "look"} like the same person. Merging keeps every phone, email and label in one contact.`}
      </p>
      {groups.value.map((group) => {
        const ids = group.map((c) => c.id);
        return (
          <Card.Root key={ids.join(",")} variant="outlined">
            <Card.Content variant="full">
              <List.Root
                padding="none"
                aria-label={`Possible duplicates of ${group[0].name}`}
              >
                {group.map((c) => (
                  <List.Item
                    key={c.id}
                    href={localContactHref(c.id)}
                    start={
                      <Avatar name={c.name} seed={c.id} size="md" decorative />
                    }
                    headline={c.name}
                    supportingText={
                      [c.emails[0]?.value, c.phones[0]?.value, c.organization]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                  />
                ))}
              </List.Root>
            </Card.Content>
            <Card.Footer>
              <Button
                look="tonal"
                label="Merge"
                aria-label={`Merge ${group.length} contacts named like ${group[0].name}`}
                onClick$={() => mergeGroups(state, [ids], showSnackbar$)}
              />
            </Card.Footer>
          </Card.Root>
        );
      })}
    </div>
  );
});
