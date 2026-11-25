/**
 * The Contacts app's address book (owner, 2026-11-24: "change about to contacts and only have
 * my contact"): ONE contact, the owner. His name, headline, location, bio and links are the
 * shared PROFILE record (`profile/profile.server.ts` `getProfile`, one source with `/profile/`);
 * this file only adds what makes him a contact: the URL slug, the avatar's tone seed and the
 * presence the site shows. Client-safe (no server imports). NO email, NO phone (no-email rule).
 *
 * 2026-11-24 (owner: "maybe add the assistant to the contacts? ... it should be the same as a
 * user"): every contact is an ACCOUNT (`content/accounts.ts`, the record Messages shares). The
 * assistant is a contact of kind `app`, listed in its own "Apps" section after the people, its
 * page links to its chat. Devices are accounts too but NOT contacts (they live in Devices and
 * Maps; PLAN.md).
 */
import type { AvatarPresence, IconName, LayoutDrawerItem } from "@seanperez/ui";
import { ASSISTANT_ACCOUNT, OWNER_ACCOUNT } from "./accounts";
import { WIP } from "../demo/wip";

/**
 * The book's LABELS (Google Contacts' labels, e-store's `Contact.labels`): demo data, one per
 * kind of contact today. Each label is a list at `/contacts/label/<id>/`.
 */
export interface ContactLabel {
  id: string;
  name: string;
  /** The list's empty-state line, when the generic one does not fit. */
  emptyDetail?: string;
}

/** The list of every contact imported into this browser (`LocalContact.source === "import"`). */
export const IMPORTED_LABEL_ID = "imported";

export const CONTACT_LABELS: ContactLabel[] = [
  { id: "work", name: "Work" },
  // WIP: the Apps label holds only the Assistant (release switch, `demo/wip.ts`); off, no label.
  ...(WIP ? [{ id: "apps", name: "Apps" }] : []),
  {
    id: IMPORTED_LABEL_ID,
    name: "Imported",
    emptyDetail:
      "Contacts you import are kept in this browser only. Nothing is uploaded.",
  },
];

export interface ContactEntry {
  /** The detail page's slug: `/contacts/<id>/`. */
  id: string;
  /** The account it shows (`content/accounts.ts`). */
  accountId: string;
  /** A person (the profile record) or an app (its account only). */
  kind: "person" | "app";
  /** The avatar's tone seed (the same as the account menu's, so the colour matches). */
  seed: string;
  /** Its presence as shown (the owner: his account's static value since 2026-11-25). An app has none. */
  presence?: AvatarPresence;
  /** Its labels (`CONTACT_LABELS` ids). */
  labels: string[];
  /**
   * When the site added it to everyone's contacts (ISO, midday UTC so no time zone moves the
   * day): the person page's History "Added to contacts" (2026-11-25, Google's History).
   */
  addedAt: string;
}

const ALL_CONTACTS: ContactEntry[] = [
  {
    id: OWNER_ACCOUNT.contactId!,
    accountId: OWNER_ACCOUNT.id,
    kind: "person",
    seed: OWNER_ACCOUNT.id,
    presence: OWNER_ACCOUNT.presence,
    labels: ["work"],
    // The day Contacts replaced About (`home-resume-no-footer`).
    addedAt: "2026-11-24T12:00:00Z",
  },
  {
    id: ASSISTANT_ACCOUNT.contactId!,
    accountId: ASSISTANT_ACCOUNT.id,
    kind: "app",
    seed: ASSISTANT_ACCOUNT.id,
    labels: ["apps"],
    addedAt: "2026-11-24T12:00:00Z",
  },
];

/**
 * The site's contacts. WIP: the Assistant (a placeholder, no AI connected) only with the release
 * switch on (`demo/wip.ts`); off, `/contacts/assistant/` is a 404 and no list or search shows it.
 */
export const CONTACTS: ContactEntry[] = WIP
  ? ALL_CONTACTS
  : ALL_CONTACTS.filter((c) => c.kind !== "app");

/**
 * The app's LISTS, one route each (2026-11-24, owner: "give Contacts drawer sections like
 * Google's"). Google Contacts' left navigation, measured signed in on 2026-11-24 (layout only,
 * `.claude/notes/contacts-layout-2026-11-24.md`): Contacts, Frequent, Other contacts; "Fix &
 * manage" (Merge & fix, Import, Trash); "Labels". Google's paths are `/`, `/frequent`, `/other`,
 * `/suggestions`, `/trash`; ours sit under `/contacts/` with e-store's proposed names
 * (`research/contacts.google.com/ROUTES.md`: `merge`, `label/<id>`). Import is a dialog in
 * Google; here it is a route that opens the dialog (drawer rows are links, plain data).
 *
 * `slug` is the path under `/contacts/` (`""` = all contacts).
 */
export type ContactsListSlug =
  | ""
  | "frequent"
  | "other"
  | "merge"
  | "trash"
  | "import"
  | "new"
  | `label/${string}`;

export interface ContactsList {
  slug: ContactsListSlug;
  /** The list pane's title and the drawer row. */
  label: string;
  icon: IconName;
  /** The empty state's headline (the list shows no rows). */
  empty: string;
  /** One line under it, when there is more to say. */
  emptyDetail?: string;
}

