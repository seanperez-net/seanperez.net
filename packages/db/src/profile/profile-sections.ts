/**
 * The profile's SECTIONS as data (2026-11-25): Work, Education, Skills, Certifications and any
 * custom section (owner: "keep everything ... the food and beverage stuff keep it seperate kind of
 * like an accordian ... some sort of prop or admin thing"; "have ways of adjusting whats visible or
 * not"). Part of the PROFILE, as Google's profile has them (owner, 2026-11-25: "the real app at
 * google.com doesnt have a resume it has the profile"). Client-safe and pure: the Valibot schema,
 * the types, the public view (hidden parts removed), date formatting and the JSON Resume import.
 * Stored in the `profile.sections` column by `profile.server.ts`; edited only in the admin app.
 * Plan and decisions: `.claude/notes/resume-as-data-2026-11-25.md` (history of this name).
 *
 * - Plain text everywhere (no markdown, no HTML): the site draws it with library list rows.
 * - Field names follow JSON Resume (jsonresume.org `schema.json`, read 2026-11-25) inside entries;
 *   the SECTION wrapper (title, kind, visibility, order) is Reactive Resume's idea, which JSON
 *   Resume lacks. Two sections may share a kind (developer work and hospitality work).
 * - NO contact fields: no email, phone, address, work authorization or licence (no-email rule).
 *   `strictObject` refuses unknown keys, so they cannot be stored by accident.
 */
import * as v from "valibot";
import { safeLinkHref } from "./profile.ts";
import { SECTIONS_MAX } from "./limits.ts";

export const SECTION_KINDS = [
  "work",
  "education",
  "certificates",
  "skills",
  "other",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** A section: on the site and open, on the site and closed (a `<details>`), or never sent. */
export const SECTION_VISIBILITIES = ["shown", "collapsed", "hidden"] as const;
export type SectionVisibility = (typeof SECTION_VISIBILITIES)[number];
/** An entry: on the site, or never sent. */
export const ENTRY_VISIBILITIES = ["shown", "hidden"] as const;
export type EntryVisibility = (typeof ENTRY_VISIBILITIES)[number];

/** `YYYY` or `YYYY-MM` (JSON Resume's iso8601 without the day). */
const MONTH_RE = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

const text = (max: number) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(max, `At most ${max} characters.`),
  );
const optionalText = (max: number) => v.optional(text(max));
const id = v.pipe(
  v.string(),
  v.maxLength(SECTIONS_MAX.id),
  v.regex(ID_RE, "Lowercase letters, digits and dashes."),
);

const startDate = v.optional(
  v.pipe(
    v.string(),
    v.trim(),
    v.check(
      (s) => s === "" || MONTH_RE.test(s),
      "A year and month: 2018-01 (or a year: 2018).",
    ),
  ),
);
const endDate = v.optional(
  v.pipe(
    v.string(),
    v.trim(),
    v.check(
      (s) => s === "" || s === "present" || MONTH_RE.test(s),
      'A year and month: 2020-02, a year, or "present".',
    ),
  ),
);

/** A start sorts as its first month, an end as its last: 2018 <= 2018-05 <= 2018. */
const asStart = (s: string) => (s.length === 4 ? `${s}-01` : s);
const asEnd = (s: string) => (s.length === 4 ? `${s}-12` : s);

export const ProfileEntrySchema = v.pipe(
  v.strictObject({
    id,
    visibility: v.picklist(ENTRY_VISIBILITIES),
    /** Role, degree, certificate or skill group: the row's headline. */
    position: v.pipe(text(SECTIONS_MAX.position), v.minLength(1, "Enter a title.")),
    /** Organisation, institution or issuer. */
    name: optionalText(SECTIONS_MAX.name),
    location: optionalText(SECTIONS_MAX.location),
    startDate,
    endDate,
    summary: optionalText(SECTIONS_MAX.summary),
    highlights: v.optional(
      v.pipe(
        v.array(text(SECTIONS_MAX.highlight)),
        v.maxLength(SECTIONS_MAX.highlights, `At most ${SECTIONS_MAX.highlights} highlights.`),
      ),
    ),
    keywords: v.optional(
      v.pipe(
        v.array(text(SECTIONS_MAX.keyword)),
        v.maxLength(SECTIONS_MAX.keywords, `At most ${SECTIONS_MAX.keywords} keywords.`),
      ),
    ),
    url: v.optional(
      v.pipe(
        v.string(),
        v.trim(),
        v.maxLength(SECTIONS_MAX.url),
        v.check((s) => s === "" || safeLinkHref(s) !== null, "An https:// address."),
      ),
    ),
  }),
  v.check(
    (e) =>
      !e.startDate ||
      !e.endDate ||
      e.endDate === "present" ||
      asEnd(e.endDate) >= asStart(e.startDate),
    "The end is before the start.",
  ),
);
export type ProfileEntry = v.InferOutput<typeof ProfileEntrySchema>;

const sectionFields = {
  id,
  title: v.pipe(text(SECTIONS_MAX.sectionTitle), v.minLength(1, "Enter a title.")),
  kind: v.picklist(SECTION_KINDS),
  visibility: v.picklist(SECTION_VISIBILITIES),
};

