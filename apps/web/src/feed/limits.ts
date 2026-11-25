/**
 * A post's limits, shared by the editor's fields (client) and the server's checks. Client-safe:
 * a constant from a `.server.ts` file used in a component would pull that module into the
 * client bundle, which the Qwik optimizer refuses (only loader / action BODIES are stripped).
 */

/** Lowercase letters, digits and single hyphens: what a post URL may hold. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG = 80;
export const MAX_TITLE = 200;
export const MAX_BODY = 100_000;
