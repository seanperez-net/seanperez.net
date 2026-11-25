/**
 * THE VISITOR'S APPS (2026-11-25). Owner: Contact me is "its own little app that can be deleted
 * but its there by default". The site's optional apps are ON unless the visitor REMOVED them;
 * this document lists the removed ones, kept in their browser through the shared seam
 * (`local-store.ts` `changeLocalDoc`, doc `apps.local`). Never on the server; there is always a
 * way back (Undo, `/profile/` "Your apps", the account menu's "Add Contact me back").
 *
 * Why a synced DOCUMENT and not a localStorage pref (memory `local-first-shared-seam`: account
 * data -> doc, per-device state -> localStorage): which apps a person has is part of their
 * ACCOUNT (Google Workspace's app list follows the account to every device), not a fact about
 * this screen like the map's camera or the theme. So it is in `SYNC_DOCS` for admin.
 *
 * Plain TS + valibot, no Qwik, no storage, no clock. Stored data is untrusted: an id that is not a
 * known removable app is dropped on read; a damaged doc reads as "nothing removed" (every app
 * back), never as "everything removed".
 */
import * as v from "valibot";

export const APPS_DOC = "apps.local";

/** The apps a visitor may remove (their ids are the companions' ids). */
export const REMOVABLE_APPS = ["contact"] as const;
export type RemovableApp = (typeof REMOVABLE_APPS)[number];

export interface AppsLocalDoc {
  v: 1;
  removed: RemovableApp[];
  updatedAt: number;
  syncedAt?: number;
}

// zod 4's `.int()` was a SAFE integer (2026-11-25 port): `safeInteger`, not `integer`.
const time = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const docSchema = v.strictObject({
  v: v.literal(1),
  removed: v.pipe(
    v.array(v.pipe(v.string(), v.maxLength(40))),
    v.maxLength(20),
  ),
  updatedAt: time,
  syncedAt: v.optional(time),
});

const isRemovable = (id: string): id is RemovableApp =>
  (REMOVABLE_APPS as readonly string[]).includes(id);

export const emptyAppsDoc = (): AppsLocalDoc => ({
  v: 1,
  removed: [],
  updatedAt: 0,
});

/** The stored doc, or the empty one (every app present) when missing or not valid. */
export function parseAppsDoc(raw: unknown): AppsLocalDoc {
  const parsed = v.safeParse(docSchema, raw);
  if (!parsed.success) return emptyAppsDoc();
  return {
    ...parsed.output,
    v: 1,
    removed: [...new Set(parsed.output.removed.filter(isRemovable))],
  };
}

/** `doc` with `app` removed (`true`) or back (`false`); the same doc when nothing changes. */
export function setAppRemoved(
  doc: AppsLocalDoc,
  app: RemovableApp,
  removed: boolean,
  now: number,
): AppsLocalDoc {
  if (doc.removed.includes(app) === removed) return doc;
  return {
    ...doc,
    removed: removed
      ? [...doc.removed, app]
      : doc.removed.filter((a) => a !== app),
    updatedAt: Math.max(now, doc.updatedAt + 1),
  };
}

/** What admin's dispatcher would send: the one record, or nothing. */
export const pendingApps = (doc: AppsLocalDoc): AppsLocalDoc | null =>
  doc.updatedAt > (doc.syncedAt ?? 0) ? doc : null;

/** After the server confirmed `sent`: synced, unless it changed since. */
export const markAppsSynced = (
  doc: AppsLocalDoc,
  sent: AppsLocalDoc | null,
): AppsLocalDoc =>
  sent && sent.updatedAt === doc.updatedAt
    ? { ...doc, syncedAt: doc.updatedAt }
    : doc;
