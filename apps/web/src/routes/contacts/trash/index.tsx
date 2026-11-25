import { component$ } from "@qwik.dev/core";
import {
  ContactsPlaceholder,
  contactsListHead,
} from "../../../components/contacts-placeholder";

/** `/contacts/trash/`: the layout lists it (`content/contacts.ts` `CONTACTS_LISTS`); the detail pane rests. */
export default component$(() => <ContactsPlaceholder />);

export const head = contactsListHead("trash");
