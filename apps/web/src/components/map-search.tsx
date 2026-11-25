import { untrack, useContext, useSignal, useTask$ } from "@qwik.dev/core";
import type { Signal } from "@qwik.dev/core";
import { isBrowser } from "@qwik.dev/core/build";
import { searchPlaces } from "./map-services";
import type { MapPlace, PhotonOptions } from "./map-services";
import type { LngLat } from "./map-url";
import { mapsContextId } from "./map-state";
import type { MapsState } from "./map-state";

/** Photon fair use (`map-services.ts`): search 400 ms after typing stops, from 3 characters. */
export const PLACE_SEARCH_DELAY_MS = 400;
export const PLACE_SEARCH_MIN_CHARS = 3;

/**
 * One debounced search: the timing, the abort and the status line every place input shares.
 * Called from a `useTask$`; returns its cleanup. `done` gets the places (Maps keeps them).
 */
function searchLater(
  q: string,
  near: LngLat | null,
  results: Signal<MapPlace[]>,
  status: Signal<string>,
  options: PhotonOptions,
  done?: (places: MapPlace[]) => void,
): () => void {
  const controller = new AbortController();
  const timer = setTimeout(async () => {
    status.value = "Searching…";
    try {
      results.value = await searchPlaces(q, near, controller.signal, options);
      status.value = results.value.length ? "" : "No places found.";
      done?.(results.value);
    } catch (error) {
      if (controller.signal.aborted) return;
      status.value = error instanceof Error ? error.message : "Search failed.";
    }
  }, PLACE_SEARCH_DELAY_MS);
  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}

/**
 * The same place search outside the Maps app (no map, so no bias): the Location fields
 * (`place-field.tsx`). Photon names in `lang` ("Havana", not "La Habana").
 */
export const usePlaceSuggestions = (
  query: Signal<string>,
  options: PhotonOptions = {},
) => {
  const results = useSignal<MapPlace[]>([]);
  const status = useSignal("");
  const lang = options.lang;
  useTask$(({ track, cleanup }) => {
    const q = track(() => query.value).trim();
    if (!isBrowser) return;
    if (q.length < PLACE_SEARCH_MIN_CHARS) {
      results.value = [];
      status.value = "";
      return;
    }
    // A suggestion was just chosen (the field now holds its text): no new request.
    if (untrack(results).some((place) => place.area === q)) return;
    cleanup(searchLater(q, null, results, status, { lang }));
  });
  return { results, status };
};

/**
 * Debounced place search for a `Search` box: 400 ms after typing stops, from 3 characters (the
 * Photon fair-use rules live in `map-services.ts`). Used by the Search panel and by the
 * Directions panel's stop search.
 *
 * `keep` (the Search panel): the text and results start from, and are written back to,
 * `MapsState.searchText` / `searchResults`, so they survive the panel unmounting when another
 * companion opens. The saved text is not searched again on the way back (its results are
 * there). Read with `untrack`: a setup read, not a subscription (rule Q12).
 */
export const usePlaceSearch = (keep = false) => {
  const state = useContext(mapsContextId);
  const query = useSignal(keep ? untrack(() => state.searchText) : "");
  const results = useSignal<MapPlace[]>(
    keep ? untrack(() => state.searchResults) : [],
  );
  const status = useSignal("");
  useTask$(({ track, cleanup }) => {
    const q = track(() => query.value).trim();
    if (!isBrowser) return;
    if (keep) {
      // Back on the panel with the saved text: its results are already shown.
      const saved = untrack(() => state.searchText).trim();
      state.searchText = query.value;
      if (saved === q && untrack(results).length) return;
    }
    if (q.length < PLACE_SEARCH_MIN_CHARS) {
      results.value = [];
      status.value = "";
      if (keep) state.searchResults = [];
      return;
    }
    cleanup(
      searchLater(
        q,
        state.camera?.center ?? null,
        results,
        status,
        {},
        keep ? (places) => (state.searchResults = places) : undefined,
      ),
    );
  });
  return { query, results, status };
};

/** A result row's text: the name, then where it is. */
export const resultLabel = (place: MapPlace) =>
  place.detail ? `${place.name}, ${place.detail}` : place.name;

/** Shows a place: the marker, `?q=` (via `state.query`) and a camera move. */
export const showPlace = (state: MapsState, place: MapPlace) => {
  state.place = place;
  state.query = place.name;
  state.flyTo = {
    center: place.lngLat,
    zoom: 15,
    bbox: place.bbox,
    seq: Date.now(),
  };
};
