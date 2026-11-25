import { component$ } from "@qwik.dev/core";
import {
  Form,
  routeAction$,
  routeLoader$,
  valibot$,
  type DocumentHead,
} from "@qwik.dev/router";
import {
  Button,
  EmptyState,
  IconButton,
  Layout,
  Modal,
  Switch,
  TextField,
} from "@seanperez/ui";
import * as v from "valibot";
import { requireAdmin } from "@seanperez/server/feed/access.server";
import { SECTIONS_MAX } from "@seanperez/db/profile/limits";
import {
  SECTION_KINDS,
  SECTION_VISIBILITIES,
  type ProfileEntry,
  type SectionKind,
  type ProfileSection,
  type SectionVisibility,
} from "@seanperez/db/profile/profile-sections";
import { getSectionsForm, saveSections } from "@seanperez/db/profile/profile.server";
import {
  ChoiceField,
  KIND_LABELS,
  VISIBILITY_LABELS,
  issueLines,
  uniqueId,
} from "../../../../profile/sections-admin";

/**
 * One profile section (2026-11-25): its title, kind and visibility, and its entries in order.
 * Every button posts the WHOLE form (no client state, works without JavaScript): Save, Add entry,
 * and per entry Move up / Move down / Remove; the action applies the button's intent to what was
 * typed and saves through ONE write (`saveSections`, the whole document validated again). A
 * refused save keeps what was typed (`act.value.section`). Entry visibility is a Switch ("Shown
 * on the site"); highlights are one per line; skills' keywords are comma-separated.
 */
export const useProfileSection = routeLoader$(async ({ platform, params }) => {
  const form = await getSectionsForm(platform.env.DB);
  const section = form.doc.sections.find((s) => s.id === params.section);
  return { section: section ?? null, broken: form.broken };
});

const entryRow = v.object({
  id: v.optional(v.pipe(v.string(), v.maxLength(SECTIONS_MAX.id))),
  shown: v.optional(v.string()),
  position: v.optional(v.string()),
  name: v.optional(v.string()),
  location: v.optional(v.string()),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  summary: v.optional(v.string()),
  highlights: v.optional(v.string()),
  keywords: v.optional(v.string()),
  url: v.optional(v.string()),
});

/** The posted entry as a stored entry (empty fields left out; the save validates it). */
const toEntry = (
  row: v.InferOutput<typeof entryRow>,
  id: string,
): ProfileEntry => {
  const t = (s?: string) => (s ?? "").trim();
  const lines = t(row.highlights)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const keywords = t(row.keywords)
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
  const entry: ProfileEntry = {
    id,
    visibility: row.shown ? "shown" : "hidden",
    position: t(row.position),
  };
  for (const key of [
    "name",
    "location",
    "startDate",
    "endDate",
    "summary",
    "url",
  ] as const) {
    const value = t(row[key]);
    if (value) entry[key] = key === "endDate" ? value.toLowerCase() : value;
  }
  if (lines.length) entry.highlights = lines;
  if (keywords.length) entry.keywords = keywords;
  return entry;
};

/** The form's labels, for a refused save's lines. */
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  position: "Title",
  name: "Organisation",
  location: "Place",
  startDate: "Start",
  endDate: "End",
  summary: "Summary",
  highlights: "Highlights",
  keywords: "Keywords",
  url: "Link",
  entries: "Entries",
};

