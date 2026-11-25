import { component$ } from "@qwik.dev/core";
import {
  Form,
  routeAction$,
  routeLoader$,
  useLocation,
  valibot$,
  type DocumentHead,
} from "@qwik.dev/router";
import {
  Button,
  EmptyState,
  IconButton,
  Layout,
  List,
  Modal,
  TextField,
} from "@seanperez/ui";
import * as v from "valibot";
import { requireAdmin } from "@seanperez/server/feed/access.server";
import { formatDate } from "@seanperez/server/feed/format";
import { siteOrigin } from "@seanperez/server/hosts";
import { SECTIONS_MAX } from "@seanperez/db/profile/limits";
import {
  SECTION_KINDS,
  SECTION_VISIBILITIES,
  importSectionsJson,
  slugId,
} from "@seanperez/db/profile/profile-sections";
import { getSectionsForm, saveSections } from "@seanperez/db/profile/profile.server";
import {
  ChoiceField,
  KIND_LABELS,
  KIND_NAMES,
  VISIBILITY_LABELS,
  issueLines,
  uniqueId,
} from "../../../profile/sections-admin";

/**
 * The profile's sections (2026-11-25, owner: "have the full resume and have ways of adjusting
 * whats visible or not"): every section in its order, with its visibility (shown / collapsed by
 * default / hidden from the site), move up / down, Add section, and Import JSON (our document or
 * a JSON Resume file; replaces every section). A section's entries are edited on its own page
 * (`[section]/`). Gated by the root layout's Access check, and `requireAdmin` again in the action.
 * Every change goes through ONE write (`saveSections`: the whole document, validated again).
 */
export const useSectionsForm = routeLoader$(async ({ platform }) => {
  try {
    return { ok: true as const, form: await getSectionsForm(platform.env.DB) };
  } catch (error) {
    console.error("profile sections: admin read failed", error);
    return { ok: false as const };
  }
});

export const useProfileSections = routeAction$(
  async (data, ev) => {
    await requireAdmin(ev);
    const db = ev.platform.env.DB;
    const form = await getSectionsForm(db);
    if (form.broken && data.intent !== "import") {
      return ev.fail(409, {
        message:
          "The stored sections cannot be read. Import a document to replace them.",
      });
    }
    const doc = structuredClone(form.doc);
    let next: string | null = null;
    if (data.intent === "add") {
      if (doc.sections.length >= SECTIONS_MAX.sections) {
        return ev.fail(400, {
          message: `At most ${SECTIONS_MAX.sections} sections.`,
        });
      }
      const title = (data.title ?? "").trim();
      if (!title) {
        return ev.fail(400, {
          message: "Enter a title.",
          fieldErrors: { title: "Enter a title." },
        });
      }
      next = uniqueId(doc, slugId(title, "section"));
      doc.sections.push({
        id: next,
        title,
        kind: data.kind ?? "work",
        visibility: data.visibility ?? "shown",
        entries: [],
      });
    } else if (data.intent !== "import") {
      const [op, id] = data.intent.split(":");
      const i = doc.sections.findIndex((s) => s.id === id);
      const j = op === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= doc.sections.length) {
        return ev.fail(400, { message: "That section cannot move." });
      }
      [doc.sections[i], doc.sections[j]] = [doc.sections[j], doc.sections[i]];
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.json ?? "");
      } catch {
        return ev.fail(400, {
          message: "That is not JSON.",
          fieldErrors: { json: "Paste a JSON document." },
        });
      }
      const imported = importSectionsJson(parsed);
      const ignored = imported.ignored;
      const saved = await saveSections(db, imported.doc);
      if (!saved.ok) {
        return ev.fail(400, {
          message: "Not imported. Fix these and paste it again:",
          issues: issueLines(saved.issues),
          fieldErrors: { json: "Check the document." },
        });
      }
      return {
        message: `Imported.${ignored.length ? ` Not imported: ${ignored.join(", ")}.` : ""} The site shows it within a minute.`,
      };
    }
    const saved = await saveSections(db, doc);
    if (!saved.ok) {
      return ev.fail(400, {
        message: "Could not save:",
        issues: issueLines(saved.issues),
      });
    }
    if (next) throw ev.redirect(303, `/profile/sections/${next}/`);
    return { message: "Saved. The site shows it within a minute." };
  },
  valibot$(
    v.object({
      // add, import, or "up:<section id>" / "down:<section id>".
      intent: v.pipe(
        v.string(),
        v.maxLength(SECTIONS_MAX.id + 5),
        v.regex(/^(add|import|(up|down):[a-z0-9][a-z0-9-]*)$/),
      ),
      title: v.optional(
        v.pipe(v.string(), v.maxLength(SECTIONS_MAX.sectionTitle)),
      ),
      kind: v.optional(v.picklist(SECTION_KINDS)),
      visibility: v.optional(v.picklist(SECTION_VISIBILITIES)),
      json: v.optional(v.pipe(v.string(), v.maxLength(SECTIONS_MAX.bytes * 2))),
    }),
  ),
);

