import {
  $,
  component$,
  sync$,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";
import type { QRL, Signal } from "@qwik.dev/core";
import { Button, Icon, IconButton, Modal, TextField } from "@seanperez/ui";
import type { IconName } from "@seanperez/ui";
import { MAX_FIELD, MAX_NOTES, MAX_VALUES } from "../contacts/imported";
import {
  validateContactInput,
  type ContactErrors,
  type ContactInput,
  type LocalContact,
} from "../contacts/local-book";

interface ValueRow {
  key: number;
  label: string;
  value: string;
}

export interface FormState {
  name: string;
  organization: string;
  title: string;
  notes: string;
  phones: ValueRow[];
  emails: ValueRow[];
  nextKey: number;
  errors: ContactErrors;
  submitted: boolean;
  busy: boolean;
  /** A save that failed in the store (a full book). */
  failure: string;
}

/** One empty row, so a new contact shows a Phone and an Email field (Google's form). */
const rowsFrom = (values: { label: string; value: string }[] | undefined) =>
  (values?.length ? values : [{ label: "", value: "" }]).map((v, i) => ({
    key: i,
    label: v.label,
    value: v.value,
  }));

const inputFrom = (form: FormState): ContactInput => ({
  name: form.name,
  organization: form.organization,
  title: form.title,
  notes: form.notes,
  phones: form.phones.map(({ label, value }) => ({ label, value })),
  emails: form.emails.map(({ label, value }) => ({ label, value })),
});

export interface ContactEditorProps {
  /** Open state. The editor closes itself after a save, on Cancel and on Escape. */
  open: Signal<boolean>;
  /** The contact to edit; none to create one. Read each time the editor opens. */
  contact?: LocalContact | null;
  /**
   * Saves the input (the store cleans it). Resolves an error message to keep the dialog open
   * with it, or nothing when saved.
   */
  onSave$: QRL<(input: ContactInput) => Promise<string | void>>;
  /** After the dialog closed by any means (a route-opened editor navigates away). */
  onClosed$?: QRL<() => void>;
  createTitle?: string;
  editTitle?: string;
  saveLabel?: string;
  cancelLabel?: string;
  addPhoneLabel?: string;
  addEmailLabel?: string;
  removeLabel?: string;
}

/**
 * Create or edit one of the visitor's OWN contacts (2026-11-24), saved in their browser
 * (`local-book-store.ts`). PORTED from e-store's `ContactEditor`
 * (`packages/contacts/src/components/contact-editor.tsx`): a real `<form>` with
 * `preventdefault:submit` (Enter saves), the form re-seeded each time it opens, validation on
 * submit and then as you type, rows added and removed (e-store's address rows). Differs, and why:
 * - `Modal position="adaptive"` (ours; full-screen dialog below 600px, basic from 600px, M3 "form
 *   fields ... use a full-screen dialog" on compact), with the bar AND the footer, as
 *   `profile-edit.tsx`; e-store sets `class="w-full max-w-md"` on `Modal.Content` (our rule:
 *   no class on library components);
 * - several phones and emails (our contacts hold up to 10 of each, from imports), one field per
 *   value with a remove button; e-store has one phone and one email, plus addresses (ours none);
 * - Company / Job title / Notes as e-store; no photo URL (our contacts have none);
 * - no Delete in the dialog (the contact page has Delete beside Edit; e-store offers both).
 * `autocomplete="off"` on the form: the fields are SOMEONE ELSE's details, the browser must not
 * offer the visitor's own (as the profile dialog).
 */
/** A fresh form store (the dialog and the page editor each hold one). */
export const emptyForm = (): FormState => ({
  name: "",
  organization: "",
  title: "",
  notes: "",
  phones: rowsFrom(undefined),
  emails: rowsFrom(undefined),
  nextKey: 1,
  errors: {},
  submitted: false,
  busy: false,
  failure: "",
});

/** Fills `form` from `contact` (or clears it): every open of the dialog, the page form once. */
export function seedForm(form: FormState, contact?: LocalContact | null) {
  form.name = contact?.name ?? "";
  form.organization = contact?.organization ?? "";
  form.title = contact?.title ?? "";
  form.notes = contact?.notes ?? "";
  form.phones = rowsFrom(contact?.phones);
  form.emails = rowsFrom(contact?.emails);
  form.nextKey = form.phones.length + form.emails.length;
  form.errors = {};
  form.submitted = false;
  form.busy = false;
  form.failure = "";
}

/** The values a save compares (the page editor's Save is enabled once they differ). */
export const formSnapshot = (form: FormState) => {
  const input = inputFrom(form);
  const values = (v: { label: string; value: string }[]) =>
    v.filter((x) => x.value.trim()).map((x) => [x.label, x.value.trim()]);
  return JSON.stringify([
    input.name.trim(),
    input.organization.trim(),
    input.title.trim(),
    input.notes.trim(),
    values(input.phones),
    values(input.emails),
  ]);
};

export interface ContactFieldsProps {
  form: FormState;
  /**
   * `dialog` (the Create contact dialog): one column. `page` (the person page's edit view,
   * Google Contacts' edit form, measured 2026-11-24): each group has its icon in a start column
   * (person, company, email, phone, notes), the fields beside it.
   */
  look?: "dialog" | "page";
  addPhoneLabel?: string;
  addEmailLabel?: string;
  removeLabel?: string;
  /** Focus the Name field when shown (a form dialog or edit view opens on its first field). */
  autofocus?: boolean;
}

/** The form's fields, for both editors (`ContactEditor`, `ContactEditForm`). */
export const ContactFields = component$<ContactFieldsProps>(
  ({
    form,
    look = "dialog",
    addPhoneLabel = "Add phone",
    addEmailLabel = "Add email",
    removeLabel = "Remove",
    autofocus = true,
  }) => {
    const revalidate = $(() => {
      if (form.submitted) form.errors = validateContactInput(inputFrom(form));
    });

    const rows = (kind: "phones" | "emails") => (
      <div class="grid gap-2">
        {form[kind].map((row, index) => (
          <div key={row.key} class="flex items-start gap-1">
            <div class="min-w-0 flex-1">
              <TextField
                name={kind === "phones" ? "contact-phone" : "contact-email"}
                type={kind === "phones" ? "tel" : "email"}
                label={
                  (kind === "phones" ? "Phone" : "Email") +
                  (row.label ? ` (${row.label})` : "")
                }
                maxLength={200}
                value={row.value}
                // The first wrong value carries the message.
                error={
                  index === 0 && form.errors[kind]
                    ? form.errors[kind]
                    : undefined
                }
                onInput$={(_, el) => {
                  form[kind] = form[kind].map((r, i) =>
                    i === index ? { ...r, value: el.value } : r,
                  );
                  void revalidate();
                }}
              />
            </div>
            {/* The field's own row action (no primitive holds a field and a button). */}
            <div class="pt-2">
              <IconButton
                icon="close"
                label={`${removeLabel} ${kind === "phones" ? "phone" : "email"} ${index + 1}`}
                onClick$={() => {
                  const next = form[kind].filter((_, i) => i !== index);
                  form[kind] = next.length
                    ? next
                    : [{ key: form.nextKey++, label: "", value: "" }];
                  void revalidate();
                }}
              />
            </div>
          </div>
        ))}
        <div>
          <Button
            look="text"
            size="xs"
            leadingIcon="add"
            label={kind === "phones" ? addPhoneLabel : addEmailLabel}
            disabled={form[kind].length >= MAX_VALUES}
            onClick$={() => {
              form[kind] = [
                ...form[kind],
                { key: form.nextKey++, label: "", value: "" },
              ];
            }}
          />
        </div>
      </div>
    );

    const name = (
      <TextField
        name="contact-name"
        label="Name"
        // A form opens on its first field (memory focus-first-field-on-open).
        autofocus={autofocus}
        maxLength={MAX_FIELD}
        value={form.name}
        error={form.errors.name}
        onInput$={(_, el) => {
          form.name = el.value;
          void revalidate();
        }}
      />
    );
    const company = (
      <TextField
        name="contact-organization"
        label="Company"
        maxLength={MAX_FIELD}
        value={form.organization}
        onInput$={(_, el) => {
          form.organization = el.value;
          void revalidate();
        }}
      />
    );
    const jobTitle = (
      <TextField
        name="contact-title"
        label="Job title"
        maxLength={MAX_FIELD}
        value={form.title}
        onInput$={(_, el) => (form.title = el.value)}
      />
    );
    const notes = (
      <TextField
        name="contact-notes"
        type="textarea"
        rows={3}
        label="Notes"
        maxLength={MAX_NOTES}
        value={form.notes}
        onInput$={(_, el) => (form.notes = el.value)}
      />
    );
    const failure = form.failure && (
      <p class="text-body-medium text-error" role="alert">
        {form.failure}
      </p>
    );

    if (look === "dialog")
      return (
        <div class="grid gap-4 pt-2">
          {name}
          {company}
          {jobTitle}
          {rows("emails")}
          {rows("phones")}
          {notes}
          {failure}
        </div>
      );

    // Google's edit form: an icon column (24dp, the fields' start at 16dp past it), one row
    // per group. The icons are decorative: each field has its own label.
    const group = (icon: IconName, fields: unknown) => (
      <div class="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-4">
        <span class="pt-4 text-on-surface-variant">
          <Icon name={icon} aria-hidden="true" />
        </span>
        <div class="grid gap-4">{fields as never}</div>
      </div>
    );
    return (
      <div class="grid max-w-xl gap-6">
        {group("person", name)}
        {group(
          "domain",
          <>
            {company}
            {jobTitle}
          </>,
        )}
        {group("mail", rows("emails"))}
        {group("call", rows("phones"))}
        {group("sticky_note_2", notes)}
        {failure}
      </div>
    );
  },
);

/**
 * Ctrl/Cmd+Enter saves (Google Contacts' shortcut, e-store FEATURES 3.11): the form's own submit,
 * so it runs the same validation. Synchronous, so the textarea gets no new line.
 */
/**
 * Copies what the form's controls hold into the store before a save. Each field's `onInput$` is
 * its own lazily loaded handler, and a submit can arrive before it has run (found 2026-11-24:
 * the first Save after a page load validated an empty name, in Chrome and WebKit, because the
 * submit chunk loaded before the Name field's). The controls are the truth at submit time.
 */
export function syncFromControls(form: FormState, el: HTMLFormElement) {
  const text = (name: string) =>
    (el.elements.namedItem(name) as HTMLInputElement | null)?.value;
  form.name = text("contact-name") ?? form.name;
  form.organization = text("contact-organization") ?? form.organization;
  form.title = text("contact-title") ?? form.title;
  form.notes = text("contact-notes") ?? form.notes;
  const rows = (name: string, list: ValueRow[]) => {
    const inputs = el.querySelectorAll<HTMLInputElement>(`[name="${name}"]`);
    if (inputs.length !== list.length) return;
    inputs.forEach((input, i) => (list[i].value = input.value));
  };
  rows("contact-phone", form.phones);
  rows("contact-email", form.emails);
}

export const saveShortcut = sync$((event: KeyboardEvent, form: HTMLElement) => {
  if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  (form as HTMLFormElement).requestSubmit();
});

export const ContactEditor = component$<ContactEditorProps>(
  ({
    open,
    contact,
    onSave$,
    onClosed$,
    createTitle = "Create contact",
    editTitle = "Edit contact",
    saveLabel = "Save",
    cancelLabel = "Cancel",
    addPhoneLabel = "Add phone",
    addEmailLabel = "Add email",
    removeLabel = "Remove",
  }) => {
    const form = useStore<FormState>(emptyForm());

    // Re-seed every time it opens (e-store): never the previous contact's values.
    useTask$(({ track }) => {
      if (!track(() => open.value)) return;
      seedForm(form, contact);
    });

    const submit$ = $(async (_: SubmitEvent, el: HTMLFormElement) => {
      if (form.busy) return;
      syncFromControls(form, el);
      form.submitted = true;
      form.errors = validateContactInput(inputFrom(form));
      if (Object.keys(form.errors).length) return;
      form.busy = true;
      try {
        const failure = await onSave$(inputFrom(form));
        if (failure) form.failure = failure;
        else open.value = false;
      } finally {
        form.busy = false;
      }
    });

    const title = contact ? editTitle : createTitle;

    return (
      <Modal.Root bind:open={open} position="adaptive">
        <Modal.Content onClose$={() => onClosed$?.()}>
          <form
            class="contents"
            autocomplete="off"
            noValidate
            preventdefault:submit
            onSubmit$={submit$}
            onKeyDown$={saveShortcut}
          >
            <Modal.CloseTitleAction
              title={title}
              closeLabel={cancelLabel}
              actionLabel={saveLabel}
              actionType="submit"
            />
            <Modal.Header>
              <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Section>
              <ContactFields
                form={form}
                addPhoneLabel={addPhoneLabel}
                addEmailLabel={addEmailLabel}
                removeLabel={removeLabel}
              />
            </Modal.Section>
            <Modal.Footer>
              <Modal.Close>{cancelLabel}</Modal.Close>
              <Button
                type="submit"
                look="text"
                label={saveLabel}
                disabled={form.busy}
              />
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal.Root>
    );
  },
);

export interface ContactEditFormProps {
  /** The `<form>`'s id: the pane header's Save (`type="submit" form={formId}`) submits it. */
  formId: string;
  contact: LocalContact;
  /** As `ContactEditor`'s: an error message keeps the form open with it. */
  onSave$: QRL<(input: ContactInput) => Promise<string | void>>;
  /** Set while the form differs from the contact (Save is disabled until then, Google's). */
  dirty: Signal<boolean>;
  /** Set while a save runs. */
  busy?: Signal<boolean>;
  addPhoneLabel?: string;
  addEmailLabel?: string;
  removeLabel?: string;
}

/**
 * The person page's EDIT VIEW (2026-11-24, owner: "the edit should be on the top"; Google
 * Contacts edits in the page, measured 2026-11-24): the same fields as the dialog, in Google's
 * icon-column layout, in a `<form>` whose Save button sits in the pane header (`form` attribute,
 * HTML: a submit button's form owner may be outside it). Seeded once: the page leaves edit mode
 * (`?edit`) after a save or a cancel. NEW (e-store edits in a dialog only).
 */
export const ContactEditForm = component$<ContactEditFormProps>(
  ({
    formId,
    contact,
    onSave$,
    dirty,
    busy,
    addPhoneLabel,
    addEmailLabel,
    removeLabel,
  }) => {
    const form = useStore<FormState>(() => {
      const f = emptyForm();
      seedForm(f, contact);
      return f;
    });
    // The contact's values, once (a body read of the store would follow its edits).
    const initial = useSignal(() => {
      const f = emptyForm();
      seedForm(f, contact);
      return formSnapshot(f);
    });

    // Dirty: the form's values against the contact's (Google enables Save on the first change).
    useTask$(({ track }) => {
      track(() => [
        form.name,
        form.organization,
        form.title,
        form.notes,
        form.phones,
        form.emails,
      ]);
      dirty.value = formSnapshot(form) !== initial.value;
    });

    // Entering the edit view focuses Name (memory focus-first-field-on-open). Not `autofocus`:
    // the browser honours it once per document load, not on a client navigation (HTML spec).
    const formRef = useSignal<HTMLFormElement>();
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
      formRef.value
        ?.querySelector<HTMLInputElement>('[name="contact-name"]')
        ?.focus();
    });

    const submit$ = $(async (_: SubmitEvent, el: HTMLFormElement) => {
      if (form.busy) return;
      syncFromControls(form, el);
      form.submitted = true;
      form.errors = validateContactInput(inputFrom(form));
      if (Object.keys(form.errors).length) return;
      form.busy = true;
      if (busy) busy.value = true;
      try {
        const failure = await onSave$(inputFrom(form));
        if (failure) form.failure = failure;
      } finally {
        form.busy = false;
        if (busy) busy.value = false;
      }
    });

    return (
      <form
        ref={formRef}
        id={formId}
        autocomplete="off"
        noValidate
        preventdefault:submit
        onSubmit$={submit$}
        onKeyDown$={saveShortcut}
      >
        <ContactFields
          form={form}
          look="page"
          autofocus={false}
          addPhoneLabel={addPhoneLabel}
          addEmailLabel={addEmailLabel}
          removeLabel={removeLabel}
        />
      </form>
    );
  },
);
