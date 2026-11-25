/**
 * The owner's public profile as the pages see it (client-safe types and the link check).
 * Read on the server by `profile.server.ts`; drawn by `/profile/`; edited at `/admin/profile`.
 * NO email anywhere (owner 2026-11-24: spam): there is no email field.
 */
import { PROFILE_MAX } from "./limits.ts";

export interface ProfileLink {
  label: string;
  href: string;
  /** The line under the label: the address without `https://`. */
  detail: string;
  /** The service the address is a profile on (`brandFor`): its mark is shown. */
  brand?: SocialBrand;
  /** `rel="me"`: the owner's own profile elsewhere. */
  me?: boolean;
}
import type { PublicProfileSection } from "./profile-sections.ts";

export interface Profile {
  name: string;
  /** One line under the name, e.g. a job title. Empty: not shown. */
  headline: string;
  /** Empty: not shown. */
  location: string;
  /** Plain text (no markdown, no HTML). */
  bio: string;
  links: ProfileLink[];
  /**
   * Work, Education, Skills, ... (2026-11-25): the owner's D1 profile only, hidden parts already
   * removed on the server (`profile.server.ts`). Absent on a visitor's own profile.
   */
  sections?: PublicProfileSection[];
}

/**
 * A link the profile may show: `https:` only (2026-11-24, social icon row; was http(s)), so no
 * `http:`, `javascript:`, `data:`, and no `mailto:` by the no-email rule. Parsed with `URL`, no
 * user name or password in it. Returns the normalised address or null.
 */
export function safeLinkHref(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > PROFILE_MAX.linkHref) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** "https://github.com/x/" -> "github.com/x": what people would type. */
export const linkDetail = (href: string) =>
  href.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** The services with a mark (`@seanperez/ui` `media/brands.tsx`; `components/brand-mark.tsx`). */
export type SocialBrand =
  | "github"
  | "x"
  | "bluesky"
  | "mastodon"
  | "youtube"
  | "instagram";

/**
 * Host -> service. A host matches itself and its subdomains (`www.`, `m.`), never by "contains".
 * Mastodon has no one host: the largest instances are listed, any other instance gets the
 * generic `link` icon (a handle cannot be recognised from its host; second agent, 2026-11-24).
 * LinkedIn is not here: it gets `rel="me"` (`describeLink`) but the generic icon, until the owner
 * downloads LinkedIn's own asset (see `@seanperez/ui` `media/brands.tsx`).
 */
const BRAND_HOSTS: Record<string, SocialBrand> = {
  "github.com": "github",
  "x.com": "x",
  "twitter.com": "x",
  "bsky.app": "bluesky",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "instagram.com": "instagram",
  "mastodon.social": "mastodon",
  "mastodon.online": "mastodon",
  "mstdn.social": "mastodon",
  "hachyderm.io": "mastodon",
  "fosstodon.org": "mastodon",
  "infosec.exchange": "mastodon",
};

const hostIs = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

/**
 * The service a link is a PROFILE on, from its host, or undefined. A GitHub address is a profile
 * only with one path segment (`github.com/<user>`): a repo keeps the generic icon and no `me`.
 */
export function brandFor(href: string): SocialBrand | undefined {
  const url = new URL(href);
  const host = url.hostname.toLowerCase();
  const domain = Object.keys(BRAND_HOSTS).find((d) => hostIs(host, d));
  if (!domain) return undefined;
  const brand = BRAND_HOSTS[domain];
  if (
    brand === "github" &&
    url.pathname.split("/").filter(Boolean).length !== 1
  )
    return undefined;
  return brand;
}

/**
 * A link's mark and `rel="me"` (the owner's own profile elsewhere, for IndieWeb / Mastodon
 * verification): both for a recognised profile (`brandFor`, LinkedIn too); any other address (a
 * repo, a project) the `link` icon and no `me`.
 */
export function describeLink(label: string, href: string): ProfileLink {
  const brand = brandFor(href);
  const linkedin = hostIs(new URL(href).hostname.toLowerCase(), "linkedin.com");
  return {
    label,
    href,
    detail: linkDetail(href),
    ...(brand ? { brand } : {}),
    ...(brand || linkedin ? { me: true } : {}),
  };
}
