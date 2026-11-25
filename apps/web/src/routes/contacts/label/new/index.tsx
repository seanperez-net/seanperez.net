import {
  $,
  component$,
  useContext,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";
import { LabelNameDialog } from "../../../../components/contacts-dialogs";
import {
  contactsListHead,
} from "../../../../components/contacts-placeholder";
import {
  LOCAL_LABEL_PREFIX,
  LabelError,
  createLabel,
  labelNameTaken,
} from "../../../../contacts/local-book";
import {
  commit,
  useContactsSnackbar,
} from "../../../../contacts/local-actions";
import { localBookId } from "../../../../contacts/local-context";
import { CONTACT_LABELS, contactsListHref } from "../../../../content/contacts";

/**
 * `/contacts/label/new/`: CREATE LABEL (2026-11-24). Google's "+" beside the Labels heading opens
 * a dialog (a name, Cancel, Save; help answer 30970). Our drawer's group header holds no control,
 * so the drawer's last Labels row links here (`content/contacts.ts`) and the dialog opens over the
 * full list, as Import. `label/new` is a static folder, so it wins over `label/[label]`. The label
 * is kept in THIS browser (`local-book-store.ts`), shown in the drawer, and its (empty) list opens.
 */
export default component$(() => {
  const open = useSignal(false);
  const nav = useNavigate();
  const state = useContext(localBookId);
  const { showSnackbar$ } = useContactsSnackbar();
  const after = useSignal("/contacts/");

  // VISIBLE-TASK AUDIT 2026-11-25: KEEP — a <dialog> opens by script after it exists; useTask$ tried (runs before render); later: one open-on-mount option in Modal (docs /core/tasks/)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      open.value = true;
    },
    { strategy: "document-ready" },
  );

  const save$ = $(async (name: string) => {
    const taken = [...CONTACT_LABELS, ...state.book.value.labels].map(
      (l) => l.name,
    );
    if (labelNameTaken(name, taken))
      return "A label with this name already exists";
    try {
      const change = await commit(state, (book, now) => {
        const r = createLabel(
          book,
          name,
          LOCAL_LABEL_PREFIX + crypto.randomUUID(),
          now,
        );
        return { book: r.book, result: r.label };
      });
      after.value = contactsListHref(`label/${change.result.id}`);
      await showSnackbar$({ message: `Label “${change.result.name}” created` });
    } catch (e) {
      return e instanceof LabelError
        ? e.message
        : "This label could not be saved.";
    }
  });

  return (
    <>
      <LabelNameDialog
        open={open}
        title="Create label"
        onSave$={save$}
        onClosed$={$(() => nav(after.value, { replaceState: true }))}
      />
    </>
  );
});

export const head = contactsListHead("label/new");
