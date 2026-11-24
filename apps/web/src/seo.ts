import type { DocumentHeadValue } from "@qwik.dev/router";
import {
  CARD_VERSION,
  OG_HEIGHT,
  OG_WIDTH,
  PAGES,
  SITE_NAME,
  ogImageSrc,
  type PageMeta,
  type PagePath,
} from "./pages";

/**
 * Open Graph and search tags for a route's `head`. The pattern is e-store's `buildPageHead`
 * (`packages/storefront/src/pages/seo.ts`): one function, every tag keyed so a route's tags
 * replace earlier ones with the same key instead of being added beside them (router
 * `head.qwik.mjs`), `og:url` without the query string, an absolute image URL, `twitter:card` as
 * `name=`. Smaller than e-store's (no JSON-LD). The tag set adds `og:site_name`, `og:locale` and
 * the `og:image:*` details ogp.me asks for (e-store's has no `og:image:alt`).
 *
 * Images: every route in `PAGES` (`pages.ts`) has its own card, drawn with satori by
 * `scripts/og.ts` at build time into `public/og/`. They are static files, never drawn on request
 * (Workers Free has 10 ms of CPU per request; e-store's renderer needs Workers Paid). A page
 * that passes no image gets `SITE.image`, the home page's card.
 */
export const SITE: {
  name: string;
  locale: string;
  image?: { src: string; alt: string; width: number; height: number };
} = {
  name: SITE_NAME,
  locale: "en_US",
  image: ogImage("/"),
};

/** FNV-1a, as hex: a short version stamp for a card's URL, not a security hash. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * A route's own card: the PNG `scripts/og.ts` draws from its `PAGES` entry. The `?v=` changes
 * whenever the card's text or `CARD_VERSION` does, so link previews fetch the new image (the
 * idea of e-store's content-hashed card keys; the static file ignores the query).
 */
function ogImage(path: PagePath) {
  const page: PageMeta = PAGES[path];
  const text = page.card ?? page.description;
  return {
    src: `${ogImageSrc(path)}?v=${hash(`${CARD_VERSION}|${page.title}|${text}`)}`,
    alt: `${page.title}: ${text}`,
    width: OG_WIDTH,
    height: OG_HEIGHT,
  };
}

/** The `head` of a route listed in `PAGES`: its title, description and own card. */
export function pageHead(path: PagePath, url: URL): DocumentHeadValue {
  const { title, description } = PAGES[path];
  return seoHead({ title, description, url, image: ogImage(path) });
}

export interface SeoInput {
  title: string;
  description: string;
  /** The page's URL: `url` from the route's `head` function. */
  url: URL;
  /** A page's own image (from the CMS later); otherwise the site image. */
  image?: { src: string; alt: string; width?: number; height?: number };
  type?: "website" | "article";
}

const tag = (property: string, content: string) => ({
  property,
  content,
  key: property,
});

export function seoHead({
  title,
  description,
  url,
  image = SITE.image,
  type = "website",
}: SeoInput): DocumentHeadValue {
  const imageTags = image
    ? [
        tag("og:image", new URL(image.src, url.origin).href),
        tag("og:image:alt", image.alt),
        ...(image.width && image.height
          ? [
              tag("og:image:width", String(image.width)),
              tag("og:image:height", String(image.height)),
            ]
          : []),
      ]
    : [];
  return {
    title,
    meta: [
      { name: "description", content: description, key: "description" },
      tag("og:type", type),
      tag("og:site_name", SITE.name),
      tag("og:locale", SITE.locale),
      tag("og:url", url.origin + url.pathname),
      tag("og:title", title),
      tag("og:description", description),
      ...imageTags,
      {
        name: "twitter:card",
        content: image ? "summary_large_image" : "summary",
        key: "twitter:card",
      },
    ],
  };
}
