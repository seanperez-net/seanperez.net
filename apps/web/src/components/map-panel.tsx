import { $, component$, useContext, useSignal } from "@qwik.dev/core";
import {
  Button,
  Card,
  ColorPicker,
  Files,
  IconButton,
  List,
  Search,
  Switch,
  ToggleGroup,
} from "@seanperez/ui";
import type { IconName, LayoutCompanion } from "@seanperez/ui";
import { LOCATE_TEXT, locateOnce } from "./locate";
import { NodesPanel } from "./map-nodes-panel";
import { formatDistance, formatDuration } from "./map-services";
import type { MapPlace } from "./map-services";
import { resultLabel, showPlace, usePlaceSearch } from "./map-search";
import { mapsCompanionContextId, mapsContextId } from "./map-state";
import type { MapStyle } from "./map-state";
import {
  STYLE_GROUPS,
  applyOverrides,
  readOverrides,
  themeOverrides,
} from "./map-style-groups";
import type { StyleGroupId, StyleSpecification } from "./map-style-groups";
import type { TravelMode } from "./map-url";

/**
 * The Maps app's side panels (owner, 2026-11-24: "a playground sort of thing for the map"):
 * Search, Directions and Style, each its OWN companion (a companion-rail button that switches the
 * supporting pane's content; below 600px the compact sheet's companion tabs). Owner, 2026-11-24:
 * "you can add more rail items to change the sub pane so you dont need to jam everything in one
 * pane" (a first build had them as tabs in one "Map" panel). Library components through their
 * props only (no `class=` on them).
 *
 * The map search stays in its panel (owner, 2026-11-24): the top app bar's search is to be the
 * site-wide one. e-store's maps app puts its search in an overlay app bar instead.
 */

/** The Maps companions, in the companion rail's order (plain data, `LayoutCompanion`). */
export const MAPS_COMPANIONS = [
  // "Search" (owner, 2026-11-24; was "Places"), with the map-search icon: the app bar's
  // `search` is kept for the site-wide search.
  { id: "search", label: "Search", icon: "map_search" },
  { id: "directions", label: "Directions", icon: "directions" },
  { id: "style", label: "Style", icon: "palette" },
  // Nodes (owner, 2026-11-24): devices on the map, LoRa / Wi-Fi / GPS trackers / drones.
  { id: "nodes", label: "Devices", icon: "sensors" },
] as const satisfies readonly LayoutCompanion[];

export type MapsCompanionId = (typeof MAPS_COMPANIONS)[number]["id"];

/** Whether a companion id is one of the Maps panels. */
export const isMapsCompanion = (
  id: string | null | undefined,
): id is MapsCompanionId => MAPS_COMPANIONS.some((c) => c.id === id);

