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

/** What Devices says when precise location fails (no "type the place": there is no field). */
export const PRECISE_TEXT = {
  denied:
    "Location permission was not given. This device stays on its approximate location.",
  unavailable:
    "Your precise location is not available. This device stays on its approximate location.",
  timeout: "Finding your precise location took too long. Try again.",
  insecure: "Precise location needs a secure (https) page.",
} as const;

/** A fresh, precise position and its accuracy (metres, 95% confidence per the spec). */
export type PrecisePosition = { lngLat: LngLat; accuracy: number };

/**
 * Devices' "Use precise location" (2026-11-25): ONE fresh, high-accuracy position, only from that
 * click (never on load). Same MDN reading as `locateOnce` (above); here `enableHighAccuracy: true`
 * (GPS where there is one) and `maximumAge: 0` (MDN: forces a fresh reading), and the
 * `coords.accuracy` in metres. Rejects with a `LocateError` carrying a `PRECISE_TEXT` message.
 */
export function locatePrecise(): Promise<PrecisePosition> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new LocateError(PRECISE_TEXT.insecure));
      return;
    }
    if (!("geolocation" in navigator)) {
      reject(new LocateError(PRECISE_TEXT.unavailable));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lngLat: [position.coords.longitude, position.coords.latitude],
          accuracy: position.coords.accuracy,
        }),
      (error) =>
        reject(
          new LocateError(
            error.code === 1
              ? PRECISE_TEXT.denied
              : error.code === 3
                ? PRECISE_TEXT.timeout
                : PRECISE_TEXT.unavailable,
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
