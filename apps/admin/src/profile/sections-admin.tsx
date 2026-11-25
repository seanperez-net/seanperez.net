/**
 * What the two profile-sections pages share (`routes/profile/sections/`, `.../[section]/`): labels, the
 * id picker, the save-issue lines, and `ChoiceField` (our `Select` posting under a form name).
 * Admin only (one app: no package, rule A15).
 */
import { component$ } from "@qwik.dev/core";
import { Select } from "@seanperez/ui";
import type {
  ProfileSectionsDoc,
  SectionKind,
  SectionVisibility,
} from "@seanperez/db/profile/profile-sections";

export const KIND_LABELS: Record<SectionKind, string> = {
  work: "Jobs (title, organisation, dates, highlights)",
  education: "Education (study, school, dates)",
  certificates: "Certificates (name, issuer, date)",
  skills: "Skills (a name and keywords)",
  other: "Other",
};

/** The kind in a row's supporting text. */
export const KIND_NAMES: Record<SectionKind, string> = {
  work: "Jobs",
  education: "Education",
  certificates: "Certificates",
  skills: "Skills",
  other: "Other",
};

export const VISIBILITY_LABELS: Record<SectionVisibility, string> = {
  shown: "Shown, open",
  collapsed: "Shown, collapsed",
  hidden: "Hidden from the site",
};

/** `base`, or `base-2`, `base-3`, ... : an id no section or entry of `doc` has. */
export function uniqueId(doc: ProfileSectionsDoc, base: string): string {
  const used = new Set(
    doc.sections.flatMap((s) => [s.id, ...s.entries.map((e) => e.id)]),
  );
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base.slice(0, 36)}-${n}`;
    if (!used.has(id)) return id;
  }
}

/** A refused save's issues as lines ("sections.0.entries.2.url: ..."), at most 12. */
export function issueLines(flat: {
  root?: readonly string[];
  nested?: Readonly<Record<string, readonly string[] | undefined>>;
}): string[] {
  const lines = [
    ...(flat.root ?? []),
    ...Object.entries(flat.nested ?? {}).flatMap(([path, messages]) =>
      (messages ?? []).map((message) => `${path}: ${message}`),
    ),
  ];
  return lines.slice(0, 12);
}

/** A form field choosing one of `options` (our Select; its native select posts `name`). */
export const ChoiceField = component$<{
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  supportingText?: string;
}>(({ name, label, value, options, supportingText }) => (
  <Select.Root name={name} value={value} options={options}>
    <Select.Label label={label} />
    <Select.Trigger>
      <Select.Value />
    </Select.Trigger>
    <Select.Content>
      {options.map((option) => (
        <Select.Item key={option.value} value={option.value}>
          {option.label}
          <Select.ItemIndicator />
        </Select.Item>
      ))}
    </Select.Content>
    <Select.HiddenSelect />
    {supportingText && <Select.SupportingText supportingText={supportingText} />}
  </Select.Root>
));
