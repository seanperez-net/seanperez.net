import type { RequestHandler } from "@qwik.dev/router";
import { contactHref, DEFAULT_CONTACT_ID } from "../../content/contacts";

/**
 * `/about/` was the résumé (2026-11-24); it is now the owner's contact profile in the Contacts
 * app (owner, 2026-11-24: "change about to contacts"). Moved permanently, so old links and
 * search engines follow; a `#resume-...` fragment is kept by the browser (the sections keep
 * their ids). To the profile rather than `/contacts/`: on a phone `/contacts/` is only the list.
 */
export const onGet: RequestHandler = ({ redirect }) => {
  throw redirect(301, contactHref(DEFAULT_CONTACT_ID));
};
