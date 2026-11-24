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
    description: "Sean Perez: projects and code.",
    card: "Projects and code",
  },
} satisfies Record<string, PageMeta>;

export type PagePath = keyof typeof PAGES;

/**
 * Part of every card's URL (`?v=`, see `ogImage` in `seo.ts`): link previews (Facebook, X,
 * LinkedIn, Slack) cache an image by its URL. A page's own text is already in the hash; bump
 * this when the card's layout or the theme's colours change.
 */
export const CARD_VERSION = 1;

/** Every card is 1200 x 630, the Open Graph / `summary_large_image` size. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Where a route's card is served: `/` -> `/og/index.png`, `/about/` -> `/og/about.png`. */
export const ogImageSrc = (path: string) =>
  `/og/${path.replace(/^\/|\/$/g, "") || "index"}.png`;
