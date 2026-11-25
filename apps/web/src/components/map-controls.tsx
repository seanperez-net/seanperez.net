import { component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import type { NoSerialize, Signal } from "@qwik.dev/core";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Toolbar } from "@seanperez/ui";
import type { IconName } from "@seanperez/ui";
import { LOCATE_TEXT, LocateError, locateOnce } from "./locate";

export type MapControlsProps = {
  /** The MapLibre map (`MapView`'s `mapRef`), browser only. */
  map: Signal<NoSerialize<MapLibreMap>>;
  /** The element that goes full screen: the map AND these controls (`MapView`'s wrapper). */
  fullscreenTarget: Signal<HTMLElement | undefined>;
  /** Zoom set when "my location" succeeds (e-store's `locateZoom`). */
  locateZoom?: number;
  zoomInIcon?: IconName;
  zoomOutIcon?: IconName;
  compassIcon?: IconName;
  locateIcon?: IconName;
  enterFullscreenIcon?: IconName;
  exitFullscreenIcon?: IconName;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  compassLabel?: string;
  locateLabel?: string;
  enterFullscreenLabel?: string;
  exitFullscreenLabel?: string;
  groupLabel?: string;
  /** Announced in `role="status"` once the map has moved there. */
  locatedText?: string;
};

/**
 * The floating map controls: zoom in and out, reset north (only while the map is rotated), my
 * location, full screen. Ported 2026-11-24 from e-store's `packages/maps/src/components/
 * map-controls.tsx` (same items, labels, icon props, the compass shown only while rotated, zoom
 * disabled at its limits, the locate result in `role="status"`), on OUR vertical floating
 * `Toolbar` (owner, 2026-11-24: "follow our segmented buttons or tool bar for the map") instead of
 * e-store's `IconButton look="elevated"` stack: our IconButton has no elevated look, and our
 * Toolbar has the vertical floating form e-store's lacked (e-store `research/maps.google.com/
 * README.md` "Floating map controls": "Toolbar is horizontal-only ... so compose a vertical
 * group"). They replace MapLibre's NavigationControl, GeolocateControl and FullscreenControl.
 *
 * - Zoom / north: MapLibre's `zoomIn`, `zoomOut`, `resetNorthPitch`, `getMinZoom`, `getMaxZoom`,
 *   `getBearing`, `getPitch` (maplibre-gl 6.19.0 `src/ui/map.ts`, `camera.ts`); they respect
 *   reduced motion as MapLibre's own controls do. Rotating is the map's (right-drag, two
 *   fingers, Shift + arrows); MapLibre's compass also rotated by dragging, this one resets.
 * - My location: `locateOnce` (`locate.ts`, e-store's `getCurrentPosition` options), one
 *   position on request, nothing tracked, no dot drawn.
 * - Full screen: the Fullscreen API on the map's wrapper, where the browser allows it; else
 *   (iPhone Safari, an iframe without `allow="fullscreen"`) a pseudo full screen as MapLibre's
 *   `pseudo` option did (`data-map-fullscreen="pseudo"`, `map-view.css`), left with the button or
 *   Escape. The click is a NATIVE listener (as our `FullscreenButton`): `requestFullscreen()`
 *   needs the click's transient activation, which a lazily loaded `$()` can outlive. The state
 *   comes back from `fullscreenchange`, never from the click. The name says what a click does
 *   ("Full screen" / "Exit full screen", as MapLibre's control); no `aria-pressed`.
 */
