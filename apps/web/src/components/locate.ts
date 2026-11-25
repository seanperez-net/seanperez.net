import type { LngLat } from "./map-url";

/**
 * One position from the Geolocation API, ONLY when the visitor asks (a "Use my location" press):
 * the browser asks permission first, nothing is tracked or stored. From e-store's
 * `packages/maps/src/components/map-controls.tsx` (its "My location": `getCurrentPosition` with
 * `enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000`, a denied / unavailable
 * message), made a promise so the Location fields and Directions share it.
 *
 * PROOFED 2026-11-24 against MDN `Geolocation.getCurrentPosition()` (secure context only; may be
 * blocked by the `geolocation` Permissions-Policy; prompts when needed; `timeout` defaults to
 * Infinity, so one is set) and `GeolocationPositionError.code` (1 PERMISSION_DENIED,
 * 2 POSITION_UNAVAILABLE, 3 TIMEOUT). A city-level answer is all that is needed, so low accuracy
 * (faster, less power) and a position up to a minute old are fine.
 */
export const LOCATE_TEXT = {
  locating: "Finding your location…",
  denied: "Location permission was not given. Type the place instead.",
  unavailable: "Your location is not available. Type the place instead.",
  timeout: "Finding your location took too long. Try again or type the place.",
  insecure: "Your location needs a secure (https) page.",
} as const;

/** Why a locate failed, as one of the `LOCATE_TEXT` messages. */
export class LocateError extends Error {}

export function locateOnce(): Promise<LngLat> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new LocateError(LOCATE_TEXT.insecure));
      return;
    }
    if (!("geolocation" in navigator)) {
      reject(new LocateError(LOCATE_TEXT.unavailable));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve([position.coords.longitude, position.coords.latitude]),
      (error) =>
        reject(
          new LocateError(
            error.code === 1
              ? LOCATE_TEXT.denied
              : error.code === 3
                ? LOCATE_TEXT.timeout
                : LOCATE_TEXT.unavailable,
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
