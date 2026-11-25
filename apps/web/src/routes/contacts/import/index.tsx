import {
  $,
  component$,
  useComputed$,
  useContext,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";
import { Button, Files, Modal } from "@seanperez/ui";
import {
  contactsListHead,
} from "../../../components/contacts-placeholder";
import {
  ImportError,
  MAX_CONTACTS_PER_FILE,
  MAX_FILE_BYTES,
  decodeFileText,
  detectFormat,
  finishImport,
  type ImportResult,
} from "../../../contacts/imported";
import {
  commit,
  plural,
  SITE_LABELS,
  useContactsSnackbar,
} from "../../../contacts/local-actions";
import {
  addImportedContacts,
  removeAllImported,
  restoreContacts,
} from "../../../contacts/local-book";
import { keepStorage } from "../../../contacts/local-book-store";
import { localBookId } from "../../../contacts/local-context";
import { parseContactsCsv } from "../../../contacts/parse-csv";
import { parseVCards } from "../../../contacts/parse-vcard";
import { IMPORTED_LABEL_ID, contactsListHref } from "../../../content/contacts";

/**
 * `/contacts/import/`: the full list (the layout) with the IMPORT DIALOG open. Google Contacts'
 * Import is a nav button that opens a dialog (measured 2026-11-24: an M3 basic dialog, title, a
 * line of explanation, "Select file", then Import; help answer 15147365); our drawer rows are
 * links, so the dialog has a URL. Closing it (Cancel, Escape, the scrim) goes to `/contacts/`,
 * or to the Imported list after an import.
 *
 * IMPORT IS REAL AND LOCAL (owner, 2026-11-24: "if someone imports it should import but not save
 * it into the db ... save it on their browser but allow it to display"): the file is read and
 * parsed IN THE BROWSER (`contacts/parse-*.ts`), the contacts are kept in this browser only
 * (`contacts/local-book-store.ts`: OPFS, else IndexedDB) and join the list. Nothing is sent to the
 * server: no `routeAction$`, no `server$`, no fetch. So it works the same with the demo layer on
 * or off (until 2026-11-24 "Select file" showed the demo snackbar).
 *
 * The file field is the library's `Files` (`files-input.md`); `accept` is only a hint (a dropped
 * file is not filtered), so size and format are checked again here.
 */
export default component$(() => {
  const open = useSignal(false);
  const nav = useNavigate();
  const { showSnackbar$ } = useContactsSnackbar();
  const state = useContext(localBookId);
  const importedCount = useComputed$(
    () => state.book.value.contacts.filter((c) => c.source === "import").length,
  );

  /** The file read so far: what Import would add. */
  const found = useSignal<ImportResult | null>(null);
  const fileName = useSignal("");
  const error = useSignal("");
  const busy = useSignal(false);
  /** Where closing goes, and the snackbar to show there. */
  const after = useSignal("/contacts/");
  const notice = useSignal("");

  // Opens once the `<dialog>` is in the page, after a client navigation (the drawer row) and
  // after a page load alike. Not a `useTask$`: on a client navigation it runs before the dialog
  // exists, and `Modal.Root` only opens a dialog it holds (tried 2026-11-24: nothing opened). A
  // `<dialog>` can only be opened by script, so this browser-only task is the point of the route.
  // VISIBLE-TASK AUDIT 2026-11-25: KEEP — a <dialog> opens by script after it exists; useTask$ tried (runs before render); later: one open-on-mount option in Modal (docs /core/tasks/)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      open.value = true;
    },
    { strategy: "document-ready" },
  );

  const read$ = $(async (_: Event, input: HTMLInputElement) => {
    found.value = null;
    error.value = "";
    const file = input.files?.[0];
    fileName.value = file?.name ?? "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      error.value = `The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. Split it and import each part.`;
      return;
    }
    if (
      !/\.(csv|vcf|vcard)$/i.test(file.name) &&
      !/(csv|vcard)/i.test(file.type)
    ) {
      error.value = "Choose a CSV (.csv) or vCard (.vcf) file.";
      return;
    }
    try {
      const text = decodeFileText(await file.arrayBuffer());
      const drafts =
        detectFormat(file.name, text) === "vcard"
          ? parseVCards(text)
          : parseContactsCsv(text);
      const result = finishImport(drafts);
      if (!result.contacts.length)
        error.value = "No contacts found in this file.";
      else found.value = result;
    } catch (e) {
      error.value =
        e instanceof ImportError ? e.message : "This file could not be read.";
    }
  });

  const import$ = $(async () => {
    const result = found.value;
    if (!result || busy.value) return;
    busy.value = true;
    try {
      const change = await commit(state, (book, now) => {
        const r = addImportedContacts(
          book,
          result.contacts,
          now,
          () => crypto.randomUUID(),
          SITE_LABELS,
        );
        return { book: r.book, result: r };
      });
      const added = { ...change.result, saved: change.saved };
      // The visitor just saved something they would miss: ask the browser to keep it.
      if (added.added && added.saved) keepStorage();
      notice.value = [
        `Imported ${plural(added.added, "contact", "contacts")}`,
        added.duplicates ? `${added.duplicates} already here` : "",
        added.overCap ? `${added.overCap} over the limit` : "",
        added.saved ? "" : "kept for this visit only",
      ]
        .filter(Boolean)
        .join(", ");
      after.value = contactsListHref(`label/${IMPORTED_LABEL_ID}`);
      open.value = false;
    } finally {
      busy.value = false;
    }
  });

  const removeAll$ = $(async () => {
    const change = await commit(state, (book, now) => {
      const r = removeAllImported(book, now);
      return { book: r.book, result: r.gone };
    });
    const gone = change.result;
    await showSnackbar$({
      message: `Removed ${plural(gone.length, "imported contact", "imported contacts")}`,
      action: "Undo",
      showClose: true,
      onAction$: $(async () => {
        await commit(state, (book, now) => ({
          book: restoreContacts(book, gone, now),
        }));
      }),
    });
  });

  return (
    <>
      <Modal.Root bind:open={open}>
        <Modal.Content
          // Closed by any means: replacing this URL (no dialog in history).
          onClose$={async () => {
            await nav(after.value, { replaceState: true });
            if (notice.value) await showSnackbar$({ message: notice.value });
          }}
        >
          <Modal.Header>
            <Modal.Title>Import contacts</Modal.Title>
            <Modal.Description>
              Choose a CSV or vCard (.vcf) file. The contacts are kept in this
              browser only; nothing is uploaded.
            </Modal.Description>
          </Modal.Header>
          <Modal.Section>
            <div class="grid gap-4">
              <Files.Root
                name="contacts-file"
                label="File"
                accept=".csv,.vcf,text/csv,text/vcard,text/x-vcard"
                supportingText={`CSV or vCard, up to ${MAX_CONTACTS_PER_FILE.toLocaleString("en")} contacts`}
                error={error.value || undefined}
                onChange$={read$}
              >
                <Files.Label />
                <Files.Dropzone>
                  <Files.Input />
                  <Files.Preview prompt="Select file, or drop it here" />
                </Files.Dropzone>
                <Files.SupportingText />
              </Files.Root>
              {found.value && (
                <p
                  class="text-body-medium text-on-surface-variant"
                  role="status"
                >
                  {`Found ${plural(found.value.contacts.length, "contact", "contacts")} in ${fileName.value}.`}
                  {found.value.skipped > 0 &&
                    ` ${plural(found.value.skipped, "entry has", "entries have")} no name, phone or organization and will be skipped.`}
                  {found.value.overLimit > 0 &&
                    ` ${found.value.overLimit} more are over the ${MAX_CONTACTS_PER_FILE.toLocaleString("en")} limit: split the file.`}
                </p>
              )}
              {importedCount.value > 0 && (
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-body-medium text-on-surface-variant">
                    {`${plural(importedCount.value, "contact", "contacts")} imported in this browser.`}
                  </p>
                  <Button
                    look="text"
                    label="Remove all imported"
                    leadingIcon="delete"
                    onClick$={removeAll$}
                  />
                </div>
              )}
            </div>
          </Modal.Section>
          <Modal.Footer>
            <Modal.Close>Cancel</Modal.Close>
            <Button
              look="text"
              label="Import"
              leadingIcon="upload_file"
              disabled={!found.value || busy.value}
              onClick$={import$}
            />
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </>
  );
});

export const head = contactsListHead("import");
