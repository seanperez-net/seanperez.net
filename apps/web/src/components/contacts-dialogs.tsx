import { $, component$, useSignal, useStore, useTask$ } from "@qwik.dev/core";
import type { QRL, Signal } from "@qwik.dev/core";
import { Button, Checkbox, List, Modal, Radio, TextField } from "@seanperez/ui";
import {
  MAX_LABEL_NAME,
  MAX_PROFILE_HREF,
  type LinkedProfile,
} from "../contacts/local-book";
import { safeLinkHref } from "../profile/profile";

/**
 * The Contacts app's small dialogs (2026-11-24), all `Modal position="center"` (M3 basic dialog):
 * - `ConfirmDialog`: `alert` (`role="alertdialog"`) before a permanent removal (owner rule, from
 *   e-store: "a permanent removal confirms"): Delete forever, Empty Trash, Delete label. PORTED
 *   from e-store's `ContactsTrash` purge / empty dialogs and `ContactDeleteDialog`; e-store's
 *   `look="destructive"` Button does not exist here (M3 has no destructive button), so the
 *   confirm is a text button, as M3's basic dialog actions;
 * - `LabelNameDialog`: Create label / Rename (Google's: a name field, Cancel, Save). NEW;
 * - `ManageLabelsDialog`: Google's "Manage labels" (a checkbox per label, Apply), for one contact
 *   or a selection. NEW (e-store has no labels UI);
 * - `LinkProfileDialog` (2026-11-25): link a contact to a PROFILE (Google's PROFILE source): one
 *   of the site's accounts with a profile, or a profile address. NEW (neither Google nor e-store
 *   has this dialog: Google links profiles itself by verified email / phone / profile URL).
 */

export interface ConfirmDialogProps {
  open: Signal<boolean>;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm$: QRL<() => void>;
}

export const ConfirmDialog = component$<ConfirmDialogProps>(
  ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancel",
    onConfirm$,
  }) => (
    <Modal.Root bind:open={open} position="center" alert>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
          <Modal.Description>{description}</Modal.Description>
        </Modal.Header>
        <Modal.Footer>
          <Modal.Close>{cancelLabel}</Modal.Close>
          <Button
            look="text"
            label={confirmLabel}
            data-confirm=""
            onClick$={async () => {
              open.value = false;
              await onConfirm$();
            }}
          />
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  ),
);

export interface LabelNameDialogProps {
  open: Signal<boolean>;
  title: string;
  /** The name it opens with (Rename). */
  initial?: string;
  saveLabel?: string;
  /** Resolves an error message to keep it open, or nothing when saved. */
  onSave$: QRL<(name: string) => Promise<string | void>>;
  onClosed$?: QRL<() => void>;
}

export const LabelNameDialog = component$<LabelNameDialogProps>(
  ({ open, title, initial = "", saveLabel = "Save", onSave$, onClosed$ }) => {
    const name = useSignal(initial);
    const error = useSignal("");
    const busy = useSignal(false);
    useTask$(({ track }) => {
      if (!track(() => open.value)) return;
      name.value = initial;
      error.value = "";
    });
    const save$ = $(async () => {
      if (busy.value) return;
      if (!name.value.trim()) {
        error.value = "Enter a name";
        return;
      }
      busy.value = true;
      try {
        const failure = await onSave$(name.value);
        if (failure) error.value = failure;
        else open.value = false;
      } finally {
        busy.value = false;
      }
    });
    return (
      <Modal.Root bind:open={open} position="center">
        <Modal.Content onClose$={() => onClosed$?.()}>
          <form
            class="contents"
            autocomplete="off"
            noValidate
            preventdefault:submit
            onSubmit$={save$}
          >
            <Modal.Header>
              <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Section>
              <div class="pt-2">
                <TextField
                  name="label-name"
                  label="Label name"
                  autofocus
                  maxLength={MAX_LABEL_NAME}
                  bind:value={name}
                  error={error.value || undefined}
                  onInput$={() => (error.value = "")}
                />
              </div>
            </Modal.Section>
            <Modal.Footer>
              <Modal.Close>Cancel</Modal.Close>
              <Button
                type="submit"
                look="text"
                label={saveLabel}
                disabled={busy.value}
              />
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal.Root>
    );
  },
);

export interface ManageLabelsDialogProps {
  open: Signal<boolean>;
  /** Every label a contact can carry (the site's and the visitor's). */
  labels: { id: string; name: string }[];
  /** How many of the contacts carry each label id (for one contact: 0 or 1). */
  counts: Record<string, number>;
  /** Contacts it applies to. */
  total: number;
  /** Labels turned on and off; only the changed ones are listed. */
  onApply$: QRL<(on: string[], off: string[]) => void>;
}

/**
 * A checkbox per label: checked when every contact has it, the dash (`indeterminate`) when only
 * some do; a click makes it all or none. Apply changes only the labels touched (Google's).
 */
