/**
 * The documents the admin app's service worker would sync (2026-11-24, the shared seam in
 * `local-store.ts`). Each is the visitor's ACCOUNT data, kept in their browser
 * (`changeLocalDoc`), carrying its own outbox. The dispatcher hears a document NAME (the
 * Background Sync tag); the worker looks it up here, reads the document, sends
 * `pending(doc)` to `endpoint`, then (under the lock again) writes `markSynced(doc, sent)`.
 *
 * NOTHING on the public site imports this: the site never dispatches. It is here so the one
 * list of synced documents lives next to the code that writes them. Local-only data (recent
 * searches, Frequent counts, the map camera, the theme) is deliberately NOT here
 * (`.claude/notes/local-first-seam-audit-2026-11-24.md`).
 *
 * Plain TS, no DOM: safe to import from a service worker.
 */
import {
  markSynced,
  parseBook,
  pendingChanges,
  type LocalBook,
} from "./contacts/local-book";
import {
  PRESENCE_DOC,
  markPresenceSynced,
  parsePresence,
  pendingPresence,
  type PresenceDoc,
} from "./presence/presence";
import {
  PROFILE_DOC,
  markProfileSynced,
  parseProfileDoc,
  pendingProfile,
  type ProfileLocalDoc,
} from "./profile/profile-local";
import {
  MESSAGES_DOC,
  markMessagesSynced,
  parseMessagesDoc,
  pendingMessages,
  type MessagesLocalDoc,
} from "./messages/messages-local";
import {
  APPS_DOC,
  markAppsSynced,
  parseAppsDoc,
  pendingApps,
  type AppsLocalDoc,
} from "./apps/my-apps";

export interface SyncDoc<D, P> {
  /** The document's name in `local-store.ts` (and the Background Sync tag). */
  name: string;
  parse: (raw: unknown) => D;
  /** What would be sent; `null` or empty lists when nothing is pending. */
  pending: (doc: D) => P;
  /** After the server confirmed `sent`. */
  markSynced: (doc: D, sent: P) => D;
  /** The admin app's JSON endpoint (same origin, behind Access). Not built yet. */
  endpoint: string;
}

const contacts: SyncDoc<LocalBook, ReturnType<typeof pendingChanges>> = {
  name: "contacts.local",
  parse: parseBook,
  pending: pendingChanges,
  markSynced,
  endpoint: "/api/sync/contacts",
};

const presence: SyncDoc<PresenceDoc, PresenceDoc | null> = {
  name: PRESENCE_DOC,
  parse: parsePresence,
  pending: pendingPresence,
  markSynced: markPresenceSynced,
  endpoint: "/api/sync/presence",
};

/**
 * The signed-in user's profile edit (2026-11-24): the changed fields as an override over the
 * server profile; admin's endpoint would upsert them into D1 `profile` (an empty `fields` with a
 * newer stamp = a reset to the server's values, which then needs nothing written).
 */
const profile: SyncDoc<ProfileLocalDoc, ProfileLocalDoc | null> = {
  name: PROFILE_DOC,
  parse: parseProfileDoc,
  pending: pendingProfile,
  markSynced: markProfileSynced,
  endpoint: "/api/sync/profile",
};

/**
 * The visitor's sent messages (2026-11-25): admin's endpoint would post the unconfirmed ones to
 * their threads. The assistant's canned replies are stored too but never sent (not `mine`).
 * Deletions of messages the server has (the site's, synced ones) go as the whole `hidden` list
 * when it changed (`hiddenAt` > `hiddenSyncedAt`).
 */
const messages: SyncDoc<
  MessagesLocalDoc,
  ReturnType<typeof pendingMessages>
> = {
  name: MESSAGES_DOC,
  parse: parseMessagesDoc,
  pending: pendingMessages,
  markSynced: markMessagesSynced,
  endpoint: "/api/sync/messages",
};

/**
 * The apps the visitor removed (2026-11-25, Contact me): account data, so it would follow them to
 * their other devices; admin's endpoint would store the one record.
 */
const apps: SyncDoc<AppsLocalDoc, AppsLocalDoc | null> = {
  name: APPS_DOC,
  parse: parseAppsDoc,
  pending: pendingApps,
  markSynced: markAppsSynced,
  endpoint: "/api/sync/apps",
};

/** Every synced document, by name. */
export const SYNC_DOCS = {
  [contacts.name]: contacts,
  [presence.name]: presence,
  [profile.name]: profile,
  [messages.name]: messages,
  [apps.name]: apps,
} as const;