const LISTS: ContactsList[] = [
  {
    slug: "",
    label: "Contacts",
    icon: "person",
    empty: "No contacts yet",
  },
  {
    slug: "frequent",
    label: "Frequent",
    icon: "history",
    empty: "No frequent contacts",
    emptyDetail: "The people you open and get in touch with most show up here.",
  },
  {
    slug: "other",
    label: "Other contacts",
    icon: "person_search",
    empty: "No other contacts",
    emptyDetail:
      "People you interact with but have not saved as contacts show up here.",
  },
  {
    slug: "merge",
    label: "Merge & fix",
    icon: "auto_fix_high",
    empty: "No duplicates",
    emptyDetail: "Contacts that look like the same person show up here.",
  },
  {
    slug: "import",
    label: "Import",
    icon: "upload_file",
    empty: "No contacts yet",
  },
  {
    slug: "trash",
    label: "Trash",
    icon: "delete",
    empty: "No contacts in Trash",
  },
];

const labelList = (label: ContactLabel): ContactsList => ({
  slug: `label/${label.id}`,
  label: label.name,
  icon: label.id === IMPORTED_LABEL_ID ? "upload_file" : "label",
  empty: "No contacts with this label",
  emptyDetail: label.emptyDetail,
});

/**
 * Routes that are the full list with a DIALOG open (Google's Import and "Create label" are
 * dialogs, its Create contact a page at `/new`; ours are routes so a drawer row, the FAB and a
 * link can open them, as Import since 2026-11-24). Closing goes back to `/contacts/`.
 */
export const DIALOG_SLUGS: ContactsListSlug[] = ["import", "new", "label/new"];

/** A list for one of the VISITOR's labels (browser only; the layout fills in its name). */
const localLabelList = (id: string): ContactsList => ({
  slug: `label/${id}`,
  label: "Label",
  icon: "label",
  empty: "No contacts with this label",
  emptyDetail: "Add contacts to it from a contact's page, or select several.",
});

/** Every list, the site's labels included (the visitor's are added by `listForPath`). */
export const CONTACTS_LISTS: ContactsList[] = [
  ...LISTS,
  {
    slug: "new",
    label: "Create contact",
    icon: "person_add",
    empty: "No contacts yet",
  },
  {
    slug: "label/new",
    label: "Create label",
    icon: "add",
    empty: "No contacts yet",
  },
  ...CONTACT_LABELS.map(labelList),
];

export const contactsListHref = (slug: ContactsListSlug) =>
  slug ? `/contacts/${slug}/` : "/contacts/";

/** The list a path shows (`/contacts/trash/` -> Trash), else null (a contact's page). */
export const listForPath = (pathname: string): ContactsList | null => {
  const rest = /^\/contacts\/(.*?)\/?$/.exec(pathname)?.[1] ?? null;
  if (rest === null) return null;
  const known = CONTACTS_LISTS.find((list) => list.slug === rest);
  if (known) return known;
  const label = /^label\/(l-[\w-]{1,64})$/.exec(rest)?.[1];
  return label ? localLabelList(label) : null;
};

/** The site contacts a list holds (the visitor's own are added by the layout). */
export const siteContactsIn = <T extends ContactEntry>(
  slug: ContactsListSlug,
  rows: T[],
): T[] => {
  if (slug === "" || DIALOG_SLUGS.includes(slug)) return rows;
  if (slug.startsWith("label/")) {
    const id = slug.slice("label/".length);
    return rows.filter((row) => row.labels.includes(id));
  }
  return [];
};

const row = (list: ContactsList): LayoutDrawerItem => ({
  href: contactsListHref(list.slug),
  label: list.label,
  icon: list.icon,
});
const bySlug = (slug: ContactsListSlug) =>
  row(CONTACTS_LISTS.find((list) => list.slug === slug)!);

/**
 * The Contacts drawer (`routes/layout.tsx` `DRAWER_GROUPS`), in Google's measured order: three
 * rows, then the "Fix & manage" and "Labels" groups (Google's two headed sections; e-store's
 * level-2 groups). The visitor's own labels (`labels`, from their browser) follow the site's.
 * Google's "Create label" is a "+" beside the Labels heading; a drawer group header holds no
 * control (`LayoutDrawerItem` is plain rows), so here it is the group's LAST ROW, a link to
 * `/contacts/label/new/` that opens the dialog (2026-11-24; as Import).
 */
export const contactsDrawerGroups = (
  labels: { id: string; name: string }[] = [],
): LayoutDrawerItem[] => [
  bySlug(""),
  bySlug("frequent"),
  // WIP: nothing fills "Other contacts" yet; off, no row (its route is a 404).
  ...(WIP ? [bySlug("other")] : []),
  {
    label: "Fix & manage",
    open: true,
    items: [bySlug("merge"), bySlug("import"), bySlug("trash")],
  },
  {
    label: "Labels",
    open: true,
    items: [
      ...CONTACT_LABELS.map((label) => row(labelList(label))),
      ...[...labels]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((l) => ({
          href: contactsListHref(`label/${l.id}`),
          label: l.name,
          icon: "label" as const,
        })),
      bySlug("label/new"),
    ],
  },
];

/** The owner: what `/contacts/` shows in the detail pane beside the list. */
export const DEFAULT_CONTACT_ID = CONTACTS[0].id;

/** The detail heading every contact profile renders, the focus target on open. */
export const CONTACT_HEADING_ID = "contact-name";

export const contactHref = (id: string) => `/contacts/${id}/`;

export const findContact = (id: string) =>
  CONTACTS.find((contact) => contact.id === id);

/** The presence as the profile's facts row writes it. */
export const PRESENCE_WORDS: Record<AvatarPresence, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};
