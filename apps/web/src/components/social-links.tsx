import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { IconButton } from "@seanperez/ui";
import { DEMO } from "../demo/demo";
import { getProfile } from "@seanperez/data/profile/profile.server";
import { BrandMark } from "./brand-mark";

/**
 * The owner's links from his PROFILE (D1 `profile`, edited at /admin/profile), like any app that
 * reads a user's profile, not from the build (owner, 2026-11-24: "get it from the user profile
 * ... even if there is only one user"). The same `getProfile` as /profile/ and the contact
 * profile, so the three show one list. Falls back to `RESUME.links` with no row or a failed read
 * (`profile.server.ts`).
 *
 * Root layout loader (re-exported from `routes/layout.tsx`): the Contact me companion is on every
 * route. Cost: `getProfile` keeps the profile in memory for a minute (one D1 read per isolate per
 * minute); `cacheControl: 60` lets the browser reuse the loader JSON on client navigations for a
 * minute too. `serializationStrategy: "always"`: in the page's HTML, so the panel opening (or an
 * offline page from the service worker) needs no fetch. Only the fields the row draws leave the
 * server.
 */
// Re-exported from routes/layout.tsx (see above).
// eslint-disable-next-line qwik/loader-location
export const useOwnerLinks = routeLoader$(
  async ({ platform }) => {
    // DEMO: the row lives only in the Contact me companion; with the layer off there is none,
    // so the root layout does not read D1 on every page for it.
    if (!DEMO) return [];
    const profile = await getProfile(platform.env.DB);
    return profile.links.map(({ label, href, brand, me }) => ({
      label,
      href,
      brand,
      me,
    }));
  },
  { serializationStrategy: "always", cacheControl: 60 },
);

/**
 * One row of icon links, as most sites show their social profiles (owner, 2026-11-24: "just the
 * icons"). Each is a library `IconButton` link to a new tab: the brand mark (or `link` for an
 * address with none), named "<label> (opens in a new tab)", which is also its plain tooltip.
 * No per-icon external mark: the row of marks is the convention, and the name says where each
 * one goes and that it opens a new tab. `rel="me"` on the owner's profiles (`describeLink`).
 * A `<ul role="list">`: the role survives Safari dropping list semantics under `list-style: none`.
 * Never `mailto:` (`safeLinkHref` allows `https:` only).
 */
export const SocialLinks = component$<{ label?: string }>(
  ({ label = "Elsewhere" }) => {
    const links = useOwnerLinks();
    // Read in JSX, not the body (rule Q12). 8px apart: 40dp buttons with 48dp touch targets.
    return links.value.length === 0 ? null : (
      <ul role="list" aria-label={label} class="flex flex-wrap gap-2">
        {links.value.map((link) => (
          <li key={link.href} class="flex">
            <IconButton
              type="link"
              href={link.href}
              target="_blank"
              rel={link.me ? "me external" : "external"}
              icon={link.brand ? <BrandMark brand={link.brand} /> : "link"}
              label={`${link.label} (opens in a new tab)`}
            />
          </li>
        ))}
      </ul>
    );
  },
);
