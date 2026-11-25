import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { ContactsPlaceholder } from "../../components/contacts-placeholder";
import { pageHead } from "../../seo";

/**
 * `/contacts/`: every contact (the layout's list). The detail pane shows M3's placeholder until a
 * contact is chosen (2026-11-24: no auto-select any more; M3 list-detail, second agent).
 */
export default component$(() => <ContactsPlaceholder />);

export const head: DocumentHead = ({ url }) => pageHead("/contacts/", url);
