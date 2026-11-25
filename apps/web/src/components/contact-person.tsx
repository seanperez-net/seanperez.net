import {
  $,
  Slot,
  component$,
  useComputed$,
  useContext,
  useSignal,
} from "@qwik.dev/core";
import { useLocation, useNavigate } from "@qwik.dev/router";
import {
  Avatar,
  Button,
  Dropdown,
  Icon,
  IconButton,
  Layout,
  List,
  Menu,
  Separator,
} from "@seanperez/ui";
import type { AvatarPresence, IconName } from "@seanperez/ui";
import { bumpCount, forgetCounts } from "../contacts/frequency";
import {
  assignableLabels,
  commit,
  exportContacts,
  labelNamer,
  targetsOf,
  useContactsSnackbar,
} from "../contacts/local-actions";
import {
  LOCAL_LABEL_PREFIX,
  LabelError,
  TRASH_DAYS,
  createLabel,
  labelNameTaken,
  purgeContacts,
  recoverContacts,
  resetSite,
  restoreContacts,
  setLabel,
  setPhoto,
  setStarred,
  trashContacts,
  trashDaysLeft,
  updateContact,
  type ContactInput,
  type LocalBook,
  type LocalContact,
  type SiteBase,
} from "../contacts/local-book";
import { localBookId, localRowKey } from "../contacts/local-context";
import { PhotoError, photoFromFile } from "../contacts/photo";
import {
  CONTACT_HEADING_ID,
  CONTACT_LABELS,
  IMPORTED_LABEL_ID,
  contactsListHref,
} from "../content/contacts";
import { ContactEditForm } from "./contact-editor";
import { ConfirmDialog, LabelNameDialog } from "./contacts-dialogs";
import { ResumeSection } from "./resume-section";

