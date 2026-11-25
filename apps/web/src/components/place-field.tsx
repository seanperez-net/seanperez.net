import { $, component$, useSignal } from "@qwik.dev/core";
import { Combobox } from "@seanperez/ui";
import { LOCATE_TEXT, locateOnce } from "./locate";
import { PLACE_SEARCH_MIN_CHARS, usePlaceSuggestions } from "./map-search";
import { reversePlace } from "./map-services";
import type { MapPlace } from "./map-services";

/**
 * A Location field whose places come from the Maps app (owner, 2026-11-24: "shouldnt all the
 * address things populate from the map app"): the Maps place search (`map-search.tsx`, Photon,
 * debounced, cached, the same fair-use limits) as suggestions, and "Use my location" (the
 * Geolocation API, only on that press, `locate.ts`) named by Photon's reverse lookup. The text
 * stays free ("City, Country", or anything typed) and is posted under `name`.
 *
 * Built on the library's `Combobox` in its `freeText` mode with `filter={false}` (Photon
 * already matched the text) and its trailing action button (both NEW in the library,
 * 2026-11-24). `autocomplete="off"` (Combobox's own): no HTML autofill token is "City,
 * Country" (`address-level2` is the city alone, `country-name` the country alone), and the
 * browser's autofill list would cover ours.
 *
 * Privacy: the position is rounded to 2 decimals (about 1 km) before it goes to Photon, and only
 * the place's name comes back into the field; nothing is stored here (the visitor's demo saves
 * nothing; /admin/profile stores the text only).
 */
export type PlaceFieldProps = {
  name: string;
  label?: string;
  /** The starting text. */
  value?: string;
  maxLength?: number;
  error?: string;
};

/** Photon's language for the names: the site is English ("Havana", not "La Habana"). */
const LANG = "en";

const SUPPORTING =
  "Pick a suggestion or type any place. “Use my location” sends your position to Photon (OpenStreetMap) to name the place.";

/** One suggestion per "City, Country": a city's streets all land on the same text. */
const areas = (places: MapPlace[]) =>
  places.filter(
    (place, i) => places.findIndex((p) => p.area === place.area) === i,
  );

/** About 1 km: enough to name the town, less than the device knows. */
const round = (n: number) => Math.round(n * 100) / 100;

export const PlaceField = component$<PlaceFieldProps>(
  ({ name, label = "Location", value = "", maxLength, error }) => {
    const text = useSignal(value);
    const { results, status } = usePlaceSuggestions(text, { lang: LANG });
    // What "Use my location" is doing (announced; replaces the supporting text meanwhile).
    const locate = useSignal("");
    const locating = useSignal(false);

    const useMyLocation$ = $(async () => {
      if (locating.value) return;
      locating.value = true;
      locate.value = LOCATE_TEXT.locating;
      try {
        const [lng, lat] = await locateOnce();
        const place = await reversePlace([round(lng), round(lat)], undefined, {
          lang: LANG,
        });
        if (!place) {
          locate.value = "No place was found there. Type it instead.";
          return;
        }
        text.value = maxLength ? place.area.slice(0, maxLength) : place.area;
        locate.value = `Location set to ${text.value}.`;
      } catch (failure) {
        locate.value =
          failure instanceof Error ? failure.message : LOCATE_TEXT.unavailable;
      } finally {
        locating.value = false;
      }
    });

    return (
      <div>
        <Combobox.Root
          bind:value={text}
          name={name}
          freeText
          filter={false}
          error={error}
          supportingText={locate.value || SUPPORTING}
        >
          <Combobox.Input
            label={label}
            maxLength={maxLength}
            actionIcon="my_location"
            actionLabel="Use my location"
            onAction$={useMyLocation$}
          />
          <Combobox.Content>
            {areas(results.value).map((place) => (
              <Combobox.Item
                key={place.area}
                value={place.area}
                label={place.area}
              />
            ))}
            <Combobox.Empty>
              {status.value ||
                (text.value.trim().length < PLACE_SEARCH_MIN_CHARS
                  ? `Type ${PLACE_SEARCH_MIN_CHARS} or more letters for suggestions.`
                  : "")}
            </Combobox.Empty>
          </Combobox.Content>
        </Combobox.Root>
        {/* The locate outcome, spoken (the supporting text above shows it). */}
        <p role="status" class="sr-only">
          {locate.value}
        </p>
      </div>
    );
  },
);