const STYLES: { value: MapStyle; label: string }[] = [
  { value: "site", label: "Follow site" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const MODES: { value: TravelMode; label: string; icon: IconName }[] = [
  { value: "car", label: "Drive", icon: "directions_car" },
  { value: "bike", label: "Bike", icon: "directions_bike" },
  { value: "foot", label: "Walk", icon: "directions_walk" },
];

/**
 * The Search companion (owner, 2026-11-24: "put search as the thing instead of places there";
 * it was "Places"). The map's own search: our library `Search`, docked, results under it, then
 * the chosen place's card (Clear, Directions). It stays in the Maps app's panel: the top app
 * bar's search is to be the SITE's search (owner, 2026-11-24, designed separately). Its icon is
 * `map_search`, so it is not mistaken for that one.
 */
const SearchPanel = component$(() => {
  const state = useContext(mapsContextId);
  const companion = useContext(mapsCompanionContextId);
  // Kept in MapsState across companion switches (forms audit 2026-11-24, decision 2).
  const { query, results, status } = usePlaceSearch(true);

  const directionsTo = $(() => {
    const place = state.place;
    if (!place) return;
    state.to = { label: place.name, lngLat: place.lngLat };
    companion.value = "directions";
  });
  const clear = $(() => {
    state.place = null;
    state.query = "";
  });

  return (
    // Spacing between the panel's parts (placement only; no library component is restyled).
    <div class="grid gap-4">
      <Search.Root layout="docked" bind:query={query} aria-label="Map search">
        <Search.Bar size="compact" placeholder="Search the map" />
        <Search.View placeholder="Search the map" resultsLabel="Places">
          {results.value.map((place) => (
            <Search.Item
              key={place.id}
              label={resultLabel(place)}
              icon="location_on"
              onClick$={() => showPlace(state, place)}
            />
          ))}
        </Search.View>
      </Search.Root>
      <p role="status" class="text-body-small text-on-surface-variant">
        {status.value}
      </p>
      {state.place && (
        <Card.Root variant="filled">
          <Card.Header>
            <Card.Title>{state.place.name}</Card.Title>
            {state.place.detail && (
              <Card.Description>{state.place.detail}</Card.Description>
            )}
          </Card.Header>
          <Card.Footer>
            <Button look="text" label="Clear" onClick$={clear} />
            <Button
              look="filled"
              label="Directions"
              leadingIcon="directions"
              onClick$={directionsTo}
            />
          </Card.Footer>
        </Card.Root>
      )}
    </div>
  );
});

const DirectionsTab = component$(() => {
  const state = useContext(mapsContextId);
  const { query, results, status } = usePlaceSearch();
  const locateStatus = useSignal("");

  // Start from my location (owner, 2026-11-24: "use the geo location api"): one position, only
  // on this press (`locate.ts`). Named "Your location" (Google Maps' wording) without a reverse
  // lookup: the stop needs the point, not its name, and that saves a Photon request.
  const fromHere = $(async () => {
    locateStatus.value = LOCATE_TEXT.locating;
    try {
      const lngLat = await locateOnce();
      state.from = { label: "Your location", lngLat };
      locateStatus.value = "";
    } catch (error) {
      locateStatus.value =
        error instanceof Error ? error.message : LOCATE_TEXT.unavailable;
    }
  });

  // A search result fills the empty stop (start first), else replaces the destination.
  const addStop = $((place: MapPlace) => {
    const stop = { label: place.name, lngLat: place.lngLat };
    if (!state.from) state.from = stop;
    else state.to = stop;
  });
  const swap = $(() => {
    const from = state.from;
    state.from = state.to;
    state.to = from;
  });

  const stops = [
    { which: "from", label: "Start", icon: "trip_origin" },
    { which: "to", label: "Destination", icon: "location_on" },
  ] as const;

  return (
    // Spacing between the panel's parts (placement only; no library component is restyled).
    <div class="grid gap-4">
      <ToggleGroup.Root
        value={state.mode}
        onValueChange$={(value) => (state.mode = value as TravelMode)}
        aria-label="Travel mode"
      >
        {MODES.map((m) => (
          <ToggleGroup.Item
            key={m.value}
            value={m.value}
            icon={m.icon}
            label={m.label}
          />
        ))}
      </ToggleGroup.Root>
      <List.Root aria-label="Stops">
        {stops.map((s) => (
          <List.Item
            key={s.which}
            overline={s.label}
            headline={state[s.which]?.label ?? "Not set"}
            startIcon={s.icon}
            end={
              <>
                {/* Only while Start is empty: three buttons cut the stop's name ("Your l…"). */}
                {s.which === "from" && !state.from && (
                  <IconButton
                    icon="my_location"
                    label="Start from your location"
                    onClick$={fromHere}
                  />
                )}
                <IconButton
                  icon="pin_drop"
                  label={
                    state.pick === s.which
                      ? "Click the map to place it"
                      : `Choose ${s.label.toLowerCase()} on the map`
                  }
                  onClick$={() =>
                    (state.pick = state.pick === s.which ? null : s.which)
                  }
                />
                <IconButton
                  icon="close"
                  label={`Clear ${s.label.toLowerCase()}`}
                  disabled={!state[s.which]}
                  onClick$={() => (state[s.which] = null)}
                />
              </>
            }
          />
        ))}
      </List.Root>
      <Button
        look="text"
        label="Swap start and destination"
        leadingIcon="swap_vert"
        disabled={!state.from && !state.to}
        onClick$={swap}
      />
      <Search.Root layout="docked" bind:query={query} aria-label="Stops search">
        <Search.Bar size="compact" placeholder="Search for a stop" />
        <Search.View placeholder="Search for a stop" resultsLabel="Places">
          {results.value.map((place) => (
            <Search.Item
              key={place.id}
              label={resultLabel(place)}
              icon="location_on"
              onClick$={() => addStop(place)}
            />
          ))}
        </Search.View>
      </Search.Root>
      <p role="status" class="text-body-small text-on-surface-variant">
        {state.pick
          ? "Click the map to set the stop."
          : locateStatus.value
            ? locateStatus.value
            : state.routeStatus === "loading"
              ? "Finding a route…"
              : state.routeStatus === "error"
                ? state.routeError
                : status.value}
      </p>
      {state.route && (
        <Card.Root variant="filled">
          <Card.Header>
            <Card.Title>
              {formatDuration(state.route.durationS)} ·{" "}
              {formatDistance(state.route.distanceM)}
            </Card.Title>
            <Card.Description>
              {MODES.find((m) => m.value === state.route?.mode)?.label}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <List.Root aria-label="Steps" padding="none">
              {state.route.steps.map((step, i) => (
                <List.Item
                  key={i}
                  headline={step.text}
                  headlineLines="auto"
                  trailingSupportingText={
                    step.distanceM > 0
                      ? formatDistance(step.distanceM)
                      : undefined
                  }
                />
              ))}
            </List.Root>
          </Card.Content>
        </Card.Root>
      )}
      <p class="text-body-small text-on-surface-variant">
        Search and routes come from free public demo services, Photon by komoot
        and FOSSGIS's OSRM servers, used under their fair-use terms. What you
        type and the points you pick are sent to them.
      </p>
    </div>
  );
});

/** A file download from text (an object URL, revoked after the click). */
const download = (name: string, text: string) => {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const StyleTab = component$(() => {
  const state = useContext(mapsContextId);
  const importError = useSignal("");

  const setColor = $((id: StyleGroupId, color: string) => {
    state.overrides = {
      ...state.overrides,
      [id]: { ...state.overrides[id], color },
    };
  });
  const setShown = $((id: StyleGroupId, shown: boolean) => {
    const next = { ...state.overrides[id] };
    if (shown) delete next.hidden;
    else next.hidden = true;
    state.overrides = { ...state.overrides, [id]: next };
  });
  const fromTheme = $(() => {
    const css = getComputedStyle(document.documentElement);
    state.overrides = themeOverrides((name) => css.getPropertyValue(name));
  });
  const reset = $(() => {
    state.overrides = {};
    state.resetSeq++;
  });
  const exportOverrides = $(() =>
    download("map-overrides.json", JSON.stringify(state.overrides, null, 2)),
  );
  // The base style as loaded with the overrides written in: a style Maputnik opens as it is.
  const exportStyle = $(async () => {
    const dark =
      state.style === "dark" ||
      (state.style === "site" &&
        document.documentElement.classList.contains("dark"));
    const name = dark ? "dark" : "positron";
    const response = await fetch(
      `https://tiles.openfreemap.org/styles/${name}`,
    );
    const style = (await response.json()) as StyleSpecification;
    download(
      `map-style-${name}.json`,
      JSON.stringify(applyOverrides(style, state.overrides), null, 2),
    );
  });
  const importOverrides = $(async (_: Event, input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      state.overrides = readOverrides(JSON.parse(await file.text()));
      importError.value = "";
    } catch {
      importError.value = "That file is not overrides JSON.";
    }
  });

  return (
    // Spacing between the panel's parts (placement only; no library component is restyled).
    <div class="grid gap-4">
      <Card.Root variant="filled">
        <Card.Header>
          <Card.Title id="map-style-title">Base map</Card.Title>
          <Card.Description>
            The map's own theme. Follow site uses the site's light or dark mode.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ToggleGroup.Root
            value={state.style}
            onValueChange$={(value) => (state.style = value as MapStyle)}
            aria-labelledby="map-style-title"
          >
            {STYLES.map((option) => (
              <ToggleGroup.Item
                key={option.value}
                value={option.value}
                label={option.label}
              />
            ))}
          </ToggleGroup.Root>
        </Card.Content>
      </Card.Root>
      <List.Root aria-label="Map features">
        {STYLE_GROUPS.map((group) => {
          const override = state.overrides[group.id];
          const color =
            override?.color ?? state.baseColors[group.id] ?? "#808080";
          return (
            <List.Item
              key={group.id}
              headline={group.label}
              supportingText={override?.color ? "Custom color" : "Map's color"}
              start={
                <ColorPicker.Swatch
                  size="sm"
                  label={`${group.label} color`}
                  value={color}
                  onChange$={(hex) => setColor(group.id, hex)}
                />
              }
              end={
                <Switch
                  aria-label={`Show ${group.label}`}
                  checked={!override?.hidden}
                  onChange$={(_, el) => setShown(group.id, el.checked)}
                />
              }
            />
          );
        })}
      </List.Root>
      {/* Action rows (placement only): buttons side by side, wrapping in a narrow pane. */}
      <div class="flex flex-wrap gap-2">
        <Button
          look="tonal"
          label="From theme"
          leadingIcon="palette"
          onClick$={fromTheme}
        />
        <Button
          look="text"
          label="Reset"
          leadingIcon="restart_alt"
          onClick$={reset}
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          look="outlined"
          label="Export overrides"
          leadingIcon="download"
          onClick$={exportOverrides}
        />
        <Button
          look="outlined"
          label="Export full style"
          leadingIcon="download"
          onClick$={exportStyle}
        />
      </div>
      <Files.Root
        name="map-overrides"
        label="Import overrides"
        accept="application/json,.json"
        supportingText="A map-overrides.json from Export overrides"
        error={importError.value || undefined}
        onChange$={importOverrides}
      >
        <Files.Label />
        <Files.Dropzone>
          <Files.Input />
          <Files.Preview />
        </Files.Dropzone>
        <Files.SupportingText />
      </Files.Root>
      <p class="text-body-small text-on-surface-variant">
        Changes stay in this browser. Export full style opens in Maputnik
        (maplibre.org/maputnik).
      </p>
    </div>
  );
});

/** The open Maps panel's content (`which`: the active companion's id). */
export const MapPanel = component$<{ which: MapsCompanionId }>(({ which }) => (
  <>
    {which === "search" && <SearchPanel />}
    {which === "directions" && <DirectionsTab />}
    {which === "style" && <StyleTab />}
    {which === "nodes" && <NodesPanel />}
  </>
));
