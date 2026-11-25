import type { RequestHandler } from "@qwik.dev/router";
import { search } from "../../../search/search.server";
import { parseScope } from "../../../search/types";

/**
 * `GET /api/search?q=&in=`: the app bar search's results as JSON (`SearchResults`). An endpoint
 * (only `onGet`), not `server$`: `server$` is a POST, which caches nowhere and goes through
 * `checkOrigin`; the GET can be cached a minute by the browser (the query is the cache key).
 * The `/search/` route calls the same `search()` for the page.
 */
export const onGet: RequestHandler = async ({
  platform,
  url,
  json,
  cacheControl,
}) => {
  const results = await search(
    platform.env.DB,
    url.searchParams.get("q") ?? "",
    parseScope(url.searchParams.get("in")),
  );
  cacheControl({ maxAge: 60, public: true });
  json(200, results);
};