export const ManageLabelsDialog = component$<ManageLabelsDialogProps>(
  ({ open, labels, counts, total, onApply$ }) => {
    const state = useStore<{ touched: Record<string, boolean> }>({
      touched: {},
    });
    useTask$(({ track }) => {
      if (track(() => open.value)) state.touched = {};
    });
    return (
      <Modal.Root bind:open={open} position="center">
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>Manage labels</Modal.Title>
            {total > 1 && (
              <Modal.Description>{`For ${total} contacts`}</Modal.Description>
            )}
          </Modal.Header>
          <Modal.Section padding="none">
            <List.Root aria-label="Labels">
              {labels.map((label) => {
                const n = counts[label.id] ?? 0;
                const touched = state.touched[label.id];
                const checked = touched ?? n === total;
                return (
                  <List.Item key={label.id}>
                    <Checkbox
                      label={label.name}
                      name="labels"
                      value={label.id}
                      checked={checked}
                      indeterminate={
                        touched === undefined && n > 0 && n < total
                      }
                      onChange$={(on) => {
                        state.touched = { ...state.touched, [label.id]: on };
                      }}
                    />
                  </List.Item>
                );
              })}
            </List.Root>
          </Modal.Section>
          <Modal.Footer>
            <Modal.Close>Cancel</Modal.Close>
            <Button
              look="text"
              label="Apply"
              onClick$={async () => {
                const on: string[] = [];
                const off: string[] = [];
                for (const [id, v] of Object.entries(state.touched))
                  (v ? on : off).push(id);
                open.value = false;
                await onApply$(on, off);
              }}
            />
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    );
  },
);

export interface LinkProfileDialogProps {
  open: Signal<boolean>;
  /** The site's accounts that have a profile (id and name). */
  accounts: { id: string; name: string }[];
  /** The contact's current link, when it has one. */
  current?: LinkedProfile;
  /** Resolves an error message to keep it open, or nothing when saved. */
  onSave$: QRL<(profile: LinkedProfile) => Promise<string | void>>;
}

/** The address choice's value in the radio group (account ids are `[\w-]+`, never this). */
const ADDRESS = "address:";

export const LinkProfileDialog = component$<LinkProfileDialogProps>(
  ({ open, accounts, current, onSave$ }) => {
    const choice = useSignal("");
    const href = useSignal("");
    const error = useSignal("");
    const busy = useSignal(false);
    useTask$(({ track }) => {
      if (!track(() => open.value)) return;
      const now = current;
      choice.value = now
        ? "account" in now
          ? now.account
          : ADDRESS
        : (accounts[0]?.id ?? ADDRESS);
      href.value = now && "href" in now ? now.href : "";
      error.value = "";
    });
    const save$ = $(async () => {
      if (busy.value) return;
      let profile: LinkedProfile;
      if (choice.value === ADDRESS) {
        const safe = safeLinkHref(href.value);
        if (!safe || safe.length > MAX_PROFILE_HREF) {
          error.value = "Enter a profile address starting with https://";
          return;
        }
        profile = { href: safe };
      } else profile = { account: choice.value };
      busy.value = true;
      try {
        const failure = await onSave$(profile);
        if (failure) error.value = failure;
        else open.value = false;
      } finally {
        busy.value = false;
      }
    });
    return (
      <Modal.Root bind:open={open} position="center">
        <Modal.Content>
          <form
            class="contents"
            autocomplete="off"
            noValidate
            preventdefault:submit
            onSubmit$={save$}
          >
            <Modal.Header>
              <Modal.Title>
                {current ? "Change profile" : "Add profile"}
              </Modal.Title>
              <Modal.Description>
                Their own profile, shown on this contact. It is kept in this
                browser only.
              </Modal.Description>
            </Modal.Header>
            <Modal.Section>
              <div class="grid gap-3 pt-2">
                <Radio.Group bind:value={choice} aria-label="Profile">
                  {accounts.map((a) => (
                    <Radio.Item key={a.id} value={a.id}>
                      <Radio.Indicator />
                      <Radio.Label>{`${a.name}'s profile on this site`}</Radio.Label>
                    </Radio.Item>
                  ))}
                  <Radio.Item value={ADDRESS}>
                    <Radio.Indicator />
                    <Radio.Label>A profile address</Radio.Label>
                    <Radio.Description>
                      GitHub, LinkedIn, a website: any https:// address
                    </Radio.Description>
                  </Radio.Item>
                </Radio.Group>
                {choice.value === ADDRESS && (
                  <TextField
                    name="profile-href"
                    type="url"
                    label="Profile address"
                    placeholder="https://"
                    autofocus
                    maxLength={MAX_PROFILE_HREF}
                    bind:value={href}
                    error={error.value || undefined}
                    onInput$={() => (error.value = "")}
                  />
                )}
              </div>
            </Modal.Section>
            <Modal.Footer>
              <Modal.Close>Cancel</Modal.Close>
              <Button
                type="submit"
                look="text"
                label="Save"
                disabled={busy.value}
              />
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal.Root>
    );
  },
);
