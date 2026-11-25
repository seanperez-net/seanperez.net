import type { RequestHandler } from "@qwik.dev/router";

/**
 * `/contacts/local/` holds only the visitor's own contacts' pages (`[id]/`); the folder itself is
 * the list of every contact. Not permanent: the list's place may change.
 */
export const onGet: RequestHandler = ({ redirect }) => {
  throw redirect(302, "/contacts/");
};
