import type { DocumentHead } from "@qwik.dev/router";
import { useLocation } from "@qwik.dev/router";
import { component$, useComputed$ } from "@qwik.dev/core";
import { Layout } from "@seanperez/ui";
import { MapView } from "../../components/map-view";
import { parseMapsUrl } from "../../components/map-url";
import { pageHead } from "../../seo";

/**
 * The Maps app: the map fills the primary pane (`bleed`, e-store's maps layout); search,
 * directions and the style editor are its side panel (`routes/layout.tsx`, `MapPanel`). Its title
 * is in the page's heading for screen readers; the pane has no visible header.
 *
 * The URL (`?at=`, `?q=`, `?from=`, `?to=`, `?mode=`, `map-url.ts`) is read here, on the server
 * and on a client navigation alike, and handed to the map (owner-approved 2026-11-24).
 */
export default component$(() => {
  const loc = useLocation();
  // Read in `useComputed$`, not the component body (rule Q12).
  const initial = useComputed$(() => parseMapsUrl(loc.url.searchParams));
  return (
    <Layout.Pane role="primary" bleed aria-labelledby="maps-title">
      <h2 id="maps-title" class="sr-only">
        Maps
      </h2>
      <MapView label="Map" initial={initial.value} />
    </Layout.Pane>
  );
});

export const head: DocumentHead = ({ url }) => pageHead("/maps/", url);