export const MapControls = component$<MapControlsProps>(
  ({
    map,
    fullscreenTarget,
    locateZoom = 15,
    zoomInIcon = "add",
    zoomOutIcon = "remove",
    compassIcon = "explore",
    locateIcon = "my_location",
    enterFullscreenIcon = "fullscreen",
    exitFullscreenIcon = "fullscreen_exit",
    zoomInLabel = "Zoom in",
    zoomOutLabel = "Zoom out",
    compassLabel = "Reset to north",
    locateLabel = "Show your location",
    enterFullscreenLabel = "Full screen",
    exitFullscreenLabel = "Exit full screen",
    groupLabel = "Map controls",
    locatedText = "Showing your location",
  }) => {
    const atMin = useSignal(false);
    const atMax = useSignal(false);
    const rotated = useSignal(false);
    const fullscreen = useSignal(false);
    const locating = useSignal(false);
    const status = useSignal("");

    // The camera's limits and rotation, from the map's own events (set only on a change, so a
    // pan or zoom does not re-render the toolbar every frame).
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track, cleanup }) => {
      const m = track(() => map.value);
      if (!m) return;
      const read = () => {
        const zoom = m.getZoom();
        atMin.value = zoom <= m.getMinZoom();
        atMax.value = zoom >= m.getMaxZoom();
        rotated.value =
          Math.abs(m.getBearing()) > 0.5 || Math.abs(m.getPitch()) > 0.5;
      };
      read();
      m.on("zoom", read);
      m.on("rotate", read);
      m.on("pitch", read);
      cleanup(() => {
        m.off("zoom", read);
        m.off("rotate", read);
        m.off("pitch", read);
      });
    });

    // Full screen: a native click listener and the document's `fullscreenchange`.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track, cleanup }) => {
      const target = track(() => fullscreenTarget.value);
      const button = target?.querySelector("[data-map-fullscreen-button]");
      if (!target || !button) return;
      const doc = target.ownerDocument;
      const native =
        typeof target.requestFullscreen === "function" && doc.fullscreenEnabled;
      const pseudo = (on: boolean) => {
        if (on) target.setAttribute("data-map-fullscreen", "pseudo");
        else target.removeAttribute("data-map-fullscreen");
        fullscreen.value = on;
        map.value?.resize();
      };
      const onClick = () => {
        if (!native) {
          pseudo(!target.hasAttribute("data-map-fullscreen"));
          return;
        }
        // A refusal changes nothing: the state is read from `fullscreenchange`.
        if (doc.fullscreenElement === target)
          void doc.exitFullscreen().catch(() => undefined);
        else void target.requestFullscreen().catch(() => undefined);
      };
      const onChange = () => {
        fullscreen.value = doc.fullscreenElement === target;
      };
      // Escape leaves the pseudo full screen too (the real one: the browser's).
      const onKey = (event: KeyboardEvent) => {
        if (
          event.key === "Escape" &&
          target.hasAttribute("data-map-fullscreen")
        )
          pseudo(false);
      };
      button.addEventListener("click", onClick);
      doc.addEventListener("fullscreenchange", onChange);
      doc.addEventListener("keydown", onKey);
      cleanup(() => {
        button.removeEventListener("click", onClick);
        doc.removeEventListener("fullscreenchange", onChange);
        doc.removeEventListener("keydown", onKey);
        if (target.hasAttribute("data-map-fullscreen")) pseudo(false);
      });
    });

    return (
      <div class="flex flex-col items-end" data-map-controls="">
        <Toolbar.Root
          aria-label={groupLabel}
          variant="floating"
          orientation="vertical"
        >
          <Toolbar.Item
            icon={zoomInIcon}
            label={zoomInLabel}
            disabled={atMax.value}
            onClick$={() => map.value?.zoomIn()}
          />
          <Toolbar.Item
            icon={zoomOutIcon}
            label={zoomOutLabel}
            disabled={atMin.value}
            onClick$={() => map.value?.zoomOut()}
          />
          {rotated.value && (
            <Toolbar.Item
              icon={compassIcon}
              label={compassLabel}
              onClick$={() => map.value?.resetNorthPitch()}
            />
          )}
          <Toolbar.Divider />
          <Toolbar.Item
            icon={locateIcon}
            label={locateLabel}
            aria-busy={locating.value ? "true" : undefined}
            onClick$={async () => {
              locating.value = true;
              status.value = LOCATE_TEXT.locating;
              try {
                const center = await locateOnce();
                const m = map.value;
                m?.flyTo({ center, zoom: Math.max(m.getZoom(), locateZoom) });
                status.value = locatedText;
              } catch (error) {
                status.value =
                  error instanceof LocateError
                    ? error.message
                    : LOCATE_TEXT.unavailable;
              } finally {
                locating.value = false;
              }
            }}
          />
          <Toolbar.Item
            data-map-fullscreen-button=""
            icon={fullscreen.value ? exitFullscreenIcon : enterFullscreenIcon}
            label={
              fullscreen.value ? exitFullscreenLabel : enterFullscreenLabel
            }
          />
        </Toolbar.Root>
        <p role="status" class="sr-only">
          {status.value}
        </p>
      </div>
    );
  },
);
