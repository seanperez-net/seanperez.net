/**
 * vCard contacts (.vcf), versions 2.1, 3.0 (RFC 2426) and 4.0 (RFC 6350), read into
 * `ContactDraft`s. Our own reader, not a dependency. PROOFED 2026-11-24 against ical.js 2.2.1, the
 * parser e-store's calendar import uses (`packages/calendar/src/utils/ical-import.ts`), which also
 * reads vCard 3.0 / 4.0 (jCard): run on the same test file, it gave the same names, phones,
 * organization, note and categories for the 3.0 and 4.0 cards, but it REFUSED THE WHOLE FILE at a
 * vCard 2.1 card (`TEL;HOME:...`: "Invalid parameters"), and it has no quoted-printable decoding
 * (source read: no QUOTED-PRINTABLE / CHARSET handling). 2.1 is what older Android phones, feature
 * phones and Outlook export, and Google Contacts takes them. Adding ical.js (about 23 KB gzip)
 * would still need this 2.1 path, so it is not added. Context7 was over quota; the RFCs are the
 * reference.
 *
 * What it does:
 * - unfolds lines (RFC 6350 3.2: a CRLF followed by a space or tab continues the line);
 * - 2.1 `ENCODING=QUOTED-PRINTABLE` (a line ending in `=` continues; `=XX` bytes, UTF-8);
 * - drops a property group (`item1.TEL` -> `TEL`);
 * - unescapes `\n`, `\,`, `\;`, `\\` (RFC 6350 3.4);
 * - reads FN, N, NICKNAME, ORG, TITLE, TEL, EMAIL, NOTE, CATEGORIES; the TYPE parameter (3.0 / 4.0
 *   `TYPE=cell,voice`, 2.1 bare `TEL;CELL`) becomes the label; `tel:` URIs (4.0) lose the scheme.
 * - PHOTO, LOGO, SOUND and KEY are skipped (text only), and so is everything else.
 */
import { ImportError, type ContactDraft } from "./imported";

/** Unfolded logical lines; 2.1 quoted-printable soft breaks joined. */
function logicalLines(text: string): string[] {
  const raw = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  const out: string[] = [];
  for (const line of raw) {
    const prev = out.length - 1;
    if (/^[ \t]/.test(line) && prev >= 0) out[prev] += line.slice(1);
    else if (
      prev >= 0 &&
      /ENCODING=QUOTED-PRINTABLE/i.test(out[prev]) &&
      out[prev].endsWith("=")
    )
      out[prev] = out[prev].slice(0, -1) + line;
    else out.push(line);
  }
  return out;
}

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const hex = value.slice(i + 1, i + 3);
    if (value[i] === "=" && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else bytes.push(value.charCodeAt(i) & 0xff);
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

/** Splits on an unescaped separator, then unescapes each part. */
function splitEscaped(value: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "\\" && i + 1 < value.length) {
      const next = value[++i];
      cur += next === "n" || next === "N" ? "\n" : next;
    } else if (ch === sep) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

const unescape = (value: string) => splitEscaped(value, "\u0000")[0];

const TYPE_WORDS: Record<string, string> = {
  cell: "Mobile",
  mobile: "Mobile",
  work: "Work",
  home: "Home",
  fax: "Fax",
  pager: "Pager",
  main: "Main",
  other: "Other",
};

/** A TYPE parameter (or 2.1's bare words) as a label: "Mobile", "Work", ... */
function typeLabel(params: string[]): string {
  const words = params.flatMap((p) => {
    const [k, v] = p.includes("=") ? p.split("=") : ["type", p];
    return k.toLowerCase() === "type"
      ? v.replace(/"/g, "").toLowerCase().split(",")
      : [];
  });
  for (const w of words) if (TYPE_WORDS[w]) return TYPE_WORDS[w];
  return "";
}

const SKIPPED = new Set(["PHOTO", "LOGO", "SOUND", "KEY"]);

/** A vCard file's contacts. Throws `ImportError` when it holds no vCard. */
export function parseVCards(text: string): ContactDraft[] {
  const cards: ContactDraft[] = [];
  let card: ContactDraft | null = null;
  for (const line of logicalLines(text)) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    let value = line.slice(colon + 1);
    const [nameWithGroup, ...params] = head.split(";");
    const name = nameWithGroup.replace(/^[^.]*\./, "").toUpperCase();

    if (name === "BEGIN" && /^vcard$/i.test(value.trim())) {
      card = { phones: [], emails: [], labels: [] };
      continue;
    }
    if (!card) continue;
    if (name === "END" && /^vcard$/i.test(value.trim())) {
      cards.push(card);
      card = null;
      continue;
    }
    if (SKIPPED.has(name)) continue;
    if (params.some((p) => /^(ENCODING=)?QUOTED-PRINTABLE$/i.test(p)))
      value = decodeQuotedPrintable(value);

    switch (name) {
      case "FN":
        card.name = unescape(value);
        break;
      case "N": {
        const [family, given, middle] = splitEscaped(value, ";");
        Object.assign(card, { family, given, middle });
        break;
      }
      case "NICKNAME":
        card.nickname = splitEscaped(value, ",")[0];
        break;
      case "ORG": {
        const [org, ...units] = splitEscaped(value, ";");
        card.organization = org;
        card.department = units.filter(Boolean).join(", ") || undefined;
        break;
      }
      case "TITLE":
        card.title = unescape(value);
        break;
      case "TEL":
        card.phones.push({
          label: typeLabel(params),
          value: unescape(value).replace(/^tel:/i, ""),
        });
        break;
      case "EMAIL":
        card.emails.push({
          label: typeLabel(params),
          value: unescape(value).replace(/^mailto:/i, ""),
        });
        break;
      case "NOTE":
        card.notes = unescape(value);
        break;
      case "CATEGORIES":
        card.labels.push(...splitEscaped(value, ","));
        break;
    }
  }
  if (!cards.length) throw new ImportError("The file has no vCard contacts.");
  return cards;
}
