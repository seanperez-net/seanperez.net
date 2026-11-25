/**
 * IMPORTED CONTACTS (owner, 2026-11-24: "if someone imports it should import but not save it
 * into the db just import it into their local opfs or w.e save it on their browser but allow it
 * to display"). A visitor's own contacts, read from a CSV or vCard file IN THE BROWSER and kept
 * ONLY in that browser (`local-book-store.ts`, 2026-11-24). Nothing here is sent to the server: there is no
 * `routeAction$`, `server$` or fetch on this path. Saving to a real account is the admin app's
 * job (PLAN.md "apps/admin", not built).
 *
 * Plain TS, client-safe, no Qwik: the parsers (`parse-csv.ts`, `parse-vcard.ts`) turn a file into
 * `ContactDraft`s, `finishImport` cleans, caps and ids them. Moves to a package (`contacts-io`)
 * when the admin app needs the same parsing (rule: a package only when a second app needs it).
 *
 * Safety (second agent, 2026-11-24): text only, rendered through JSX text (escaped), never as
 * HTML or markdown; control and bidi-override characters stripped (they can spoof a name); every
 * field and list capped; the id is ours (`crypto.randomUUID`), never taken from the file; stored
 * data is re-checked by `parseBook` (`local-book.ts`) on every read (another version of the site, or the
 * visitor, may have written it).
 */
/** Google Contacts' advice: split files over 3,000 contacts (help answer 15147365, read 2026-11-24). */
export const MAX_CONTACTS_PER_FILE = 3000;
/** Every local contact this browser keeps, created or imported (the list renders a page at a time). */
export const MAX_IMPORTED = 3000;
/** Files over this are refused before they are read. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FIELD = 500;
export const MAX_NOTES = 5000;
export const MAX_VALUES = 10;

/** One phone, email or other value with its label ("Mobile", "Work"). */
export interface LabelledValue {
  label: string;
  value: string;
}

/** What a parser returns per contact, before cleaning. */
export interface ContactDraft {
  name?: string;
  given?: string;
  middle?: string;
  family?: string;
  nickname?: string;
  organization?: string;
  title?: string;
  department?: string;
  phones: LabelledValue[];
  emails: LabelledValue[];
  labels: string[];
  notes?: string;
}

/** One contact read from a file, cleaned (labels are still the file's NAMES). The store turns it
 * into a `LocalContact` (`local-book.ts`), the labels into label ids. */
export interface ImportedContact {
  id: string;
  name: string;
  organization: string;
  title: string;
  phones: LabelledValue[];
  emails: LabelledValue[];
  labels: string[];
  notes: string;
  /** ISO time of the import. */
  importedAt: string;
}

/** The result of reading one file. */
export interface ImportResult {
  contacts: ImportedContact[];
  /** Entries with no name, phone, email or organization. */
  skipped: number;
  /** Entries past `MAX_CONTACTS_PER_FILE`. */
  overLimit: number;
}

export class ImportError extends Error {}

// C0 and C1 controls except tab and newline, DEL, zero-width and bidi controls.
const CONTROLS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** One line of text: NFC, no controls, single spaces, capped. */
export function cleanLine(value: unknown, max = MAX_FIELD): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(CONTROLS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Multi-line text (notes): newlines kept, at most two in a row. */
export function cleanText(value: unknown, max = MAX_NOTES): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROLS, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Labelled values cleaned: one line each, no repeats (case blind), at most `MAX_VALUES`. */
export const cleanValues = (values: LabelledValue[]): LabelledValue[] => {
  const seen = new Set<string>();
  const out: LabelledValue[] = [];
  for (const v of values) {
    const value = cleanLine(v.value, 200);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push({ label: cleanLine(v.label, 40), value });
    if (out.length === MAX_VALUES) break;
  }
  return out;
};

/** Google's system groups in its CSV "Labels" / "Group Membership" ("* myContacts", "* Starred"). */
export const cleanLabels = (labels: string[]): string[] =>
  [
    ...new Set(
      labels
        .map((l) => cleanLine(l, 60))
        .filter((l) => l && !l.startsWith("*")),
    ),
  ].slice(0, MAX_VALUES);

/** The display name: the file's full name, else the parts, else the nickname. */
function displayName(d: ContactDraft): string {
  return (
    cleanLine(d.name) ||
    cleanLine([d.given, d.middle, d.family].filter(Boolean).join(" ")) ||
    cleanLine(d.nickname)
  );
}

/** A key that spots the same contact imported twice (name and sorted phones / emails). */
export const sameContactKey = (c: ImportedContact): string =>
  [
    c.name.toLowerCase(),
    c.organization.toLowerCase(),
    ...c.phones.map((p) => p.value.replace(/[^\d+]/g, "")).sort(),
    ...c.emails.map((e) => e.value.toLowerCase()).sort(),
  ].join("|");

/** Drafts to stored contacts: cleaned, capped, given our own ids. */
export function finishImport(
  drafts: ContactDraft[],
  newId: () => string = () => crypto.randomUUID(),
  now = new Date().toISOString(),
): ImportResult {
  const contacts: ImportedContact[] = [];
  let skipped = 0;
  let overLimit = 0;
  for (const d of drafts) {
    const phones = cleanValues(d.phones);
    const emails = cleanValues(d.emails);
    const organization = cleanLine(
      [d.organization, d.department].filter(Boolean).join(", "),
    );
    const title = cleanLine(d.title);
    const name =
      displayName(d) || organization || phones[0]?.value || emails[0]?.value;
    if (!name) {
      skipped++;
      continue;
    }
    if (contacts.length === MAX_CONTACTS_PER_FILE) {
      overLimit++;
      continue;
    }
    contacts.push({
      id: newId(),
      name,
      organization,
      title,
      phones,
      emails,
      labels: cleanLabels(d.labels),
      notes: cleanText(d.notes),
      importedAt: now,
    });
  }
  return { contacts, skipped, overLimit };
}

/** The bytes of a file as text: UTF-8, else Windows-1252 (Outlook's CSV export often is). */
export function decodeFileText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** The file's format from its name, else its content. */
export function detectFormat(fileName: string, text: string): "vcard" | "csv" {
  if (/\.(vcf|vcard)$/i.test(fileName)) return "vcard";
  if (/\.csv$/i.test(fileName)) return "csv";
  return /^\uFEFF?\s*BEGIN:VCARD/i.test(text) ? "vcard" : "csv";
}

/** The digits a phone search compares ("+1 (555) 010-0" -> "15550100"). */
export const phoneDigits = (value: string) => value.replace(/\D/g, "");
