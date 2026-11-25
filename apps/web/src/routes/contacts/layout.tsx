import {
  $,
  Slot,
  component$,
  isBrowser,
  useComputed$,
  useContext,
  useContextProvider,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";
import { routeLoader$, useLocation, useNavigate } from "@qwik.dev/router";
import {
  Avatar,
  Button,
  Checkbox,
  EmptyState,
  Icon,
  IconButton,
  Layout,
  List,
  LoadingIndicator,
  Menu,
} from "@seanperez/ui";
import { AppActionFab, appActionFor } from "../../components/app-action";
import { ContactsPlaceholder } from "../../components/contacts-placeholder";
import {
  ConfirmDialog,
  LabelNameDialog,
  ManageLabelsDialog,
} from "../../components/contacts-dialogs";
import {
  ContactRowActions,
  ContactsMerge,
  ContactsTrash,
  mergeGroups,
} from "../../components/contacts-lists";
import {
  MAX_FREQUENT,
  bumpCount,
  readCounts,
  score,
  writeLabelCache,
} from "../../contacts/frequency";
import {
  assignableLabels,
  baseRecord,
  commit,
  targetsOf,
  exportContacts,
  plural,
  useContactsSnackbar,
} from "../../contacts/local-actions";
import {
  emptyBook,
  emptyTrash,
  findDuplicates,
  isLocalLabelId,
  labelNameTaken,
  ownContacts,
  siteOverride,
  recoverContacts,
  renameLabel,
  deleteLabel,
  setLabel,
  trashContacts,
  trashedContacts,
  type LocalBook,
  type LocalContact,
  type SiteBase,
} from "../../contacts/local-book";
import { loadBook, onBookChange } from "../../contacts/local-book-store";
import { localBookId, localLabelsId } from "../../contacts/local-context";
import {
  localRow,
  searchRows,
  siteRow,
  type BookRow,
} from "../../contacts/search-local";
import { findAccount } from "../../content/accounts";
import {
  CONTACTS,
  CONTACTS_LISTS,
  CONTACT_HEADING_ID,
  CONTACT_LABELS,
  DIALOG_SLUGS,
  IMPORTED_LABEL_ID,
  listForPath,
} from "../../content/contacts";
import { getProfile } from "@seanperez/data/profile/profile.server";
import { cleanQuery } from "../../search/types";

/**
 * The SITE's contact book, for the list and the detail routes below (a layout's loader is read by
 * its child routes too). Each row is an ACCOUNT (`content/accounts.ts`, 2026-11-24): the owner,
 * whose record is the owner's server profile (`getProfile`, as Contact me's links; `/profile/` is
 * the VISITOR's own since 2026-11-25), falling back per
 * field to `content/resume.ts`), and the assistant, an app (its account only, no profile). These
 * are READ-ONLY here (second agent and I, 2026-11-24: Google makes profile-sourced details
 * read-only, FEATURES 3.3). The visitor's OWN contacts are the local book, below.
 */
export const useContactBook = routeLoader$(async ({ platform }) => {
  const profile = await getProfile(platform.env.DB);
  return CONTACTS.map((entry) => {
    if (entry.kind === "person") {
      return {
        ...entry,
        name: profile.name,
        headline: profile.headline,
        location: profile.location,
        icon: undefined,
        profile,
        account: null,
      };
    }
    const account = findAccount(entry.accountId)!;
    return {
      ...entry,
      name: account.name,
      headline: account.headline,
      location: "",
      icon: account.icon,
      profile: null,
      account,
    };
  });
});

/**
 * The open contact's row key, or null on a list route: the site contact's id
 * (`/contacts/<id>/`), or `local/<id>` for one of the visitor's (`/contacts/local/<id>/`).
 */
/**
 * A route that is only a dialog over the list: Create contact, Create label, Import. Its page is
 * rendered OUTSIDE both panes (fix 2026-11-24, found by the WebKit run): it is a list view, so in
 * single-pane the detail pane is `display: none`, and a modal `<dialog>` inside a `display: none`
 * box opens (the page goes inert) but is neither painted nor in the accessibility tree (CSS
 * Display: `display: none` removes the subtree; the top layer does not lift it out). Visitors on
 * a phone tapped "Create contact" and every later tap did nothing.
 */
const DIALOG_ROUTE = /^\/contacts\/(?:new|import|label\/new)\/?$/;

const detailId = (pathname: string) =>
  listForPath(pathname)
    ? null
    : (/^\/contacts\/((?:local\/)?[^/]+)\/?$/.exec(pathname)?.[1] ?? null);

/** Rows shown before "Show more" (a book may hold 3,000; second agent, 2026-11-24). */
const PAGE_ROWS = 200;

/** The list pane's heading id (its section and its list are named by it). */
const LIST_TITLE_ID = "contacts-title";

/** Whether a list holds a row with these labels (all contacts, a dialog route, a label). */
function listHolds(slug: string, labels: string[]): boolean {
  if (slug === "" || (DIALOG_SLUGS as string[]).includes(slug)) return true;
  return slug.startsWith("label/") && labels.includes(slug.slice(6));
}

/** The visitor's own contacts a list holds (site contacts: `siteRows`). */
function localContactsIn(slug: string, book: LocalBook): LocalContact[] {
  const live = ownContacts(book);
  if (slug === "" || (DIALOG_SLUGS as string[]).includes(slug)) return live;
  if (slug === `label/${IMPORTED_LABEL_ID}`)
    return live.filter((c) => c.source === "import");
  if (slug.startsWith("label/")) {
    const id = slug.slice("label/".length);
    return live.filter((c) => c.labels.includes(id));
  }
  return [];
}

/**
 * The Contacts app: M3's LIST-DETAIL canonical layout as TWO PANES (`Layout.ListDetail`,
 * 2026-11-24). m3.material.io/foundations/layout/canonical-layouts/list-detail (read 2026-11-24):
 * "A list-detail layout uses two panes"; /breakpoints/expanded: a 360dp fixed pane, a 24dp spacer.
 *
 * The drawer (`contactsDrawerGroups`, built by `routes/layout.tsx`) picks the LIST: Contacts,
 * Frequent, Other contacts, Merge & fix, Trash, a label (Google Contacts' navigation, measured
 * 2026-11-24). Each is a route whose page fills the detail pane with the placeholder;
 * `/contacts/<id>/` and `/contacts/local/<id>/` fill it with a contact. Import, Create contact and
 * Create label are the full list with their dialog open (`DIALOG_SLUGS`).
 *
 * LOCAL-FIRST (owner, 2026-11-24: "local changes should get saved locally ... we are cutting
 * [the sync] out of this website"): the visitor's own contacts and labels are a book in THEIR
 * browser (`contacts/local-book*.ts`), read here after resume and provided to the child routes
 * (`localBookId`). Every write is local; nothing is posted. The server renders only the site's
 * contacts, so a list shows a loading indicator until the browser's copy is read.
 *
 * Selection (Google's, FEATURES 2.1-2.6): "Select" turns the rows into checkboxes (a mode, not
 * hover-only checkboxes: keyboard and touch reach it the same way); the header then says "N
 * selected" with Manage labels, Delete and Export for the selection. The site's contacts too: a
 * change to one is the visitor's local override of it (owner, 2026-11-24).
 *
 * Selection of the OPEN contact: only the contact open in the detail pane is `selected` (M3: "Use
 * a selection state in two-pane layouts only").
 */
export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const book = useContactBook();
  const { showSnackbar$ } = useContactsSnackbar();
  // The app bar's search, scoped to Contacts (`site-search.tsx`), lands here with `?q=` (second
  // agent, 2026-11-24; Google's "Search results" in the list sheet). The list pane's own search
  // field is gone (owner, 2026-11-24: "we have the search bar on the top").
  const query = useComputed$(() =>
    cleanQuery(loc.url.searchParams.get("q") ?? ""),
  );
  const shown = useSignal(PAGE_ROWS);

  // The visitor's LOCAL book: only in this browser, so the server renders without it.
  const local = useSignal<LocalBook>(emptyBook());
  const ready = useSignal(false);
  const counts = useSignal<Record<string, { o: number; c: number; t: number }>>(
    {},
  );
  const state = { book: local, ready, counts };
  useContextProvider(localBookId, state);
  // The root layout's drawer shows the visitor's labels (`routes/layout.tsx`).
  const drawerLabels = useContext(localLabelsId);

  // Browser only, once the page is ready (the layout ran on the server, so a `useTask$` would
  // not run again here); re-read when another tab changes the book. A visible task because the
  // channel needs `cleanup`.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ cleanup }) => {
      const read = async () => {
        local.value = await loadBook();
        counts.value = readCounts();
        ready.value = true;
      };
      // A page load straight onto a contact is an open too (the path task below sees only
      // client navigations).
      const opened = detailId(location.pathname);
      if (opened) bumpCount(opened, "open");
      void read();
      cleanup(onBookChange(() => void read()));
    },
    { strategy: "document-ready" },
  );
  // The drawer's labels follow the book (and a small cache for the other routes' drawer).
  useTask$(({ track }) => {
    const labels = track(() => local.value.labels).map(({ id, name }) => ({
      id,
      name,
    }));
    if (!isBrowser || !track(() => ready.value)) return;
    drawerLabels.value = labels;
    writeLabelCache(labels);
  });

  const view = useComputed$(() =>
    detailId(loc.url.pathname) ? "detail" : "list",
  );
  const selectedId = useComputed$(() => detailId(loc.url.pathname) ?? "");
  const dialogRoute = useComputed$(() => DIALOG_ROUTE.test(loc.url.pathname));
  // The list the pane shows: the route's; the full book beside a contact and behind a dialog.
  const list = useComputed$(() => {
    const own = listForPath(loc.url.pathname);
    if (!own || DIALOG_SLUGS.includes(own.slug)) return CONTACTS_LISTS[0];
    // A visitor's label: its name from the book.
    if (own.slug.startsWith("label/") && isLocalLabelId(own.slug.slice(6))) {
      const label = local.value.labels.find(
        (l) => `label/${l.id}` === own.slug,
      );
      return {
        ...own,
        label: label?.name ?? (ready.value ? "Label not found" : "Label"),
      };
    }
    return own;
  });
  const slug = useComputed$(() => list.value.slug);
  /** The open list is one of the visitor's labels that exists. */
  const ownLabel = useComputed$(
    () =>
      local.value.labels.find((l) => `label/${l.id}` === slug.value) ?? null,
  );
  // What a site contact's override starts from (`targetsOf`).
  const siteBases = useComputed$<SiteBase[]>(() =>
    book.value.map((row) => ({
      siteId: row.id,
      name: row.name,
      title: row.headline,
      labels: row.labels,
    })),
  );
  // The site's contacts with the visitor's LOCAL OVERRIDES applied (owner, 2026-11-24): an
  // edited one shows the visitor's name and work line, one in the Trash or deleted forever is
  // not listed. The site's data itself never changes.
  // Since 2026-11-25 (`visitor-is-guest-you`) the owner's row is HIS: his real profile and his
  // account's static presence, never the visitor's profile edit or live status (the visitor is a
  // guest, not him). Only the visitor's local edit of this contact applies, as to any contact.
  const siteRows = useComputed$<BookRow[]>(() =>
    book.value.flatMap(
      (row) =>
        siteRow(
          {
            id: row.id,
            name: row.name,
            line: row.headline || row.location || "",
            seed: row.seed,
            presence: row.presence,
            icon: row.icon,
            labels: row.labels,
          },
          local.value,
        ) ?? [],
    ),
  );
  const inList = useComputed$<BookRow[]>(() => {
    const s = slug.value;
    if (s === "frequent") {
      // Frequent (Google's): the most opened / contacted, by this browser's counts.
      const all = [
        ...siteRows.value,
        ...ownContacts(local.value).map(localRow),
      ];
      return all
        .filter((r) => score(counts.value[r.key]) > 0)
        .sort((a, b) => score(counts.value[b.key]) - score(counts.value[a.key]))
        .slice(0, MAX_FREQUENT);
    }
    const site = siteRows.value.filter((r) => listHolds(s, r.labels));
    const own = localContactsIn(s, local.value).map(localRow);
    return [...site, ...own].sort((a, b) => a.name.localeCompare(b.name));
  });
  /** A label's page: its id (search gives its contacts priority). */
  const searchLabel = useComputed$(() =>
    slug.value.startsWith("label/") ? slug.value.slice(6) : null,
  );
  /** Searching: a query on a list of contacts (not Trash, Merge & fix, Other contacts). */
  const searching = useComputed$(
    () => !!query.value && !["trash", "merge", "other"].includes(slug.value),
  );
  // The search (`search-local.ts`, shared with the app bar): the WHOLE book, the open label's
  // contacts first (owner, 2026-11-24: "it should prioritize that label").
  const found = useComputed$(() =>
    searchRows(
      [...siteRows.value, ...ownContacts(local.value).map(localRow)].sort(
        (a, b) => a.name.localeCompare(b.name),
      ),
      query.value,
      searchLabel.value,
    ),
  );
  const rows = useComputed$(() =>
    searching.value ? found.value.rows : inList.value,
  );
  const trashCount = useComputed$(() => trashedContacts(local.value).length);
  const duplicateGroups = useComputed$(() =>
    findDuplicates(local.value).map((g) => g.map((c) => c.id)),
  );

  // SELECTION (Google's checkboxes; e-store `contacts-selection.ts`): row keys, the site's
  // contacts too (a change to one makes its local override).
  const selecting = useSignal(false);
  const picked = useSignal<string[]>([]);
  const selectable = useComputed$(() => rows.value.map((r) => r.key));
  const pickedLive = useComputed$(() =>
    picked.value.filter((id) => selectable.value.includes(id)),
  );
  // A selection belongs to the list it was made in.
  useTask$(({ track }) => {
    track(() => slug.value);
    selecting.value = false;
    picked.value = [];
    shown.value = PAGE_ROWS;
  });

  // Lists of contacts carry a count ("Contacts (2)", "Trash (0)", Google's); Merge & fix holds
  // suggestions, not contacts.
  const title = useComputed$(() =>
    selecting.value
      ? `${pickedLive.value.length} selected`
      : searching.value
        ? `Search results (${rows.value.length})`
        : slug.value === "merge"
          ? list.value.label
          : slug.value === "trash"
            ? `${list.value.label} (${trashCount.value})`
            : `${list.value.label} (${inList.value.length})`,
  );
  const action = useComputed$(() => appActionFor(loc.url.pathname));
  /** Lists with rows to search, select and export (not Trash, Merge, Other). */
  const plainList = useComputed$(
    () => !["trash", "merge", "other"].includes(slug.value),
  );

  // Dialogs of the list pane.
  const emptyOpen = useSignal(false);
  const renameOpen = useSignal(false);
  const deleteLabelOpen = useSignal(false);
  const bulkLabelsOpen = useSignal(false);
  const labelChoices = useComputed$(() => assignableLabels(local.value));
  const bulkCounts = useComputed$(() => {
    const out: Record<string, number> = {};
    for (const r of rows.value)
      if (pickedLive.value.includes(r.key))
        for (const l of r.labels) out[l] = (out[l] ?? 0) + 1;
    return out;
  });

  const bulkDelete$ = $(async () => {
    const keys = pickedLive.value;
    if (!keys.length) return;
    const bases = siteBases.value;
    const change = await commit(state, (b, now) => {
      const t = targetsOf(b, keys, bases, now);
      return { book: trashContacts(t.book, t.ids, now), result: t.ids };
    });
    const ids = change.result;
    selecting.value = false;
    picked.value = [];
    await showSnackbar$({
      message: `${plural(ids.length, "contact", "contacts")} moved to Trash`,
      action: "Undo",
      showClose: true,
      onAction$: $(async () => {
        await commit(state, (b, now) => ({
          book: recoverContacts(b, ids, now),
        }));
      }),
    });
  });
  const bulkLabels$ = $(async (on: string[], off: string[]) => {
    const keys = pickedLive.value;
    if (!keys.length || (!on.length && !off.length)) return;
    const bases = siteBases.value;
    await commit(state, (b, now) => {
      const t = targetsOf(b, keys, bases, now);
      const ids = t.ids;
      let next = t.book;
      for (const l of on) next = setLabel(next, l, ids, true, now);
      for (const l of off) next = setLabel(next, l, ids, false, now);
      return { book: next };
    });
    await showSnackbar$({ message: "Labels updated" });
  });
  const exportList$ = $((format: "vcard" | "csv") => {
    const keys = selecting.value
      ? pickedLive.value
      : rows.value.map((r) => r.key);
    const contacts = keys
      .map((k) =>
        k.startsWith("local/")
          ? local.value.contacts.find((c) => c.id === k.slice(6))
          : (siteOverride(local.value, k) ??
            siteBases.value.map(baseRecord).find((c) => c.siteId === k)),
      )
      .filter((c): c is LocalContact => !!c);
    if (contacts.length) exportContacts(contacts, local.value, format);
  });
  const emptyTrash$ = $(async () => {
    const n = trashCount.value;
    await commit(state, (b, now) => ({ book: emptyTrash(b, now) }));
    await showSnackbar$({
      message: `${plural(n, "contact", "contacts")} deleted forever`,
    });
  });
  const rename$ = $(async (name: string) => {
    const label = ownLabel.value;
    if (!label) return "This label is gone";
    const taken = [...CONTACT_LABELS, ...local.value.labels].map((l) => l.name);
    if (labelNameTaken(name, taken, label.name))
      return "A label with this name already exists";
    await commit(state, (b, now) => ({
      book: renameLabel(b, label.id, name, now),
    }));
  });
  const deleteLabel$ = $(async () => {
    const label = ownLabel.value;
    if (!label) return;
    await commit(state, (b, now) => ({ book: deleteLabel(b, label.id, now) }));
    await nav("/contacts/");
    await showSnackbar$({
      message: `Label “${label.name}” deleted. Its contacts are kept.`,
    });
  });

  // Frequent counts an OPEN (Google's "frequently contacted" uses interactions; opening a
  // contact is the one this app sees for every contact). Focus (M3 list-detail; APG: move focus
  // to the new content on a view change): opening a contact focuses its name, the detail pane's
  // heading; going back to the list focuses that contact's row, or the list's title when the row
  // is gone (deleted, merged). Client navigations only for focus: the first run is the server
  // render, and a page load keeps the browser's own focus.
  const lastPath = useSignal("");
  useTask$(({ track }) => {
    const path = track(() => loc.url.pathname);
    const from = lastPath.value;
    lastPath.value = path;
    if (!isBrowser || from === path) return;
    const openedId = detailId(path);
    if (openedId) counts.value = bumpCount(openedId, "open");
    if (!from) return;
    const leftId = detailId(from);
    const target = () =>
      openedId
        ? document.getElementById(CONTACT_HEADING_ID)
        : leftId
          ? (document.querySelector<HTMLElement>(
              `[data-contact-id="${CSS.escape(leftId)}"]`,
            ) ?? document.getElementById(LIST_TITLE_ID))
          : null;
    // The new view renders after this task: retry for up to about a second (as Messages).
    let tries = 60;
    const focus = () => {
      const el = target();
      if (el && el.offsetParent !== null) {
        // The headings are `Layout.PaneHeader`'s: focusable by script only (APG).
        if (el.tagName === "H2" && !el.hasAttribute("tabindex"))
          el.setAttribute("tabindex", "-1");
        el.focus();
      } else if (--tries > 0) requestAnimationFrame(focus);
    };
    requestAnimationFrame(focus);
  });

  return (
    <Layout.Pane role="primary" bleed aria-label="Contacts">
      {/* The pane's ONE root: the two panes. "Create contact" is the app's FAB
          (`components/app-action.tsx`, a link to `/contacts/new/`): the rail's from 600px, this
          list pane's lower end corner below (the part places it). */}
      <Layout.ListDetail
        view={view.value}
        // ONE pane, as Google Contacts (owner 2026-11-25: "we have an extra pane"): the list is
        // its own page; a person replaces it, back arrow to the list. Messages keeps two.
        panes="one"
        fab={action.value ? <AppActionFab action={action.value} /> : undefined}
      >
        <Layout.ListPane aria-labelledby={LIST_TITLE_ID}>
          {/* `fullscreen`: the whole Contacts pane (both panes) where the browser allows it. */}
          <Layout.PaneHeader
            title={title.value}
            titleId={LIST_TITLE_ID}
            fullscreen
          >
            {selecting.value ? (
              <>
                <IconButton
                  icon="label"
                  label="Manage labels"
                  aria-haspopup="dialog"
                  disabled={!pickedLive.value.length}
                  onClick$={() => (bulkLabelsOpen.value = true)}
                />
                <IconButton
                  icon="download"
                  label="Export selected as vCard"
                  disabled={!pickedLive.value.length}
                  onClick$={() => exportList$("vcard")}
                />
                <IconButton
                  icon="delete"
                  label="Delete selected"
                  disabled={!pickedLive.value.length}
                  onClick$={bulkDelete$}
                />
                <IconButton
                  icon="close"
                  label="Done selecting"
                  onClick$={() => {
                    selecting.value = false;
                    picked.value = [];
                  }}
                />
              </>
            ) : (
              <>
                {/* Back to the list the search was made in (Google's search box clear). */}
                {searching.value && (
                  <IconButton
                    type="link"
                    href={loc.url.pathname}
                    icon="close"
                    label="Clear search"
                  />
                )}
                {/* Google's Trash: "Empty Trash now", disabled while the Trash is empty. */}
                {slug.value === "trash" && (
                  <Button
                    look="text"
                    label="Empty Trash now"
                    aria-haspopup="dialog"
                    disabled={!trashCount.value}
                    onClick$={() => (emptyOpen.value = true)}
                  />
                )}
                {slug.value === "merge" && (
                  <Button
                    look="text"
                    label="Merge all"
                    disabled={!duplicateGroups.value.length}
                    onClick$={() =>
                      mergeGroups(state, duplicateGroups.value, showSnackbar$)
                    }
                  />
                )}
                {plainList.value && selectable.value.length > 0 && (
                  <IconButton
                    icon="check"
                    label="Select contacts"
                    onClick$={() => (selecting.value = true)}
                  />
                )}
                {(ownLabel.value ||
                  (plainList.value && selectable.value.length > 0)) && (
                  <Menu.Root>
                    <Menu.Trigger look="plain" aria-label="More actions">
                      <Icon name="more_vert" size="sm" />
                    </Menu.Trigger>
                    <Menu.Content align="end">
                      {plainList.value && selectable.value.length > 0 && (
                        <>
                          <Menu.Item onClick$={() => exportList$("vcard")}>
                            Export as vCard (.vcf)
                          </Menu.Item>
                          <Menu.Item onClick$={() => exportList$("csv")}>
                            Export as CSV
                          </Menu.Item>
                        </>
                      )}
                      {ownLabel.value && (
                        <>
                          <Menu.Item onClick$={() => (renameOpen.value = true)}>
                            Rename label
                          </Menu.Item>
                          <Menu.Item
                            onClick$={() => (deleteLabelOpen.value = true)}
                          >
                            Delete label
                          </Menu.Item>
                        </>
                      )}
                    </Menu.Content>
                  </Menu.Root>
                )}
              </>
            )}
          </Layout.PaneHeader>
          {/* The list pane's ONE body. */}
          <div class="flex min-w-0 flex-col gap-2">
            {slug.value === "trash" ? (
              ready.value ? (
                <ContactsTrash
                  site={book.value.map((r) => ({
                    id: r.id,
                    name: r.name,
                    seed: r.seed,
                    icon: r.icon,
                  }))}
                />
              ) : (
                <LoadingIndicator aria-label="Loading the Trash" />
              )
            ) : slug.value === "merge" ? (
              ready.value ? (
                <ContactsMerge />
              ) : (
                <LoadingIndicator aria-label="Looking for duplicates" />
              )
            ) : (
              <>
                {selecting.value && selectable.value.length > 0 && (
                  <Checkbox
                    label="Select all"
                    checked={
                      pickedLive.value.length > 0 &&
                      pickedLive.value.length === selectable.value.length
                    }
                    indeterminate={
                      pickedLive.value.length > 0 &&
                      pickedLive.value.length < selectable.value.length
                    }
                    onChange$={(on) => {
                      picked.value = on ? [...selectable.value] : [];
                    }}
                  />
                )}
                {rows.value.length === 0 ? (
                  !ready.value && slug.value.startsWith("label/l-") ? (
                    <LoadingIndicator aria-label="Loading contacts" />
                  ) : searching.value ? (
                    // Google's empty search: "No results in your contacts".
                    <EmptyState
                      size="sm"
                      icon="search"
                      headline="No results in your contacts"
                      description={`Nothing matches “${query.value}”.`}
                    />
                  ) : inList.value.length === 0 ? (
                    // The list itself is empty (Google: "No contacts in Trash").
                    <EmptyState
                      size="sm"
                      icon={list.value.icon}
                      headline={
                        ready.value &&
                        slug.value.startsWith("label/l-") &&
                        !ownLabel.value
                          ? "This label isn't in this browser"
                          : list.value.empty
                      }
                      description={list.value.emptyDetail}
                    />
                  ) : null
                ) : selecting.value ? (
                  // Selection mode: each row is a checkbox named by the contact.
                  <List.Root padding="none" aria-labelledby={LIST_TITLE_ID}>
                    {rows.value.slice(0, shown.value).map((row) => (
                      <List.Item
                        key={row.key}
                        data-contact-id={row.key}
                        start={
                          <Checkbox
                            aria-label={`Select ${row.name}`}
                            checked={pickedLive.value.includes(row.key)}
                            onChange$={(on) => {
                              const key = row.key;
                              picked.value = on
                                ? [
                                    ...picked.value.filter((p) => p !== key),
                                    key,
                                  ]
                                : picked.value.filter((p) => p !== key);
                            }}
                          />
                        }
                        headline={row.name}
                        supportingText={row.supporting || undefined}
                      />
                    ))}
                  </List.Root>
                ) : (
                  // ONE list per section, one Tab stop each, arrows across its rows, Enter opens
                  // (list.md `rovingFocus`; the rows are router links). A search on a label's
                  // page has two sections: the label's matches, then the rest of the book.
                  (searching.value && searchLabel.value
                    ? [
                        {
                          id: "contacts-in-label",
                          title: `In ${list.value.label}`,
                          rows: rows.value.slice(0, found.value.inLabel),
                        },
                        {
                          id: "contacts-elsewhere",
                          title: "Other contacts",
                          rows: rows.value.slice(found.value.inLabel),
                        },
                      ].filter((section) => section.rows.length)
                    : [{ id: "", title: "", rows: rows.value }]
                  ).map((section) => (
                    <section
                      key={section.id || "all"}
                      aria-labelledby={section.id || undefined}
                    >
                      {section.title && (
                        // e-store ContactsShell's section heading (label-medium).
                        <h3
                          id={section.id}
                          class="m-0 px-4 pt-3 pb-1 text-label-medium text-on-surface-variant"
                        >
                          {section.title}
                        </h3>
                      )}
                      <List.Root
                        rovingFocus
                        padding="none"
                        aria-labelledby={section.id || LIST_TITLE_ID}
                      >
                        {section.rows.slice(0, shown.value).map((row) => (
                          <List.Item
                            key={row.key}
                            data-contact-id={row.key}
                            href={row.href}
                            // M3: selected in two-pane only, which is the only time the list
                            // shows beside an open contact.
                            selected={selectedId.value === row.key}
                            start={
                              // An app shows its icon, not initials (as `ChatAvatar`).
                              <Avatar
                                src={row.photo}
                                name={row.icon ? undefined : row.name}
                                seed={row.seed}
                                fallbackIcon={row.icon}
                                size="md"
                                presence={row.presence}
                                decorative
                              />
                            }
                            headline={row.name}
                            supportingText={row.supporting || undefined}
                            aria-label={`Open ${row.name}`}
                            // Google's row actions (owner 2026-11-25): Star, Edit, More, beside
                            // the link (`List.Item actions`), on hover / focus, always on touch.
                            actions={
                              <ContactRowActions
                                rowKey={row.key}
                                name={row.name}
                                href={row.href}
                                starred={!!row.starred}
                                site={siteBases.value.find(
                                  (b) => b.siteId === row.siteId,
                                )}
                              />
                            }
                          />
                        ))}
                      </List.Root>
                    </section>
                  ))
                )}
                {rows.value.length > shown.value && (
                  // A long book renders a page at a time; the search narrows it.
                  <Button
                    look="text"
                    label={`Show more (${rows.value.length - shown.value})`}
                    onClick$={() => (shown.value += PAGE_ROWS)}
                  />
                )}
                {!ready.value &&
                  slug.value !== "frequent" &&
                  rows.value.length > 0 && (
                    // The site's contacts are in the HTML; the visitor's join once read.
                    <LoadingIndicator aria-label="Loading your contacts" />
                  )}
              </>
            )}
            {/* The list pane's dialogs (top layer; `Modal.Root` is `display: contents`). */}
            <ConfirmDialog
              open={emptyOpen}
              title="Empty Trash?"
              description={`All ${plural(trashCount.value, "contact", "contacts")} in the Trash will be deleted forever. This cannot be undone.`}
              confirmLabel="Empty Trash"
              onConfirm$={emptyTrash$}
            />
            <LabelNameDialog
              open={renameOpen}
              title="Rename label"
              initial={ownLabel.value?.name ?? ""}
              onSave$={rename$}
            />
            <ConfirmDialog
              open={deleteLabelOpen}
              title="Delete this label?"
              description={`“${ownLabel.value?.name ?? ""}” will be deleted. Its contacts stay in your contacts.`}
              confirmLabel="Delete label"
              onConfirm$={deleteLabel$}
            />
            <ManageLabelsDialog
              open={bulkLabelsOpen}
              labels={labelChoices.value}
              counts={bulkCounts.value}
              total={pickedLive.value.length}
              onApply$={bulkLabels$}
            />
          </div>
        </Layout.ListPane>

        {/* The detail pane: the child route (a contact, or the placeholder). Hidden in
            single-pane on a list route, where the list is the view. A dialog route's page goes
            after the panes instead (`DIALOG_ROUTE`), and the placeholder stays here. One `<Slot>`
            is rendered at a time (Qwik docs, "Slots": a Slot may be rendered conditionally; the
            page reads only this layout's own context, so it does not depend on where it is). */}
        <Layout.DetailPane>
          {dialogRoute.value ? <ContactsPlaceholder /> : <Slot />}
        </Layout.DetailPane>
        {dialogRoute.value && <Slot />}
      </Layout.ListDetail>
    </Layout.Pane>
  );
});
