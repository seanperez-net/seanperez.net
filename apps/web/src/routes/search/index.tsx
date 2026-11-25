import { component$ } from "@qwik.dev/core";
import { routeLoader$, useNavigate, type DocumentHead } from "@qwik.dev/router";
import { Button, Icon, Layout, List, TextField } from "@seanperez/ui";
import { GROUP_ICONS, ScopeChips } from "../../components/site-search";
import { search } from "../../search/search.server";
import { parseScope, searchPageHref } from "../../search/types";
import type { SearchHit } from "../../search/types";
import { pageHead } from "../../seo";

/**
 * `?q=&in=`: the results, rendered on the server. The same `search()` as `/api/search`, so the
 * page and the app bar's list agree. Serialized into the HTML (Q7): the page IS its data.
 */
export const useResults = routeLoader$(
  ({ platform, url }) =>
    search(
      platform.env.DB,
      url.searchParams.get("q") ?? "",
      parseScope(url.searchParams.get("in")),
    ),
  {
    serializationStrategy: "always",
    // rc.5 `strictLoaders` (default on): a loader sees NO search params unless it lists them
    // here (router `index.d.ts`, `LoaderOptions.search`); they also key its re-fetch.
    search: ["q", "in"],
  },
);

/**
 * The results page (owner, 2026-11-24: scope in the URL, a GET form that works without
 * JavaScript). Enter in the app bar's search opens it; so does this page's own form. The chips
 * switch `?in=` (they need JavaScript; the URL alone works without). Each group is a list of
 * link rows (`list.md`, "Places to go"); a link off the site (a GitHub repo) is a full load.
 */
export default component$(() => {
  const results = useResults();
  const nav = useNavigate();
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title="Search" />
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid content-start gap-4">
        <form action="/search/" method="get" class="flex items-start gap-2">
          <TextField
            type="search"
            name="q"
            label="Search the site"
            value={results.value.q}
            leadingIcon="search"
            class="flex-1"
          />
          {results.value.scope !== "all" && (
            <input type="hidden" name="in" value={results.value.scope} />
          )}
          <Button type="submit" label="Search" />
        </form>
        <ScopeChips
          selected={results.value.scope}
          onPick$={(scope) => nav(searchPageHref(results.value.q, scope))}
        />
        {!results.value.q ? (
          <p class="text-body-large text-on-surface-variant">
            Type a word to search posts, projects, contacts and pages.
          </p>
        ) : results.value.groups.length ? (
          results.value.groups.map((group) => (
            <section
              key={group.group}
              aria-labelledby={`results-${group.group}`}
              class="grid gap-1"
            >
              <h3
                id={`results-${group.group}`}
                class="text-title-small text-on-surface-variant"
              >
                {group.label} ({group.total})
              </h3>
              <List.Root aria-labelledby={`results-${group.group}`}>
                {group.hits.map((hit: SearchHit) => (
                  <List.Item
                    key={hit.href}
                    href={hit.href}
                    reload={!hit.href.startsWith("/")}
                    // Off the site: the row ends with the open-in-new mark (List.Item).
                    rel={hit.href.startsWith("/") ? undefined : "external"}
                    headline={hit.label}
                    supportingText={hit.snippet || undefined}
                    startIcon={GROUP_ICONS[hit.group]}
                  />
                ))}
              </List.Root>
              {group.total > group.hits.length && (
                <Button
                  type="link"
                  look="text"
                  href={searchPageHref(results.value.q, group.group)}
                  label={`See all ${group.total}`}
                  trailingIcon="arrow_forward"
                />
              )}
            </section>
          ))
        ) : (
          // Empty state, as Home's: an icon, what is missing, what to try.
          <div class="grid justify-items-center gap-2 py-16 text-center text-on-surface-variant">
            <Icon name="search" size="xl" aria-hidden="true" />
            <p class="text-title-medium text-on-surface">
              No results for “{results.value.q}”
            </p>
            <p class="text-body-medium">Try another word, or All.</p>
          </div>
        )}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = ({ url, resolveValue }) => {
  const { q } = resolveValue(useResults);
  const base = pageHead("/search/", url);
  return {
    ...base,
    title: q ? `“${q}” · Search · Sean Perez` : base.title,
    // A results page is not a page to index (and its URL is whatever was typed).
    meta: [...(base.meta ?? []), { name: "robots", content: "noindex" }],
  };
};