export default component$(() => {
  const loaded = useSectionsForm();
  const act = useProfileSections();
  const loc = useLocation();
  const errors = (act.value?.fieldErrors ?? {}) as Record<
    string,
    string | string[] | undefined
  >;
  const err = (key: string) => {
    const value = errors[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const issues = (act.value as { issues?: string[] } | undefined)?.issues;
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader
        title="Profile sections"
        backHref="/profile/"
        backLabel="Back to profile"
      >
        <Button
          type="link"
          href={`${siteOrigin(loc.url)}/contacts/sean-perez/#profile-sections`}
          target="_blank"
          look="text"
          label="View on site"
        />
      </Layout.PaneHeader>
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid max-w-3xl content-start gap-6">
        {!loaded.value.ok ? (
          <p role="alert" class="text-body-large text-error">
            The profile sections column does not exist yet. Apply the migrations to this
            database.
          </p>
        ) : (
          <>
            <p class="text-body-medium text-on-surface-variant">
              {loaded.value.form.updatedAt
                ? `Saved ${formatDate(loaded.value.form.updatedAt)}.`
                : "None yet: the profile shows no sections."}{" "}
              Hidden sections and entries are never sent to the site. Collapsed
              sections start closed there and print open.
            </p>
            {loaded.value.form.broken && (
              <p role="alert" class="text-body-medium text-error">
                The stored sections cannot be read, so the site shows none. Import
                a document below to replace it.
              </p>
            )}
            {loaded.value.form.dropped > 0 && (
              <p role="alert" class="text-body-medium text-error">
                {loaded.value.form.dropped} stored records could not be read and
                are not shown. The next save drops them.
              </p>
            )}
            {act.value?.message && (
              <div
                role={act.value.failed ? "alert" : "status"}
                class={
                  act.value.failed
                    ? "text-body-medium text-error grid gap-1"
                    : "text-body-medium text-on-surface"
                }
              >
                <p>{act.value.message}</p>
                {issues?.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}

            {loaded.value.form.doc.sections.length === 0 ? (
              <EmptyState
                size="sm"
                icon="article"
                headline="No sections yet"
                description="Add a section, or import a JSON Resume file."
                live={false}
              />
            ) : (
              // Multi-action rows (m3-hierarchy B3): the row opens the section, its move
              // buttons sit beside the link (`actions`). ONE form around the list, the section in
              // the button's value: a `Form` inside a prop is JSX Qwik must serialize, and the
              // router's `Form` is a plain function (Q34 killed the dev server, 2026-11-25).
              <Form action={act}>
                <List.Root rovingFocus aria-label="Sections">
                  {loaded.value.form.doc.sections.map((section, i, all) => (
                    <List.Item
                      key={section.id}
                      href={`/profile/sections/${section.id}/`}
                      headline={section.title}
                      supportingText={`${VISIBILITY_LABELS[section.visibility]} · ${KIND_NAMES[section.kind]} · ${
                        section.entries.length === 1
                          ? "1 entry"
                          : `${section.entries.length} entries`
                      }${
                        section.entries.some((e) => e.visibility === "hidden")
                          ? ` (${section.entries.filter((e) => e.visibility === "hidden").length} hidden)`
                          : ""
                      }`}
                      actions={
                        <div class="flex gap-1">
                          <IconButton
                            type="submit"
                            name="intent"
                            value={`up:${section.id}`}
                            icon="arrow_upward"
                            label={`Move ${section.title} up`}
                            disabled={i === 0}
                          />
                          <IconButton
                            type="submit"
                            name="intent"
                            value={`down:${section.id}`}
                            icon="arrow_downward"
                            label={`Move ${section.title} down`}
                            disabled={i === all.length - 1}
                          />
                        </div>
                      }
                    />
                  ))}
                </List.Root>
              </Form>
            )}

            <Form action={act} class="grid gap-4">
              <h2 class="text-title-medium text-on-surface">Add a section</h2>
              <TextField
                name="title"
                label="Title"
                autocomplete="off"
                maxLength={SECTIONS_MAX.sectionTitle}
                supportingText="For example Experience, Hospitality, Education, Skills."
                error={err("title")}
              />
              <div class="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                  name="kind"
                  label="Kind"
                  value="work"
                  options={SECTION_KINDS.map((kind) => ({
                    value: kind,
                    label: KIND_LABELS[kind],
                  }))}
                  supportingText="Which fields its entries have."
                />
                <ChoiceField
                  name="visibility"
                  label="On the site"
                  value="shown"
                  options={SECTION_VISIBILITIES.map((value) => ({
                    value,
                    label: VISIBILITY_LABELS[value],
                  }))}
                />
              </div>
              <div>
                <Button
                  type="submit"
                  name="intent"
                  value="add"
                  look="tonal"
                  leadingIcon="add"
                  label="Add section"
                  disabled={
                    loaded.value.form.doc.sections.length >= SECTIONS_MAX.sections
                  }
                />
              </div>
            </Form>

            <Form action={act} class="grid gap-4">
              <h2 class="text-title-medium text-on-surface">Import JSON</h2>
              <TextField
                name="json"
                type="textarea"
                rows={8}
                resize="vertical"
                label="Sections JSON"
                autocomplete="off"
                spellcheck={false}
                supportingText="Our sections document, or a JSON Resume file (jsonresume.org). It REPLACES every section. Contact details (basics) are never imported."
                error={err("json")}
              />
              <Modal.Root>
                <div>
                  <Modal.Trigger>Import…</Modal.Trigger>
                </div>
                <Modal.Content>
                  <Modal.Header>
                    <Modal.Title>Replace every section?</Modal.Title>
                    <Modal.Description>
                      Every section and entry is replaced by the pasted
                      document. The current one is not kept.
                    </Modal.Description>
                  </Modal.Header>
                  <Modal.Footer>
                    <Modal.Close>Cancel</Modal.Close>
                    <Button
                      type="submit"
                      name="intent"
                      value="import"
                      look="text"
                      label="Replace"
                    />
                  </Modal.Footer>
                </Modal.Content>
              </Modal.Root>
            </Form>
          </>
        )}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = {
  title: "Profile sections · Admin",
  meta: [{ name: "robots", content: "noindex", key: "robots" }],
};