export const ProfileSectionSchema = v.strictObject({
  ...sectionFields,
  entries: v.pipe(
    v.array(ProfileEntrySchema),
    v.maxLength(SECTIONS_MAX.entriesPerSection, `At most ${SECTIONS_MAX.entriesPerSection} entries.`),
  ),
});
export type ProfileSection = v.InferOutput<typeof ProfileSectionSchema>;

/** No two sections, and no two entries anywhere, share an id (they are page anchors). */
const idsUnique = (sections: ProfileSection[]) => {
  const seen = new Set<string>();
  for (const section of sections) {
    for (const key of [section.id, ...section.entries.map((e) => e.id)]) {
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
};

/** The whole document, as written (admin save, import, seed): any problem refuses the write. */
export const ProfileSectionsSchema = v.pipe(
  v.strictObject({
    v: v.literal(1),
    sections: v.pipe(
      v.array(ProfileSectionSchema),
      v.maxLength(SECTIONS_MAX.sections, `At most ${SECTIONS_MAX.sections} sections.`),
    ),
  }),
  v.check((doc) => idsUnique(doc.sections), "Two sections or entries share an id."),
  v.check(
    (doc) => JSON.stringify(doc).length <= SECTIONS_MAX.bytes,
    "The sections are too long.",
  ),
);
export type ProfileSectionsDoc = v.InferOutput<typeof ProfileSectionsSchema>;

export const EMPTY_SECTIONS: ProfileSectionsDoc = { v: 1, sections: [] };

/**
 * A stored document, read leniently (rule S5): per section and per entry, so one bad record is
 * dropped and counted, never the rest. `doc: null` when the text is not a v1 document at all
 * (the caller shows no sections, and never rewrites it on read).
 */
export function parseStoredSections(json: string): {
  doc: ProfileSectionsDoc | null;
  dropped: number;
} {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { doc: null, dropped: 0 };
  }
  const top = v.safeParse(
    v.object({ v: v.literal(1), sections: v.array(v.unknown()) }),
    data,
  );
  if (!top.success) return { doc: null, dropped: 0 };
  const shell = v.strictObject({ ...sectionFields, entries: v.array(v.unknown()) });
  const seen = new Set<string>();
  let dropped = 0;
  const sections: ProfileSection[] = [];
  for (const raw of top.output.sections.slice(0, SECTIONS_MAX.sections)) {
    const section = v.safeParse(shell, raw);
    if (!section.success || seen.has(section.output.id)) {
      dropped++;
      continue;
    }
    seen.add(section.output.id);
    const entries: ProfileEntry[] = [];
    for (const rawEntry of section.output.entries.slice(0, SECTIONS_MAX.entriesPerSection)) {
      const entry = v.safeParse(ProfileEntrySchema, rawEntry);
      if (!entry.success || seen.has(entry.output.id)) {
        dropped++;
        continue;
      }
      seen.add(entry.output.id);
      entries.push(entry.output);
    }
    sections.push({ ...section.output, entries });
  }
  return { doc: { v: 1, sections }, dropped };
}

// --- The public view ------------------------------------------------------------------------

export interface PublicProfileEntry {
  id: string;
  position: string;
  /** "Organisation · Place" (either may be missing), or "". */
  where: string;
  /** "Jan 2018 – Present", "2016", or "". */
  dates: string;
  summary: string;
  highlights: string[];
  keywords: string[];
  /** An https:// address, or "". */
  url: string;
}

export interface PublicProfileSection {
  id: string;
  title: string;
  kind: SectionKind;
  /** Starts open (`shown`) or closed (`collapsed`). Hidden sections are not here at all. */
  open: boolean;
  entries: PublicProfileEntry[];
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2018-01" -> "Jan 2018"; "2018" -> "2018"; "present" -> "Present". The same on server and client. */
export function formatSectionMonth(value: string): string {
  if (value === "present") return "Present";
  if (value.length === 4) return value;
  const [year, month] = value.split("-").map(Number);
  return MONTH_FORMAT.format(Date.UTC(year, month - 1, 1));
}

/** "Jan 2018 – Present" (an en dash, as a CV prints ranges); one date alone; or "". */
export function formatSectionDates(start?: string, end?: string): string {
  const from = start ? formatSectionMonth(start) : "";
  const to = end ? formatSectionMonth(end) : "";
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

/**
 * What the site may see: hidden sections and hidden entries REMOVED (never sent, not hidden with
 * CSS), empty sections left out, dates formatted, empty strings for missing text.
 */
export function toPublicSections(doc: ProfileSectionsDoc): PublicProfileSection[] {
  return doc.sections
    .filter((section) => section.visibility !== "hidden")
    .map((section) => ({
      id: section.id,
      title: section.title,
      kind: section.kind,
      open: section.visibility === "shown",
      entries: section.entries
        .filter((entry) => entry.visibility === "shown")
        .map((entry) => ({
          id: entry.id,
          position: entry.position,
          where: [entry.name, entry.location].filter(Boolean).join(" · "),
          dates: formatSectionDates(entry.startDate, entry.endDate),
          summary: entry.summary ?? "",
          highlights: (entry.highlights ?? []).filter(Boolean),
          keywords: (entry.keywords ?? []).filter(Boolean),
          url: entry.url ? (safeLinkHref(entry.url) ?? "") : "",
        })),
    }))
    .filter((section) => section.entries.length > 0);
}

// --- JSON Resume import (the admin's "Import JSON") ----------------------------------------

/** "Software Engineer" -> "software-engineer" (an id from a title). */
export function slugId(textValue: string, fallback: string): string {
  const slug = textValue
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || fallback;
}

type Json = Record<string, unknown>;
const str = (x: unknown) => (typeof x === "string" ? x.trim() : undefined);
const strs = (x: unknown) =>
  Array.isArray(x)
    ? x.map(str).filter((s): s is string => !!s)
    : undefined;
const list = (x: unknown): Json[] =>
  Array.isArray(x) ? x.filter((i): i is Json => !!i && typeof i === "object") : [];
/** "2018-01-15" / "2018-01" / "2018" -> "2018-01" / "2018"; anything else dropped. */
const month = (x: unknown) => /^(\d{4}(?:-\d{2})?)/.exec(str(x) ?? "")?.[1];

/**
 * A pasted document: ours (`{ v: 1, sections }`) is returned as it is, a JSON Resume document is
 * mapped to sections (work, volunteer, education, certificates, awards, skills, languages,
 * projects; every section shown). `basics`, `references`, `publications`, `interests` and
 * `meta` are NOT imported (contact details never are) and are listed in `ignored`. The result
 * still goes through `ProfileSectionsSchema` before anything is saved.
 */
export function importSectionsJson(input: unknown): {
  doc: unknown;
  ignored: string[];
} {
  if (!input || typeof input !== "object") return { doc: input, ignored: [] };
  const data = input as Json;
  if ("sections" in data) return { doc: data, ignored: [] };

  const sections: Json[] = [];
  const add = (
    key: string,
    title: string,
    kind: SectionKind,
    toEntry: (item: Json) => Json,
  ) => {
    const items = list(data[key]);
    if (!items.length) return;
    const sectionId = slugId(title, key);
    sections.push({
      id: sectionId,
      title,
      kind,
      visibility: "shown",
      entries: items.map((item, i) => {
        const entry = Object.fromEntries(
          Object.entries(toEntry(item)).filter(
            ([, value]) =>
              value !== undefined &&
              value !== "" &&
              !(Array.isArray(value) && value.length === 0),
          ),
        );
        return { id: `${sectionId}-${i + 1}`, visibility: "shown", ...entry };
      }),
    });
  };
  // JSON Resume: a missing endDate on a role means it is current.
  const ongoing = (item: Json) =>
    month(item.endDate) ?? (month(item.startDate) ? "present" : undefined);

  add("work", "Experience", "work", (w) => ({
    position: str(w.position) || str(w.name),
    name: str(w.name),
    location: str(w.location),
    startDate: month(w.startDate),
    endDate: ongoing(w),
    summary: str(w.summary),
    highlights: strs(w.highlights),
    url: str(w.url),
  }));
  add("volunteer", "Volunteering", "work", (w) => ({
    position: str(w.position) || str(w.organization),
    name: str(w.organization),
    startDate: month(w.startDate),
    endDate: ongoing(w),
    summary: str(w.summary),
    highlights: strs(w.highlights),
    url: str(w.url),
  }));
  add("education", "Education", "education", (e) => ({
    position:
      [str(e.studyType), str(e.area)].filter(Boolean).join(", ") ||
      str(e.institution),
    name: str(e.institution),
    startDate: month(e.startDate),
    endDate: month(e.endDate),
    highlights: strs(e.courses),
    url: str(e.url),
  }));
  add("certificates", "Certifications", "certificates", (c) => ({
    position: str(c.name),
    name: str(c.issuer),
    startDate: month(c.date),
    url: str(c.url),
  }));
  add("awards", "Awards", "other", (a) => ({
    position: str(a.title),
    name: str(a.awarder),
    startDate: month(a.date),
    summary: str(a.summary),
  }));
  add("skills", "Skills", "skills", (s) => ({
    position: str(s.name),
    keywords: strs(s.keywords),
  }));
  const languages = list(data.languages)
    .map((l) => str(l.language))
    .filter((s): s is string => !!s);
  if (languages.length) {
    sections.push({
      id: "languages",
      title: "Languages",
      kind: "skills",
      visibility: "shown",
      entries: [
        { id: "languages-1", visibility: "shown", position: "Languages", keywords: languages },
      ],
    });
  }
  add("projects", "Projects", "other", (p) => ({
    position: str(p.name),
    startDate: month(p.startDate),
    endDate: month(p.endDate),
    summary: str(p.description),
    highlights: strs(p.highlights),
    url: str(p.url),
  }));

  const known = new Set([
    "$schema",
    "work",
    "volunteer",
    "education",
    "certificates",
    "awards",
    "skills",
    "languages",
    "projects",
  ]);
  const ignored = Object.keys(data).filter((key) => !known.has(key));
  return { doc: { v: 1, sections }, ignored };
}
