/**
 * CSV contacts: Google Contacts' "Google CSV" and Outlook's CSV, read into `ContactDraft`s.
 * Our own parser, not a dependency (second agent, 2026-11-24: an RFC 4180 reader is a small
 * state machine; papaparse's extra features are not needed here). e-store does the same:
 * `packages/dashboard/src/server/admin/import-csv.ts` `parseCsvRecords` (its product import) is a
 * dependency-free RFC 4180 reader with the same states; ours differs in one point: a `"` opens a
 * quoted field only at the field's start (RFC 4180 2.5; e-store's opens one anywhere). Context7 was over quota
 * 2026-11-24, so no library docs were compared; RFC 4180 is the reference.
 *
 * RFC 4180: fields split by commas, rows by CRLF (LF and CR accepted too); a field in double
 * quotes may hold commas, newlines and `""` for one quote. A leading BOM is dropped.
 *
 * Column names (case and spaces ignored):
 * - Google CSV today (support.google.com/contacts/answer/15147365, read 2026-11-24): First Name,
 *   Middle Name, Last Name, Nickname, Organization Name / Title / Department, "Email N - Label" /
 *   "Email N - Value", "Phone N - Label" / "Phone N - Value", Notes, Labels (" ::: " between
 *   values, also inside one Value cell).
 * - Google CSV before (still in old exports): Name, Given Name, Additional Name, Family Name,
 *   "E-mail N - Type" / "- Value", "Phone N - Type" / "- Value", "Organization 1 - Name" /
 *   "- Title", Group Membership.
 * - Outlook: First Name, Middle Name, Last Name, Company, Job Title, Department, "E-mail Address",
 *   "E-mail 2 Address", Mobile Phone, Business Phone, Home Phone, Categories (";" between).
 */
import { ImportError, type ContactDraft, type LabelledValue } from "./imported";

/** RFC 4180 rows. */
export function readCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const norm = (header: string) =>
  header
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .replace(/e-mail/g, "email")
    .trim();

/** One cell split on Google's " ::: " (several values in one cell). */
const multi = (value: string | undefined) =>
  (value ?? "")
    .split(":::")
    .map((v) => v.trim())
    .filter(Boolean);

/** Google writes "* Home" for a primary value's label: the star is dropped. */
const label = (value: string | undefined) =>
  (value ?? "").replace(/^\*\s*/, "").trim();

const NAME_HEADERS = [
  "name",
  "first name",
  "given name",
  "last name",
  "family name",
  "nickname",
  "organization name",
  "organization 1 - name",
  "company",
];

/** A CSV file's contacts. Throws `ImportError` when it is not a contacts CSV. */
export function parseContactsCsv(text: string): ContactDraft[] {
  const rows = readCsvRows(text);
  if (rows.length < 2) throw new ImportError("The file has no contacts.");
  const headers = rows[0].map(norm);
  const has = (h: string) => headers.includes(h);
  const knowsPhone = headers.some((h) => /phone/.test(h));
  if (!NAME_HEADERS.some(has) && !knowsPhone)
    throw new ImportError(
      "This doesn't look like a contacts CSV (no name or phone columns).",
    );

  return rows.slice(1).map((cells) => {
    const get = (h: string) => {
      const i = headers.indexOf(h);
      return i < 0 ? undefined : (cells[i] ?? "").trim() || undefined;
    };
    const phones: LabelledValue[] = [];
    const emails: LabelledValue[] = [];
    // Numbered pairs: "Phone 1 - Label|Type" + "Phone 1 - Value"; "Email N ..." likewise.
    headers.forEach((h, i) => {
      const m = /^(phone|email) (\d+) - value$/.exec(h);
      if (!m) return;
      const kind = m[1];
      const lab = label(
        get(`${kind} ${m[2]} - label`) ?? get(`${kind} ${m[2]} - type`),
      );
      for (const value of multi(cells[i]))
        (kind === "phone" ? phones : emails).push({ label: lab, value });
    });
    // Outlook's named columns.
    for (const [h, lab] of [
      ["mobile phone", "Mobile"],
      ["business phone", "Work"],
      ["business phone 2", "Work"],
      ["home phone", "Home"],
      ["home phone 2", "Home"],
      ["other phone", "Other"],
      ["primary phone", ""],
    ] as const)
      for (const value of multi(get(h))) phones.push({ label: lab, value });
    for (const h of ["email address", "email 2 address", "email 3 address"])
      for (const value of multi(get(h))) emails.push({ label: "", value });

    const labels = [
      ...multi(get("labels")),
      ...multi(get("group membership")),
      ...(get("categories") ?? "").split(";"),
    ];

    return {
      name: get("name") ?? get("file as"),
      given: get("first name") ?? get("given name"),
      middle: get("middle name") ?? get("additional name"),
      family: get("last name") ?? get("family name"),
      nickname: get("nickname"),
      organization:
        get("organization name") ??
        get("organization 1 - name") ??
        get("company"),
      title:
        get("organization title") ??
        get("organization 1 - title") ??
        get("job title"),
      department:
        get("organization department") ??
        get("organization 1 - department") ??
        get("department"),
      phones,
      emails,
      labels,
      notes: get("notes"),
    };
  });
}
