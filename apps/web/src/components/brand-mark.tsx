import { component$ } from "@qwik.dev/core";
import {
  BlueskyIcon,
  GithubIcon,
  InstagramIcon,
  MastodonIcon,
  XIcon,
  YoutubeIcon,
} from "@seanperez/ui";
import type { SocialBrand } from "@seanperez/data/profile/profile";

const MARKS = {
  github: GithubIcon,
  x: XIcon,
  bluesky: BlueskyIcon,
  mastodon: MastodonIcon,
  youtube: YoutubeIcon,
  instagram: InstagramIcon,
} as const satisfies Record<SocialBrand, unknown>;

/**
 * A profile link's brand mark (`profile.ts` `brandFor`), always decorative: the link around it
 * is named by its label. Sized and colored by its box (`IconButton` / `List.Item` `start`).
 */
export const BrandMark = component$<{ brand: SocialBrand }>(({ brand }) => {
  const Mark = MARKS[brand];
  return <Mark aria-hidden="true" width={24} height={24} fill="currentColor" />;
});
