import { component$ } from "@qwik.dev/core";
import type { RequestHandler } from "@qwik.dev/router";
import { WIP } from "../../../demo/wip";
import {
  ContactsPlaceholder,
  contactsListHead,
} from "../../../components/contacts-placeholder";

/** `/contacts/other/`: the layout lists it (`content/contacts.ts` `CONTACTS_LISTS`); the detail pane rests. */
// WIP: nothing fills "Other contacts" yet (release switch, `demo/wip.ts`): a 404 in production
// builds, and no drawer row (`content/contacts.ts`).
export const onGet: RequestHandler = ({ error }) => {
  if (!WIP) throw error(404, "Not found");
};

export default component$(() => <ContactsPlaceholder />);

export const head = contactsListHead("other");
