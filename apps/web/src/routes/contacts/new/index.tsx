import {
  $,
  component$,
  useContext,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import { useLocation, useNavigate } from "@qwik.dev/router";
import { ContactEditor } from "../../../components/contact-editor";
import {
  contactsListHead,
} from "../../../components/contacts-placeholder";
import {
  BookFullError,
  createContact,
  isLocalLabelId,
  type ContactInput,
} from "../../../contacts/local-book";
import { commit, useContactsSnackbar } from "../../../contacts/local-actions";
import { keepStorage } from "../../../contacts/local-book-store";
import { localBookId, localContactHref } from "../../../contacts/local-context";
import { CONTACT_LABELS } from "../../../content/contacts";

/**
 * `/contacts/new/`: CREATE CONTACT (2026-11-24; Google Contacts' Create contact is a page at
 * `/new`). The full list (the layout) with the editor open; the FAB and the list pane's button
 * link here (`components/app-action.tsx`). Saving creates the contact IN THIS BROWSER
 * (`local-book-store.ts`; no server code) and opens it; closing without saving goes back to
 * `/contacts/`. `?label=<id>` (from a label's list) puts the new contact on that label, as Google
 * does when you create from a label.
 *
 * Until 2026-11-24 the FAB only showed the demo snackbar ("This is a demo account").
 */
export default component$(() => {
  const open = useSignal(false);
  const nav = useNavigate();
  const loc = useLocation();
  const state = useContext(localBookId);
  const { showSnackbar$ } = useContactsSnackbar();
  /** Where closing goes: the new contact after a save. */
  const after = useSignal("/contacts/");

  // As Import: a `<dialog>` opens by script only, once it is in the page (a `useTask$` runs
  // before it exists on a client navigation).
  // VISIBLE-TASK AUDIT 2026-11-25: KEEP — a <dialog> opens by script after it exists; useTask$ tried (runs before render); later: one open-on-mount option in Modal (docs /core/tasks/)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      open.value = true;
    },
    { strategy: "document-ready" },
  );

  const save$ = $(async (input: ContactInput) => {
    const label = loc.url.searchParams.get("label") ?? "";
    const labels =
      isLocalLabelId(label) ||
      CONTACT_LABELS.some((l) => l.id === label && l.id !== "imported")
        ? [label]
        : [];
    try {
      const change = await commit(state, (book, now) => {
        const r = createContact(
          book,
          { ...input, labels },
          crypto.randomUUID(),
          now,
        );
        return { book: r.book, result: r.contact };
      });
      after.value = localContactHref(change.result.id);
      if (change.saved) keepStorage();
      await showSnackbar$({
        message: change.saved
          ? `${change.result.name} created`
          : `${change.result.name} created for this visit only`,
      });
    } catch (e) {
      return e instanceof BookFullError
        ? e.message
        : "This contact could not be saved.";
    }
  });

  return (
    <>
      <ContactEditor
        open={open}
        onSave$={save$}
        onClosed$={$(() => nav(after.value, { replaceState: true }))}
      />
    </>
  );
});

export const head = contactsListHead("new");
