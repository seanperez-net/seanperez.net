import {
  $,
  component$,
  isServer,
  useComputed$,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { QRL, Signal } from "@qwik.dev/core";
import { useLocation, useNavigate } from "@qwik.dev/router";
import { Chip, ChipGroup, Search } from "@seanperez/ui";
import type { IconName } from "@seanperez/ui";
import { emptyBook, type LocalBook } from "../contacts/local-book";
import { loadBook, onBookChange } from "../contacts/local-book-store";
import {
  allRows,
  labelOfPath,
  searchRows,
  siteContactBases,
  type BookRow,
} from "../contacts/search-local";
import { CONTACT_LABELS } from "../content/contacts";
import { addRecent, readRecent, removeRecent } from "../search/recent";
import type { RecentSearch } from "../search/recent";
import {
  GROUP_LABELS,
  SCOPES,
  SEARCH_GROUPS,
  cleanQuery,
  searchPageHref,
} from "../search/types";
import type {
  SearchGroup,
  SearchHit,
  SearchResults,
  SearchScope,
} from "../search/types";

/** Each group's leading icon (Material Symbols). */
export const GROUP_ICONS: Record<SearchGroup | "search", IconName> = {
  posts: "article",
  projects: "folder_open",
  contacts: "person",
  pages: "link",
  search: "search",
};

/** The empty box's shortcuts when there are no recent searches (owner's design, 2026-11-24). */
const SHORTCUTS = [
  { label: "Home", href: "/", icon: "home" },
  // About became the Contacts app (owner, 2026-11-24).
  { label: "Contacts", href: "/contacts/", icon: "contacts" },
  { label: "Messages", href: "/messages/", icon: "chat" },
  { label: "Maps", href: "/maps/", icon: "explore" },
] satisfies { label: string; href: string; icon: IconName }[];

/** Contacts rows in the All view (the Contacts chip shows them all). */
const CONTACT_ROWS = 5;

/** Typing waits this long before asking the server (stale requests are aborted). */
const DEBOUNCE_MS = 200;

export interface ScopeChipsProps {
  /** The chip shown selected (`?in=`). */
  selected: SearchScope;
  /** A chip was chosen (never called for the one already selected). */
  onPick$: QRL<(scope: SearchScope) => void>;
}

/**
 * The single-select filter chip row (M3 filter chips, our `Chip type="filter"` in a
 * `ChipGroup` toolbar): in the search view and on `/search/`. A filter chip toggles itself, so
 * each has its own `bind:selected` signal, kept in step with `selected`; pressing the selected
 * chip again leaves it selected (one choice, never none).
 */
export const ScopeChips = component$<ScopeChipsProps>(
  ({ selected, onPick$ }) => {
    const chips: Record<SearchScope, Signal<boolean>> = {
      all: useSignal(selected === "all"),
      posts: useSignal(selected === "posts"),
      contacts: useSignal(selected === "contacts"),
      projects: useSignal(selected === "projects"),
      pages: useSignal(selected === "pages"),
    };
    const current = useSignal(selected);
    useTask$(({ track }) => {
      const value = track(() => selected);
      current.value = value;
      for (const s of SCOPES) chips[s].value = s === value;
    });
    const pick$ = $((s: SearchScope, on: boolean) => {
      if (!on && current.value === s) chips[s].value = true;
      else if (on && current.value !== s) {
        for (const other of SCOPES) chips[other].value = other === s;
        current.value = s;
        return onPick$(s);
      }
    });
    return (
      <ChipGroup label="Show results from" overflow="scroll">
        {SCOPES.map((s) => (
          <Chip
            key={s}
            type="filter"
            label={GROUP_LABELS[s]}
            bind:selected={chips[s]}
            onSelectedChange$={(on) => pick$(s, on)}
          />
        ))}
      </ChipGroup>
    );
  },
);

/**
 * The empty box: the recent searches, or the shortcuts. Its own component, reading `recent`
 * itself: when the parent set the signal from a row's remove button, the parent's projected
 * rows did not re-render until the View did (Qwik 2.0.0-rc.5, Chrome 2026-11-24; a fetch
 * result set by the parent did). A component inside the slot re-renders in place.
 */
const EmptyBox = component$<{ recent: Signal<RecentSearch[]> }>(
  ({ recent }) => {
    return recent.value.length ? (
      <Search.Group label="Recent">
        {recent.value.map((entry) => (
          <Search.Item
            key={entry.href}
            label={entry.label}
            href={entry.href}
            icon="history"
            removeLabel="Remove from recent searches:"
            onClick$={() => {
              recent.value = addRecent(entry);
            }}
            onRemove$={() => {
              recent.value = removeRecent(entry.href);
            }}
          />
        ))}
      </Search.Group>
    ) : (
      <Search.Group label="Go to">
        {SHORTCUTS.map((page) => (
          <Search.Item
            key={page.href}
            label={page.label}
            href={page.href}
            icon={page.icon}
          />
        ))}
      </Search.Group>
    );
  },
);

/**
 * The site-wide search in the top app bar (owner, 2026-11-24: "the search with the chips and
 * full text"), on every route: the library's `Search` as M3's adaptive search (an icon that opens
 * the full-screen view below 600px, the docked bar from 600px), Cmd/Ctrl+K.
 *
 * - Results come from `GET /api/search` (`search/search.server.ts`), 200 ms after typing.
 * - A single-select filter chip row (All, Posts, Contacts, Projects, Pages) sits OUTSIDE the
 *   listbox (`q:slot="filters"`). All shows each group under a heading, at most 3 rows, and
 *   "See all N" switches to that group's chip; a chip shows one flat list.
 * - An empty box shows the recent searches (this browser only, `search/recent.ts`), each
 *   removable, or shortcuts.
 * - The last row in All hands the text to the Maps app (`/maps/?q=`); no place search here.
 * - Enter with no row highlighted opens the results page `/search/?q=&in=`. The form is a real
 *   GET form, so the URL is the same one a browser without JavaScript would build.
 */
export const SiteSearch = component$(() => {
  const nav = useNavigate();
  const loc = useLocation();
  const open = useSignal(false);
  const query = useSignal("");
  const scope = useSignal<SearchScope>("all");
  const results = useSignal<SearchResults | null>(null);
  const recent = useSignal<RecentSearch[]>([]);

  // CONTACTS ARE MATCHED IN THE BROWSER, on every route (2026-11-25, owner "do whats recomended
  // for now"; `.claude/notes/local-search-orama-opfs-2026-11-25.md` "Round 2"): the site's
  // contacts (with the visitor's edits) and the visitor's OWN contacts, read from their browser
  // when the search opens, folded like the server ("garcia" finds "García"), shown first in the
  // Contacts group. In All, the server's Contacts rows (the résumé's rows and links) follow, minus
  // any the browser already has. The Contacts chip never asks the server (second agent,
  // 2026-11-24: the visitor's contacts' names would land in request URLs).
  // SCOPED TO THE APP (owner, 2026-11-24: "it should prioritize that label"; Google Contacts' top
  // search): in Contacts the search starts on the Contacts chip and, on a label's page, puts that
  // label's contacts first.
  const inContacts = useComputed$(() =>
    loc.url.pathname.startsWith("/contacts/"),
  );
  const labelId = useComputed$(() => labelOfPath(loc.url.pathname));
  const book = useSignal<LocalBook>(emptyBook());
  const appScope = useComputed$<SearchScope>(() =>
    inContacts.value ? "contacts" : "all",
  );
  const contactHits = useComputed$(() => {
    const q = cleanQuery(query.value);
    if (!q) return { rows: [] as BookRow[], inLabel: 0 };
    return searchRows(
      allRows(siteContactBases(), book.value),
      q,
      labelId.value,
    );
  });
  // The server's Contacts rows for this query (the résumé's rows and links) that the browser's
  // rows do not already show.
  const serverContacts = useComputed$(() => {
    const r = results.value;
    if (!r || r.q !== cleanQuery(query.value)) return [] as SearchHit[];
    const shown = new Set(contactHits.value.rows.map((row) => row.href));
    return (r.groups.find((g) => g.group === "contacts")?.hits ?? []).filter(
      (hit) => !shown.has(hit.href),
    );
  });
  const labelName = useComputed$(() => {
    const id = labelId.value;
    if (!id) return "";
    return (
      [...CONTACT_LABELS, ...book.value.labels].find((l) => l.id === id)
        ?.name ?? "this label"
    );
  });

  // Opened: read the recent searches and the visitor's book (after resume, never in server
  // render, never at mount), and re-read the book while open when another tab changes it. A change
  // in this tab is read at the next open. Closed: back to the app's chip.
  useTask$(({ track, cleanup }) => {
    const isOpen = track(open);
    const start = track(appScope);
    if (isServer) return;
    if (!isOpen) {
      scope.value = start;
      return;
    }
    recent.value = readRecent();
    // Opening with an empty box starts on the app's chip (Contacts in Contacts).
    if (!cleanQuery(query.value)) scope.value = start;
    // Not awaited: a task blocks the render that expands the bar until it settles, so awaiting
    // the browser read here left the input hidden when Search moved focus into it (2026-11-24,
    // found in Chrome: in Contacts the opened search had no focus and typing went nowhere).
    const read = () =>
      void loadBook().then((b) => {
        book.value = b;
      });
    read();
    cleanup(onBookChange(read));
  });

  // As you type: debounced, the previous request aborted. Never for the Contacts chip (matched in
  // the browser only, above).
  useTask$(({ track, cleanup }) => {
    const q = cleanQuery(track(query));
    const s = track(scope);
    if (isServer) return;
    if (!q || s === "contacts") {
      results.value = null;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, in: s });
        const response = await fetch(`/api/search?${params}`, {
          signal: controller.signal,
        });
        if (response.ok) results.value = await response.json();
      } catch {
        // Aborted by the next keystroke, or offline: keep the last results.
      }
    }, DEBOUNCE_MS);
    cleanup(() => {
      clearTimeout(timer);
      controller.abort();
    });
  });

  const remember$ = $(
    (hit: { label: string; href: string; group: RecentSearch["group"] }) => {
      recent.value = addRecent(hit);
    },
  );

  const submit$ = $(async () => {
    const q = cleanQuery(query.value);
    if (!q) return;
    // On the Contacts chip: the Contacts list pane's "Search results" (`?q=`; on a label's page
    // that list, the label first), where the visitor's own contacts are, never the server;
    // otherwise the site's results page (which adds the visitor's own contacts after load).
    const href =
      scope.value === "contacts"
        ? `${labelId.value ? loc.url.pathname : "/contacts/"}?${new URLSearchParams({ q })}`
        : searchPageHref(q, scope.value);
    recent.value = addRecent({ label: q, href, group: "search" });
    open.value = false;
    query.value = "";
    await nav(href);
  });

  /** A contact row (Google's suggestion: the name, a dimmed second line). */
  const contactRow = (row: BookRow) => (
    <Search.Item
      key={row.key}
      label={row.name}
      supportingText={row.supporting || undefined}
      href={row.href}
      icon={row.icon ?? "person"}
      onClick$={() =>
        remember$({ label: row.name, href: row.href, group: "contacts" })
      }
    />
  );
  /** The Contacts app's own matches, the label's first; `limit` rows in All. */
  const contactGroups = (limit?: number) => {
    const { rows, inLabel } = contactHits.value;
    const extra = serverContacts.value;
    const sections = labelId.value
      ? [
          {
            label: `In ${labelName.value}`,
            rows: rows.slice(0, inLabel),
            extra: [],
          },
          { label: "Other contacts", rows: rows.slice(inLabel), extra },
        ]
      : [{ label: "Contacts", rows, extra }];
    return sections
      .filter((section) => section.rows.length + section.extra.length)
      .map((section) => (
        <Search.Group key={section.label} label={section.label}>
          {section.rows.slice(0, limit).map(contactRow)}
          {section.extra
            .slice(
              0,
              limit === undefined
                ? undefined
                : Math.max(0, limit - section.rows.length),
            )
            .map(hitRow)}
          {limit !== undefined &&
            section.rows.length + section.extra.length > limit && (
              <Search.Item
                label={`See all ${section.rows.length + section.extra.length}`}
                icon="arrow_forward"
                keepOpen
                onClick$={() => {
                  scope.value = "contacts";
                }}
              />
            )}
        </Search.Group>
      ));
  };

  const hitRow = (hit: SearchHit) => (
    <Search.Item
      key={hit.href}
      label={hit.label}
      supportingText={hit.snippet || undefined}
      href={hit.href}
      icon={GROUP_ICONS[hit.group]}
      onClick$={() =>
        remember$({ label: hit.label, href: hit.href, group: hit.group })
      }
    />
  );

  return (
    // `display: contents`: the form adds no box, so the search sits in the app bar's column as
    // the library places it. A real GET form (no JavaScript: `/search/?q=&in=`).
    <form
      action="/search/"
      method="get"
      class="contents"
      preventdefault:submit
      onSubmit$={submit$}
      // Enter with no row highlighted opens the results page. Not the browser's implicit
      // submission: the form holds two text fields (the bar's and the full-screen view's), and
      // HTML submits on Enter only with ONE text field or a submit button. With a row
      // highlighted the library's input prevents Enter and chooses the row instead.
      onKeyDown$={(event: KeyboardEvent) => {
        const input = event.target as HTMLElement;
        if (
          event.key === "Enter" &&
          input.getAttribute("role") === "combobox" &&
          !input.hasAttribute("aria-activedescendant")
        )
          return submit$();
      }}
    >
      {/* `in` rides along with `q` (both inputs are named `q` and hold the same text). */}
      <input type="hidden" name="in" value={scope.value} />
      <Search.Root
        layout="adaptive"
        keyboardShortcut
        showOnEmpty
        bind:open={open}
        bind:query={query}
        aria-label="Site"
      >
        <Search.Trigger
          label={inContacts.value ? "Search contacts" : "Search the site"}
        />
        <Search.Bar
          size="compact"
          placeholder={inContacts.value ? "Search contacts" : "Search the site"}
        />
        <Search.View
          placeholder={inContacts.value ? "Search contacts" : "Search the site"}
        >
          {/* Only with a query: recent searches and shortcuts are not filtered. */}
          {query.value.trim() && (
            <ScopeChips
              q:slot="filters"
              selected={scope.value}
              onPick$={(s) => {
                scope.value = s;
              }}
            />
          )}
          {!query.value.trim() ? (
            <EmptyBox recent={recent} />
          ) : scope.value === "contacts" ? (
            contactHits.value.rows.length || serverContacts.value.length ? (
              contactGroups()
            ) : (
              <Search.Item
                label={`No contacts match “${cleanQuery(query.value)}”`}
                disabled
              />
            )
          ) : scope.value === "all" ? (
            <>
              {/* In Contacts, its matches first; elsewhere in the groups' order (the server's
                  contacts group is replaced by the browser's, which has the visitor's own). */}
              {inContacts.value && contactGroups(CONTACT_ROWS)}
              {SEARCH_GROUPS.map((name) => {
                if (name === "contacts")
                  return inContacts.value ? null : contactGroups(CONTACT_ROWS);
                const group =
                  results.value?.scope === "all"
                    ? results.value.groups.find((g) => g.group === name)
                    : undefined;
                return (
                  group && (
                    <Search.Group key={group.group} label={group.label}>
                      {group.hits.map(hitRow)}
                      {group.total > group.hits.length && (
                        <Search.Item
                          label={`See all ${group.total}`}
                          icon="arrow_forward"
                          keepOpen
                          onClick$={() => {
                            scope.value = group.group;
                          }}
                        />
                      )}
                    </Search.Group>
                  )
                );
              })}
              {results.value?.scope === "all" &&
                results.value.q === cleanQuery(query.value) &&
                !results.value.groups.some((g) => g.group !== "contacts") &&
                !contactHits.value.rows.length &&
                !serverContacts.value.length && (
                  <Search.Item
                    label={`No results for “${cleanQuery(query.value)}”`}
                    disabled
                  />
                )}
              {/* The Maps app's own place search takes it from here (no Photon call here). */}
              <Search.Item
                label={`Search places for “${cleanQuery(query.value)}”`}
                href={`/maps/?${new URLSearchParams({ q: cleanQuery(query.value) })}`}
                icon="map_search"
              />
            </>
          ) : results.value?.scope === scope.value ? (
            results.value.groups[0]?.hits.length ? (
              results.value.groups[0].hits.map(hitRow)
            ) : (
              results.value.q === cleanQuery(query.value) && (
                <Search.Item
                  label={`No ${GROUP_LABELS[scope.value].toLowerCase()} match “${cleanQuery(query.value)}”`}
                  disabled
                />
              )
            )
          ) : null}
        </Search.View>
      </Search.Root>
    </form>
  );
});
