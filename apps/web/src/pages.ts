/**
 * Every route's title and description, in one place. Two readers: the route's `head` (through
 * `pageHead` in `seo.ts`) and the build script that draws each route's Open Graph card
 * (`scripts/og.ts`, run by the root `pnpm build`). Both read this list, so a page's tags and its
 * card cannot drift apart. A new route adds its entry here and calls `pageHead("/its/path/", url)`.
 *
 * Plain data with no imports: Node runs `scripts/og.ts` with its own type stripping, which
 * imports this file directly.
 */
/** The site's name and host, drawn on every card (and `SITE.name` in `seo.ts`). */
export const SITE_NAME = "Sean Perez";
export const SITE_HOST = "seanperez.net";

export interface PageMeta {
  title: string;
  description: string;
  /** The card's line under the title; defaults to `description`. */
  card?: string;
}

export const PAGES = {
  "/": {
    title: "Sean Perez",
    // Home is the feed (owner, 2026-11-24).
    description: "Sean Perez: posts, projects and code.",
    card: "Feed",
  },
  "/maps/": {
    title: "Maps · Sean Perez",
    description:
      "A map app built with Qwik and MapLibre on Sean Perez's Layout.",
    card: "Maps: Qwik and MapLibre",
  },
  "/search/": {
    title: "Search · Sean Perez",
    description: "Search Sean Perez's posts, projects and pages.",
    card: "Search",
  },
  "/profile/": {
    title: "Profile · Sean Perez",
    // The VISITOR's own profile since 2026-11-25 (`visitor-is-guest-you`), not the owner's.
    description:
      "Your profile on this site: a name, a headline and a bio, kept in your browser.",
    card: "Profile",
  },
  "/devices/": {
    title: "Devices · Sean Perez",
    description:
      "Demo devices: LoRa, Wi-Fi, a truck, a drone and a boat on the map.",
    card: "Devices",
  },
  "/contacts/": {
    title: "Contacts · Sean Perez",
    description:
      "Contacts: Sean Perez's profile, résumé and projects, and a message form.",
    card: "Contacts",
  },
  // The Messages app (owner, 2026-11-24): demo conversations; one card for every thread.
  "/messages/": {
    title: "Messages · Sean Perez",
    description:
      "A messages app built with Qwik: demo conversations with devices and an assistant.",
    card: "Messages",
  },
  // The owner's contact profile: the résumé that was /about/ (301 there, owner 2026-11-24).
  "/contacts/sean-perez/": {
    title: "Sean Perez · Contacts",
    description: "Sean Perez: profile, résumé, projects and links.",
    card: "Contact: Sean Perez",
  },
} satisfies Record<string, PageMeta>;

export type PagePath = keyof typeof PAGES;

/**
 * Part of every card's URL (`?v=`, see `ogImage` in `seo.ts`): link previews (Facebook, X,
 * LinkedIn, Slack) cache an image by its URL. A page's own text is already in the hash; bump
 * this when the card's layout or the theme's colors change.
 */
export const CARD_VERSION = 1;

/** Every card is 1200 x 630, the Open Graph / `summary_large_image` size. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Where a route's card is served: `/` -> `/og/index.png`, `/contacts/sean-perez/` -> `/og/contacts/sean-perez.png`. */
export const ogImageSrc = (path: string) =>
  `/og/${path.replace(/^\/|\/$/g, "") || "index"}.png`;