export const useSaveProfileSection = routeAction$(
  async (data, ev) => {
    await requireAdmin(ev);
    const db = ev.platform.env.DB;
    const form = await getSectionsForm(db);
    if (form.broken) {
      return ev.fail(409, {
        message:
          "The stored sections cannot be read. Import a document on the Profile sections page.",
      });
    }
    const doc = structuredClone(form.doc);
    const at = doc.sections.findIndex((s) => s.id === ev.params.section);
    if (at < 0) return ev.fail(404, { message: "That section is gone." });

    if (data.intent === "delete") {
      doc.sections.splice(at, 1);
      const saved = await saveSections(db, doc);
      if (!saved.ok) {
        return ev.fail(400, {
          message: "Could not delete:",
          issues: issueLines(saved.issues),
        });
      }
      throw ev.redirect(303, "/profile/sections/");
    }

    // The typed entries, ids kept (a new row gets one that no section or entry has).
    const entries: ProfileEntry[] = [];
    for (const row of (data.entries ?? []).slice(
      0,
      SECTIONS_MAX.entriesPerSection,
    )) {
      const known =
        row.id && doc.sections[at].entries.some((e) => e.id === row.id);
      const id = known
        ? row.id!
        : uniqueId(doc, `${doc.sections[at].id.slice(0, 30)}-entry`);
      const entry = toEntry(row, id);
      entries.push(entry);
      if (!known) doc.sections[at].entries.push(entry); // reserve its id
    }
    const [op, index] = (data.intent ?? "save").split(":");
    const i = Number(index);
    if (op === "add") {
      if (entries.length >= SECTIONS_MAX.entriesPerSection) {
        return ev.fail(400, {
          message: `At most ${SECTIONS_MAX.entriesPerSection} entries.`,
        });
      }
      entries.push({
        id: uniqueId(doc, `${doc.sections[at].id.slice(0, 30)}-entry`),
        visibility: "shown",
        position: "New entry",
      });
    } else if (op === "remove" && entries[i]) {
      entries.splice(i, 1);
    } else if ((op === "up" || op === "down") && entries[i]) {
      const j = op === "up" ? i - 1 : i + 1;
      if (entries[j]) [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    const section: ProfileSection = {
      id: doc.sections[at].id,
      title: (data.title ?? "").trim(),
      kind: data.kind,
      visibility: data.visibility,
      entries,
    };
    doc.sections[at] = section;
    const saved = await saveSections(db, doc);
    if (!saved.ok) {
      return ev.fail(400, {
        message: "Not saved. Fix these:",
        issues: issueLines(saved.issues).map((line) =>
          line
            .replace(
              /^sections\.\d+\.entries\.(\d+)\.(\w+)/,
              (_, n, key: string) =>
                `Entry ${Number(n) + 1}, ${FIELD_LABELS[key] ?? key}`,
            )
            .replace(
              /^sections\.\d+\.entries\.(\d+)/,
              (_, n) => `Entry ${Number(n) + 1}`,
            )
            .replace(
              /^sections\.\d+\.(\w+)/,
              (_, key: string) => FIELD_LABELS[key] ?? key,
            ),
        ),
        section,
      });
    }
    return {
      message:
        op === "add"
          ? "Entry added and saved."
          : "Saved. The site shows it within a minute.",
    };
  },
  valibot$(
    v.object({
      intent: v.optional(
        v.pipe(v.string(), v.regex(/^(save|delete|add|(remove|up|down):\d+)$/)),
      ),
      title: v.optional(v.string()),
      kind: v.picklist(SECTION_KINDS),
      visibility: v.picklist(SECTION_VISIBILITIES),
      entries: v.optional(
        v.pipe(v.array(entryRow), v.maxLength(SECTIONS_MAX.entriesPerSection)),
      ),
    }),
  ),
);

/** One entry's fields; its row buttons post the form with their intent. */
const EntryFields = component$<{
  entry: ProfileEntry;
  index: number;
  count: number;
  kind: SectionKind;
}>(({ entry, index: i, count, kind }) => {
  const n = (field: string) => `entries.${i}.${field}`;
  const skills = kind === "skills";
  return (
    <fieldset class="border-outline-variant grid gap-4 border-t pt-4">
      <legend class="sr-only">{`Entry ${i + 1}: ${entry.position}`}</legend>
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="text-title-small text-on-surface me-auto">
          {`${i + 1}. ${entry.position}`}
        </h3>
        <IconButton
          type="submit"
          name="intent"
          value={`up:${i}`}
          icon="arrow_upward"
          label={`Move ${entry.position} up`}
          disabled={i === 0}
        />
        <IconButton
          type="submit"
          name="intent"
          value={`down:${i}`}
          icon="arrow_downward"
          label={`Move ${entry.position} down`}
          disabled={i === count - 1}
        />
        <IconButton
          type="submit"
          name="intent"
          value={`remove:${i}`}
          icon="delete"
          label={`Remove ${entry.position}`}
        />
      </div>
      <input type="hidden" name={n("id")} value={entry.id} />
      <Switch
        name={n("shown")}
        value="on"
        checked={entry.visibility === "shown"}
        label="Shown on the site"
        description="Off: kept here, never sent to the site."
      />
      <TextField
        name={n("position")}
        label={skills ? "Skill group" : "Title"}
        value={entry.position}
        required
        maxLength={SECTIONS_MAX.position}
      />
      {skills ? (
        <TextField
          name={n("keywords")}
          label="Keywords"
          value={(entry.keywords ?? []).join(", ")}
          supportingText="Separated by commas."
        />
      ) : (
        <>
          <div class="grid gap-4 sm:grid-cols-2">
            <TextField
              name={n("name")}
              label="Organisation"
              value={entry.name ?? ""}
              maxLength={SECTIONS_MAX.name}
            />
            <TextField
              name={n("location")}
              label="Place"
              value={entry.location ?? ""}
              maxLength={SECTIONS_MAX.location}
            />
            <TextField
              name={n("startDate")}
              label="Start"
              value={entry.startDate ?? ""}
              placeholder="2018-01"
              supportingText="Year and month, or a year."
            />
            <TextField
              name={n("endDate")}
              label="End"
              value={entry.endDate ?? ""}
              placeholder="present"
              supportingText='Year and month, a year, or "present".'
            />
          </div>
          <TextField
            name={n("summary")}
            label="Summary"
            value={entry.summary ?? ""}
            maxLength={SECTIONS_MAX.summary}
          />
          <TextField
            name={n("highlights")}
            type="textarea"
            rows={4}
            resize="vertical"
            label="Highlights"
            value={(entry.highlights ?? []).join("\n")}
            supportingText={`One per line, at most ${SECTIONS_MAX.highlights}.`}
          />
          <TextField
            name={n("url")}
            type="url"
            label="Link"
            value={entry.url ?? ""}
            placeholder="https://"
            maxLength={SECTIONS_MAX.url}
          />
        </>
      )}
    </fieldset>
  );
});

export default component$(() => {
  const loaded = useProfileSection();
  const act = useSaveProfileSection();
  const issues = (act.value as { issues?: string[] } | undefined)?.issues;
  const typed = (act.value as { section?: ProfileSection } | undefined)?.section;
  const section = typed ?? loaded.value.section;
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader
        title={section?.title || "Section"}
        backHref="/profile/sections/"
        backLabel="Back to profile sections"
      />
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid max-w-3xl content-start gap-6">
        {!section ? (
          <EmptyState
            size="sm"
            icon="search"
            headline="No such section"
            description="It may have been deleted."
            live={false}
          />
        ) : (
          <>
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
            <Form action={act} class="grid gap-6" key={section.id}>
              <TextField
                name="title"
                label="Title"
                value={section.title}
                required
                maxLength={SECTIONS_MAX.sectionTitle}
              />
              <div class="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                  name="kind"
                  label="Kind"
                  value={section.kind}
                  options={SECTION_KINDS.map((kind) => ({
                    value: kind,
                    label: KIND_LABELS[kind],
                  }))}
                  supportingText="Changing it keeps every field; the site shows the kind's fields."
                />
                <ChoiceField
                  name="visibility"
                  label="On the site"
                  value={section.visibility}
                  options={SECTION_VISIBILITIES.map(
                    (value: SectionVisibility) => ({
                      value,
                      label: VISIBILITY_LABELS[value],
                    }),
                  )}
                  supportingText="Collapsed: closed until opened, printed open."
                />
              </div>

              <h2 class="text-title-medium text-on-surface">
                {`Entries (${section.entries.length})`}
              </h2>
              {section.entries.map((entry, i) => (
                <EntryFields
                  key={entry.id}
                  entry={entry}
                  index={i}
                  count={section.entries.length}
                  kind={section.kind}
                />
              ))}
              <div class="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  name="intent"
                  value="save"
                  label="Save"
                  isLoading={act.isRunning}
                />
                <Button
                  type="submit"
                  name="intent"
                  value="add"
                  look="tonal"
                  leadingIcon="add"
                  label="Add entry"
                  disabled={
                    section.entries.length >= SECTIONS_MAX.entriesPerSection
                  }
                />
              </div>
            </Form>

            <Modal.Root>
              <div>
                <Modal.Trigger>Delete section</Modal.Trigger>
              </div>
              <Modal.Content>
                <Modal.Header>
                  <Modal.Title>{`Delete ${section.title}?`}</Modal.Title>
                  <Modal.Description>
                    {`Its ${section.entries.length} entries go with it. To keep them off the site without deleting, set it to Hidden.`}
                  </Modal.Description>
                </Modal.Header>
                <Modal.Footer>
                  <Modal.Close>Cancel</Modal.Close>
                  <Form action={act}>
                    <input type="hidden" name="kind" value={section.kind} />
                    <input
                      type="hidden"
                      name="visibility"
                      value={section.visibility}
                    />
                    <Button
                      type="submit"
                      name="intent"
                      value="delete"
                      look="text"
                      label="Delete"
                    />
                  </Form>
                </Modal.Footer>
              </Modal.Content>
            </Modal.Root>
          </>
        )}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = ({ resolveValue }) => ({
  title: `${resolveValue(useProfileSection).section?.title ?? "Section"} · Profile sections · Admin`,
  meta: [{ name: "robots", content: "noindex", key: "robots" }],
});
