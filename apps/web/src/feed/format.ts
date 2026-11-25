/**
 * A post date for people: "Nov 24, 2026". Fixed locale and UTC so the server's HTML and the
 * browser agree (client-safe: no server imports).
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Type for a post's rendered markdown (plain HTML elements, not library components: there is
 * no M3 "prose" component, and the elements come from micromark). Material 3 type scale tokens
 * only: headings title / headline, body-large text, mono code, primary links.
 */
export const ARTICLE_CLASS = [
  "grid max-w-3xl content-start gap-4 text-body-large text-on-surface",
  "[&_h1]:text-headline-medium [&_h2]:text-headline-small [&_h3]:text-title-large",
  "[&_h4]:text-title-medium [&_h1,&_h2,&_h3]:mt-4",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:ps-6",
  "[&_blockquote]:border-s-4 [&_blockquote]:border-outline-variant [&_blockquote]:ps-4",
  "[&_code]:font-mono [&_code]:text-body-medium",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-container [&_pre]:p-4",
  "[&_img]:max-w-full [&_hr]:border-outline-variant",
].join(" ");