/** Google's History times: "Today, 10:10 PM", else the date (the visitor's clock and locale). */
const formatWhen = (ms: number): string => {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return d.toDateString() === new Date().toDateString()
    ? `Today, ${time}`
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

/** The edit view's form (the pane header's Save submits it by id). */
const EDIT_FORM_ID = "contact-edit-form";

export interface ContactPersonProps {
  /** What the page shows and edits: a local contact, or a site contact's override or base. */
  record: LocalContact;
  /**
   * A SITE contact (`content/contacts.ts`): every write first makes the visitor's local
   * override of it (`targetsOf`, owner 2026-11-24); the site's own record never changes. Unset:
   * one of the visitor's own contacts.
   */
  site?: SiteBase;
  /** The visitor changed this site contact (its override exists): "Reset to the site's version". */
  overridden?: boolean;
  /** The line beside the avatar (work, the site's headline). */
  headline?: string;
  /** Smaller lines under it (where a local contact came from). */
  note?: string;
  seed: string;
  /** The showcase presence (DEMO); the avatar's ring. */
  presence?: AvatarPresence;
  /** An app's icon instead of initials. */
  fallbackIcon?: IconName;
  /** The emails / phones / notes card's title. */
  detailsTitle?: string;
  /** Where Back goes (single-pane). */
  backHref?: string;
}

/**
 * A contact's PERSON PAGE in Google Contacts' structure (2026-11-24, owner: "the profile and the
 * contacts still dont match the contacts.google ... the edit should be on the top"), shared by the
 * visitor's own contacts (`local-contact-profile.tsx`) and the site's (`contact-profile.tsx`,
 * `contact-app-profile.tsx`, through `routes/contacts/[id]/`). NEW: e-store's latest person view
 * (`ContactsShell`'s details pane: a centred `ContactCard`, then Edit / Delete buttons) is not
 * Google's, so Google was ported instead, measured in Chrome 2026-11-24 (layout only, the
 * owner's account; `.claude/notes/contacts-person-2026-11-24.md`), with the second agent's review.
 *
 * - Pane header (rule L4, Google's toolbar): Back (single-pane), the name as the title, then star
 *   ("Add to favorites", a toggle), a FILLED Edit, Delete, and More (Export, Remove photo, Reset to
 *   the site's version). Google's toolbar has no title until it scrolls; ours always has it (the
 *   pane's h2 and the focus target): an owner decision in PLAN.md.
 * - Header: the 2xl avatar with the edit badge (`Avatar editable`, Google's "+" "Set contact
 *   photo", tonal in the view, filled in the edit view): it picks a file, which is scaled in the
 *   browser and kept in the local book (`photo.ts`). Beside it the headline.
 * - The `actions` slot (a person's Message / GitHub row), then the LABELS row: each label an
 *   outlined link button to its list (Google's label chips are links; M3 assist chips are
 *   actions, second agent), then "+ Label" (no labels) or a pencil (some), opening Google's
 *   "Manage labels" menu: one checkbox row per label (applied AT ONCE, saved locally), a
 *   separator, "Create label" (the dialog, then applied to this contact).
 * - The details card (emails, phones, notes), then the default slot (the résumé, an app's cards).
 * - EDIT VIEW at `?edit` (second agent: a URL flag survives reload and Back, rule L19): the same
 *   page with the fields in place of the cards and Save (filled, disabled until a change) plus
 *   Cancel in the header. Ctrl/Cmd+Enter saves.
 * - In the Trash: Recover and Delete forever in the header, how long it stays.
 */
export const ContactPerson = component$<ContactPersonProps>(
  ({
    record,
    site,
    overridden = false,
    headline,
    note,
    seed,
    presence,
    fallbackIcon,
    detailsTitle = "Contact details",
    backHref = "/contacts/",
  }) => {
    const loc = useLocation();
    const nav = useNavigate();
    const state = useContext(localBookId);
    const { showSnackbar$ } = useContactsSnackbar();
    const name = record.name;
    const localId = site ? null : record.id;
    const siteId = site?.siteId ?? null;
    const rowKey = siteId ?? localRowKey(record.id);
    const editing = useComputed$(() => loc.url.searchParams.has("edit"));
    const viewHref = useComputed$(() => loc.url.pathname);
    const dirty = useSignal(false);
    const saving = useSignal(false);
    const cancelOpen = useSignal(false);
    const purgeOpen = useSignal(false);
    const createOpen = useSignal(false);
    const fileRef = useSignal<HTMLInputElement>();

    const choices = useComputed$(() => assignableLabels(state.book.value));
    const labelRows = useComputed$(() => {
      const nameOf = labelNamer(state.book.value);
      return record.labels
        .map((id) => ({ id, name: nameOf(id) ?? "" }))
        .filter((l) => l.name && l.id !== IMPORTED_LABEL_ID);
    });
    const trashed = useComputed$(() => record.deletedAt !== undefined);

    /** Runs `change` on this contact's local record (a site contact's override is made first). */
    const write$ = $(
      async (
        change: (book: LocalBook, id: string, now: number) => LocalBook,
      ) => {
        const base = site;
        const own = localId;
        return commit(state, (book, now) => {
          if (own) return { book: change(book, own, now), result: own };
          const t = targetsOf(book, [base!.siteId], [base!], now);
          const id = t.ids[0];
          return { book: change(t.book, id, now), result: id };
        });
      },
    );

    const star$ = $(async (on: boolean) => {
      await write$((book, id, now) => setStarred(book, id, on, now));
      await showSnackbar$({
        message: on ? "Added to favorites" : "Removed from favorites",
      });
    });

    const label$ = $(async (labelId: string, on: boolean) => {
      await write$((book, id, now) => setLabel(book, labelId, [id], on, now));
    });

    const createLabel$ = $(async (labelName: string) => {
      const taken = [...CONTACT_LABELS, ...state.book.value.labels].map(
        (l) => l.name,
      );
      if (labelNameTaken(labelName, taken))
        return "A label with this name already exists";
      try {
        const made = await commit(state, (book, now) => {
          const r = createLabel(
            book,
            labelName,
            LOCAL_LABEL_PREFIX + crypto.randomUUID(),
            now,
          );
          return { book: r.book, result: r.label };
        });
        const labelId = made.result.id;
        await write$((book, id, now) =>
          setLabel(book, labelId, [id], true, now),
        );
        await showSnackbar$({
          message: `Label “${made.result.name}” created and added`,
        });
      } catch (e) {
        return e instanceof LabelError
          ? e.message
          : "This label could not be saved.";
      }
    });

    const save$ = $(async (input: ContactInput) => {
      const change = await write$((book, id, now) => {
        const r = updateContact(book, id, input, now);
        return r.contact ? r.book : book;
      });
      if (!change.result) return "This contact could not be saved.";
      await nav(viewHref.value);
      await showSnackbar$({
        message: site ? "Saved in this browser" : "Saved",
      });
      // Back on the view: focus Edit, the control that opened the form.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[data-contact-edit]")?.focus(),
      );
    });

    const cancel$ = $(async () => {
      if (dirty.value) cancelOpen.value = true;
      else await nav(viewHref.value);
    });

    const delete$ = $(async () => {
      const change = await write$((book, id, now) =>
        trashContacts(book, [id], now),
      );
      const id = change.result;
      await nav(contactsListHref(""));
      await showSnackbar$({
        message: `${name} moved to Trash`,
        action: "Undo",
        showClose: true,
        onAction$: $(async () => {
          await commit(state, (book, now) => ({
            book: recoverContacts(book, [id], now),
          }));
        }),
      });
    });

    const recover$ = $(async () => {
      const id = record.id;
      await commit(state, (book, now) => ({
        book: recoverContacts(book, [id], now),
      }));
      await showSnackbar$({ message: `${name} recovered` });
    });

    const purge$ = $(async () => {
      const id = record.id;
      const sid = siteId;
      await commit(state, (book, now) => ({
        book: purgeContacts(book, [id], now),
      }));
      if (sid) {
        forgetCounts([sid]);
        await showSnackbar$({
          message: `${name} deleted from your contacts`,
        });
      } else {
        await nav(contactsListHref("trash"));
        await showSnackbar$({ message: `${name} deleted forever` });
      }
    });

    const reset$ = $(async () => {
      const sid = siteId;
      if (!sid) return;
      const before = state.book.value.contacts.find((c) => c.siteId === sid);
      if (!before) return;
      await commit(state, (book, now) => ({
        book: resetSite(book, sid, now),
      }));
      await showSnackbar$({
        message: "Back to the site's version",
        action: "Undo",
        showClose: true,
        onAction$: $(async () => {
          await commit(state, (book, now) => ({
            book: restoreContacts(book, [before], now),
          }));
        }),
      });
    });

    const photo$ = $(async (file: File | undefined) => {
      if (!file) return;
      try {
        const url = await photoFromFile(file);
        await write$((book, id, now) => setPhoto(book, id, url, now));
        await showSnackbar$({ message: "Photo saved in this browser" });
      } catch (e) {
        await showSnackbar$({
          message:
            e instanceof PhotoError
              ? e.message
              : "This photo could not be saved",
        });
      }
    });

    const removePhoto$ = $(async () => {
      await write$((book, id, now) => setPhoto(book, id, undefined, now));
      await showSnackbar$({ message: "Photo removed" });
    });

    const contacted$ = $(() => {
      state.counts.value = bumpCount(rowKey, "contact");
    });

    return (
      <>
        {/* The pane header IS Google's toolbar. */}
        <Layout.PaneHeader
          title={name}
          titleId={CONTACT_HEADING_ID}
          // Google's toolbar: Back, then the actions; the name is drawn beside the avatar.
          hideTitle
          backHref={
            trashed.value
              ? contactsListHref("trash")
              : editing.value
                ? viewHref.value
                : backHref
          }
          backLabel={
            trashed.value
              ? "Back to Trash"
              : editing.value
                ? "Cancel editing"
                : "Back to contacts"
          }
        >
          {trashed.value ? (
            <>
              <Button look="filled" label="Recover" onClick$={recover$} />
              <IconButton
                icon="delete"
                label="Delete forever"
                aria-haspopup="dialog"
                onClick$={() => (purgeOpen.value = true)}
              />
            </>
          ) : (
            <>
              <IconButton
                toggle
                selected={!!record.starred}
                icon="star"
                iconSelected="star_filled"
                label="Add to favorites"
                labelSelected="Remove from favorites"
                onSelectedChange$={star$}
              />
              {editing.value ? (
                <>
                  <Button look="text" label="Cancel" onClick$={cancel$} />
                  {/* Submits the form below (HTML `form` attribute). */}
                  <Button
                    look="filled"
                    type="submit"
                    form={EDIT_FORM_ID}
                    label="Save"
                    disabled={!dirty.value || saving.value}
                  />
                </>
              ) : (
                <>
                  <Button
                    look="filled"
                    type="link"
                    href={`${viewHref.value}?edit`}
                    label="Edit"
                    data-contact-edit=""
                  />
                  <IconButton icon="delete" label="Delete" onClick$={delete$} />
                  <Menu.Root>
                    <Menu.Trigger look="plain" aria-label="More actions">
                      <Icon name="more_vert" size="sm" />
                    </Menu.Trigger>
                    <Menu.Content align="end">
                      <Menu.Item
                        onClick$={() =>
                          exportContacts([record], state.book.value, "vcard")
                        }
                      >
                        Export as vCard (.vcf)
                      </Menu.Item>
                      <Menu.Item
                        onClick$={() =>
                          exportContacts([record], state.book.value, "csv")
                        }
                      >
                        Export as CSV
                      </Menu.Item>
                      {record.photo && (
                        <Menu.Item onClick$={removePhoto$}>
                          Remove photo
                        </Menu.Item>
                      )}
                      {site && overridden && (
                        <Menu.Item onClick$={reset$}>
                          Reset to the site's version
                        </Menu.Item>
                      )}
                    </Menu.Content>
                  </Menu.Root>
                </>
              )}
            </>
          )}
        </Layout.PaneHeader>

        {/* The detail pane's ONE body element. */}
        <article
          aria-labelledby={CONTACT_HEADING_ID}
          class="@container grid max-w-[936px] content-start gap-4 self-start"
        >
          <header class="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Avatar
              src={record.photo}
              name={fallbackIcon && !record.photo ? undefined : name}
              seed={seed}
              fallbackIcon={fallbackIcon}
              size="2xl"
              presence={presence}
              decorative
              editable={!trashed.value}
              badgeIcon="add"
              badgeLabel={record.photo ? "Change photo" : "Add photo"}
              badgeLook={editing.value ? "filled" : "tonal"}
              onBadgeClick$={() => fileRef.value?.click()}
            />
            <div class="grid min-w-0 gap-1">
              {/* The name as Google draws it (28 / 36, headline-medium); the heading is the
                  pane header's (screen readers), so this one is not read twice. */}
              <p
                aria-hidden="true"
                class="text-headline-medium text-on-surface"
              >
                {name}
              </p>
              {headline && (
                <p class="text-body-large text-on-surface-variant">
                  {headline}
                </p>
              )}
              {note && (
                <p class="text-body-medium text-on-surface-variant">{note}</p>
              )}
            </div>
            {/* The badge's file picker (no component picks a file without a dropzone). */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange$={(_, el) => {
                void photo$(el.files?.[0]);
                el.value = "";
              }}
            />
          </header>

          {trashed.value && (
            <p class="text-body-medium text-on-surface-variant" role="status">
              {site
                ? `In the Trash: deleted from your contacts in ${trashDaysLeft(record, Date.now())} of ${TRASH_DAYS} days. The site keeps its own copy.`
                : `In the Trash: deleted for good in ${trashDaysLeft(record, Date.now())} of ${TRASH_DAYS} days.`}
            </p>
          )}

          {/* Google's quick actions (captioned round buttons), then a rule to the end. */}
          {!editing.value && (
            // 28px under the avatar (Google, measured): the article's 16 + 12.
            <div class="mt-3 flex items-start gap-1">
              <Slot name="actions" />
              {/* Through the buttons' middle (20px = half of 40dp), Google's rule. */}
              <div class="min-w-6 flex-1 pt-5">
                <Separator />
              </div>
            </div>
          )}

          {/* Google's labels row. */}
          {!trashed.value && (
            <div
              class="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Labels"
            >
              {record.source === "import" && (
                <Button
                  look="outlined"
                  size="xs"
                  type="link"
                  href={contactsListHref(`label/${IMPORTED_LABEL_ID}`)}
                  leadingIcon="upload_file"
                  label="Imported"
                />
              )}
              {labelRows.value.map((l) => (
                <Button
                  key={l.id}
                  look="outlined"
                  size="xs"
                  type="link"
                  href={contactsListHref(`label/${l.id}`)}
                  leadingIcon="label"
                  label={l.name}
                />
              ))}
              <Dropdown.Root>
                {labelRows.value.length ? (
                  <Dropdown.Trigger
                    look="plain"
                    size="xs"
                    aria-label="Manage labels"
                    data-contact-labels=""
                  >
                    <Icon name="edit" size="sm" />
                  </Dropdown.Trigger>
                ) : (
                  <Dropdown.Trigger
                    look="outlined"
                    size="xs"
                    data-contact-labels=""
                  >
                    <Icon name="add" size="sm" />
                    Label
                  </Dropdown.Trigger>
                )}
                <Dropdown.Content aria-label="Manage labels">
                  <Dropdown.GroupLabel>Manage labels</Dropdown.GroupLabel>
                  {choices.value.map((l) => (
                    <Dropdown.CheckboxItem
                      key={l.id}
                      checked={record.labels.includes(l.id)}
                      onCheckedChange$={(on) => label$(l.id, on)}
                    >
                      <Icon name="label" />
                      {l.name}
                      <Dropdown.ItemIndicator>
                        {record.labels.includes(l.id) && (
                          <Icon name="check" size="sm" />
                        )}
                      </Dropdown.ItemIndicator>
                    </Dropdown.CheckboxItem>
                  ))}
                  <Dropdown.Separator />
                  <Dropdown.Item
                    aria-haspopup="dialog"
                    onClick$={() => (createOpen.value = true)}
                  >
                    <Icon name="add" />
                    Create label
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Root>
            </div>
          )}

          {editing.value && !trashed.value ? (
            <ContactEditForm
              formId={EDIT_FORM_ID}
              contact={record}
              onSave$={save$}
              dirty={dirty}
              busy={saving}
            />
          ) : (
            <div class="grid content-start gap-4 @4xl:grid-cols-[minmax(0,1fr)_360px]">
              <div class="grid min-w-0 content-start gap-4">
                {(record.emails.length > 0 ||
                  record.phones.length > 0 ||
                  !!record.notes) && (
                  <ResumeSection
                    id="person-details"
                    title={detailsTitle}
                    full
                    variant="filled"
                  >
                    <List.Root aria-labelledby="person-details">
                      {record.emails.map((e) => (
                        <List.Item
                          key={`e${e.value}`}
                          href={`mailto:${e.value}`}
                          reload
                          startIcon="mail"
                          headline={e.value}
                          supportingText={e.label || "Email"}
                          onClick$={contacted$}
                        />
                      ))}
                      {record.phones.map((p) => (
                        <List.Item
                          key={`p${p.value}`}
                          href={`tel:${p.value.replace(/[^\d+]/g, "")}`}
                          reload
                          startIcon="call"
                          headline={p.value}
                          supportingText={p.label || "Phone"}
                          onClick$={contacted$}
                        />
                      ))}
                      {record.notes && (
                        <List.Item
                          startIcon="sticky_note_2"
                          headline={
                            <span class="whitespace-pre-line">
                              {record.notes}
                            </span>
                          }
                          supportingText="Notes"
                          headlineLines="auto"
                        />
                      )}
                    </List.Root>
                  </ResumeSection>
                )}
                <Slot />
              </div>
              {/* Google's second column: recent interactions, History. */}
              <div class="grid min-w-0 content-start gap-4">
                <Slot name="aside" />
                {!site && (
                  <section
                    aria-labelledby="person-history"
                    class="grid gap-2 px-4"
                  >
                    <h3
                      id="person-history"
                      class="text-title-medium text-on-surface"
                    >
                      History
                    </h3>
                    <p class="text-body-medium text-on-surface">
                      Last edited{" "}
                      <span class="text-body-small text-on-surface-variant">
                        · {formatWhen(record.updatedAt)}
                      </span>
                    </p>
                    <p class="text-body-medium text-on-surface">
                      Added to contacts{" "}
                      <span class="text-body-small text-on-surface-variant">
                        · {formatWhen(record.createdAt)}
                      </span>
                    </p>
                  </section>
                )}
              </div>
            </div>
          )}
        </article>

        <ConfirmDialog
          open={cancelOpen}
          title="Discard changes?"
          description="Your changes to this contact will be lost."
          confirmLabel="Discard"
          onConfirm$={() => nav(viewHref.value)}
        />
        <ConfirmDialog
          open={purgeOpen}
          title="Delete forever?"
          description={
            site
              ? `${name} will be removed from your contacts. The site keeps its own copy: you can restore it from this page.`
              : `${name} will be deleted forever. This cannot be undone.`
          }
          confirmLabel="Delete forever"
          onConfirm$={purge$}
        />
        <LabelNameDialog
          open={createOpen}
          title="Create label"
          onSave$={createLabel$}
        />
      </>
    );
  },
);
