/**
 * EXPORT (Google Contacts' Export, FEATURES 7.6 / 7.7: Google CSV and vCard), of the visitor's
 * own contacts, as a file their browser saves (a `Blob` and a download link; nothing leaves the
 * browser). Both formats read back through our own importers (`parse-csv.ts`, `parse-vcard.ts`).
 * Plain TS; `downloadText` needs a document.
 *
 * vCard 3.0 (RFC 2426): FN, N (the whole name as the family part would be wrong, so N is empty
 * but present, as 3.0 requires it), ORG, TITLE, TEL;TYPE=, EMAIL;TYPE=, CATEGORIES, NOTE; text
 * escaped (`\\`, `\,`, `\;`, `\n`); CRLF lines. Long lines are not folded (RFC 2426 says "SHOULD").
 *
 * CSV (RFC 4180, the column names our importer reads, Google's older "Name" column): every
 * field quoted. A cell starting with `=`, `@`, a tab or a CR gets a leading `'` (OWASP "CSV
 * injection": a spreadsheet would run it as a formula). `+` and `-` are left alone: phones start
 * with `+`, and the guard would corrupt them on re-import.
 */
import type { LocalContact } from "./local-book";

type LabelNames = (id: string) => string | undefined;

const vText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

/** `TYPE=` from a label ("Mobile" -> `cell`); the label as is otherwise, letters only. */
const vType = (label: string) => {
  const l = label.toLowerCase();
  if (/mobile|cell/.test(l)) return "cell";
  if (/work|business/.test(l)) return "work";
  if (/home/.test(l)) return "home";
  return l.replace(/[^a-z]/g, "") || "";
};

export function toVCard(
  contacts: LocalContact[],
  labelName: LabelNames,
): string {
  const lines: string[] = [];
  for (const c of contacts) {
    lines.push("BEGIN:VCARD", "VERSION:3.0", `FN:${vText(c.name)}`, "N:;;;;");
    if (c.organization) lines.push(`ORG:${vText(c.organization)}`);
    if (c.title) lines.push(`TITLE:${vText(c.title)}`);
    for (const p of c.phones) {
      const t = vType(p.label);
      lines.push(`TEL${t ? `;TYPE=${t}` : ""}:${vText(p.value)}`);
    }
    for (const e of c.emails) {
      const t = vType(e.label);
      lines.push(`EMAIL${t ? `;TYPE=${t}` : ""}:${vText(e.value)}`);
    }
    const labels = c.labels.map(labelName).filter((n): n is string => !!n);
    if (labels.length) lines.push(`CATEGORIES:${labels.map(vText).join(",")}`);
    if (c.notes) lines.push(`NOTE:${vText(c.notes)}`);
    lines.push("END:VCARD");
  }
  return lines.join("\r\n") + "\r\n";
}

const cell = (value: string) => {
  const safe = /^[=@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function toCsv(contacts: LocalContact[], labelName: LabelNames): string {
  const phones = Math.max(1, ...contacts.map((c) => c.phones.length));
  const emails = Math.max(1, ...contacts.map((c) => c.emails.length));
  const header = [
    "Name",
    "Organization Name",
    "Organization Title",
    "Notes",
    "Labels",
    ...Array.from({ length: phones }, (_, i) => [
      `Phone ${i + 1} - Label`,
      `Phone ${i + 1} - Value`,
    ]).flat(),
    ...Array.from({ length: emails }, (_, i) => [
      `E-mail ${i + 1} - Label`,
      `E-mail ${i + 1} - Value`,
    ]).flat(),
  ];
  const rows = contacts.map((c) => [
    c.name,
    c.organization,
    c.title,
    c.notes,
    c.labels
      .map(labelName)
      .filter((n): n is string => !!n)
      .join(" ::: "),
    ...Array.from({ length: phones }, (_, i) => [
      c.phones[i]?.label ?? "",
      c.phones[i]?.value ?? "",
    ]).flat(),
    ...Array.from({ length: emails }, (_, i) => [
      c.emails[i]?.label ?? "",
      c.emails[i]?.value ?? "",
    ]).flat(),
  ]);
  return (
    [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
  );
}

/** Saves `text` as a file through the browser's download (no request is made). */
export function downloadText(
  fileName: string,
  type: string,
  text: string,
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // After the click has handed the file to the browser.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
