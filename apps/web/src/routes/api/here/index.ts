import type { RequestHandler } from "@qwik.dev/router";
import { readHere } from "../../../here/here.server";

/**
 * `GET /api/here`: where Cloudflare thinks THIS request comes from (`request.cf`, IP geolocation:
 * city level at best, often the ISP's or a VPN's location), as `Here` (`here/here.ts`). The map
 * opens there and Devices places this device there (owner, 2026-11-25: "it should get the
 * geolocation ip etc from the cloudflare and thats how it can load the map and device").
 *
 * PRIVATE to the one visitor, so `Cache-Control: no-store`: the Qwik Cloudflare adapter puts a
 * cookieless GET in its edge cache unless the response says `private` / `no-store` / `no-cache`
 * (`isSharedCacheable`, installed `@qwik.dev/router` 2.0.0-rc.5), and one visitor's city must
 * never be served to another. No Cache API, no service worker copy (`service-worker.ts` does not
 * handle it). Nothing is stored or logged.
 */
export const onGet: RequestHandler = ({ platform, cacheControl, json }) => {
  cacheControl({ noStore: true });
  json(200, readHere(platform));
};
