/**
 * The site's ACCOUNTS (owner, 2026-11-24: "the assistant probably needs an account ... i think it
 * should be the same as a user that it gets permisions etc probably more tigheter but thats later
 * on this is a setting up for maybe that later"): ONE record type for everyone who can appear in
 * Contacts or post in Messages, a person, the assistant (an app) or a device.
 *
 * Static demo data, read-only, client-safe (no server imports). NO email, NO phone (no-email
 * rule). Nothing here is checked anywhere yet: `role` and `scopes` are PLACEHOLDERS describing
 * the future model (PLAN.md "Accounts and permissions"), there is no sign-in and no auth.
 *
 * NEW, not in e-store: e-store's `@estore/chat` `ChatPerson` and `@estore/contacts` `Contact` are
 * separate shapes; here Contacts and Messages share this one record (an account), and each app
 * derives its own view of it (`toChatPerson`, the Contacts rows).
 */
import type { ChatPerson } from "@seanperez/chat";
import type { AvatarPresence, IconName } from "@seanperez/ui";
import { SERVER_PRESENCE } from "../presence/presence";

/** What the account is: someone, an app acting for someone, or a machine. */
export type AccountKind = "person" | "assistant" | "device";

/**
 * The account's role (placeholder). `admin` is the site's ADMIN account (Sean Perez, 2026-11-25:
 * it only SENDS, a message to everyone); a visitor is a `member` (the guest); an app or a device
 * gets the narrower roles, never `admin`.
 */
export type AccountRole = "admin" | "member" | "app" | "device";

/**
 * What an account may do (placeholder scopes, named `resource:action`). The future rule: an app
 * holds only scopes a person GRANTED it, a subset of that person's own, each revocable; a device
 * posts only to the spaces it is a member of. Nothing enforces these today.
 */
export type AccountScope =
  | "messages:read"
  | "messages:write"
  | "contacts:read"
  | "contacts:write"
  | "spaces:post"
  | "profile:write";

export interface Account {
  /** Stable id: the avatar's tone seed, the chat author id, a device's map node id. */
  id: string;
  kind: AccountKind;
  name: string;
  /** Shown on the avatar instead of initials (an app, a device). */
  icon?: IconName;
  /** Its presence as the server renders it (the guest: the default; live = `usePresence()`). */
  presence?: AvatarPresence;
  /** One line under the name (Contacts' list row and header). */
  headline: string;
  /** An app (the assistant): listed under Contacts' Apps and Messages' Apps. */
  isApp: boolean;
  role: AccountRole;
  scopes: readonly AccountScope[];
  /** Who granted an app or a device its scopes (an account id). Placeholder. */
  grantedBy?: string;
  /** Its Contacts page slug, when it has one (`/contacts/<contactId>/`). */
  contactId?: string;
  /** Its direct conversation in Messages, when it has one (`/messages/<chatId>/`). */
  chatId?: string;
  /** About it, plain text (an app's contact page). */
  about?: string;
}

/**
 * The site's ADMIN account, Sean Perez (owner, 2026-11-25: "make sure that all of the sean perez as
 * a user on the client side is disconnected its only a message thats sent to everyone from the sean
 * perez admin account"). On the client he is NEVER a user: not the visitor, not a presence, not a
 * profile, not a member who talks in spaces. He appears as the SENDER of messages to everyone (his
 * welcome, the Site updates announcements) and as a contact (the résumé). The real admin account
 * (server side, signed in to /admin) is still to be made: PLAN.md. A PERSON in the visitor's
 * Contacts and Messages, never the visitor (owner decision 2026-11-25, memory `visitor-is-guest-you`: the site no longer looks
 * signed in as him). His contact page is the résumé (`/contacts/sean-perez/`), his direct thread
 * holds his welcome message (`/messages/sean-perez/`); "Contact me" is how a visitor really
 * reaches him.
 */
export const OWNER_ACCOUNT: Account = {
  id: "seanperez-net",
  kind: "person",
  name: "Sean Perez",
  // A STATIC value, not live (2026-11-25): the public site never tracks or receives the owner's
  // real status (memory `presence-follows-visitor`: no server presence on the site), so it claims
  // nothing. `offline` is the one state that promises no reply here; the visitor's own live status
  // belongs to `GUEST_ACCOUNT`. Admin's real presence would replace this through sync later.
  presence: "offline",
  headline: "",
  isApp: false,
  role: "admin",
  scopes: [
    "messages:read",
    "messages:write",
    "contacts:read",
    "contacts:write",
    "spaces:post",
    "profile:write",
  ],
  contactId: "sean-perez",
  chatId: "sean-perez",
};

/**
 * THE VISITOR (owner decision 2026-11-25, memory `visitor-is-guest-you`): every visitor is a
 * GUEST account, "You" until they set a name in Profile (`/profile/` Edit, saved in their own
 * browser, `profile/profile-local.ts`). The account menu, the presence dot, the "(you)" notes
 * thread and `/profile/` are THEIRS. One id for every visitor: nothing is stored on the server,
 * each browser holds its own copy. NO email, NO phone.
 *
 * NEW, not in e-store (e-store has real sign-in; there is none here).
 */
export const GUEST_ACCOUNT: Account = {
  id: "you",
  kind: "person",
  name: "You",
  // The SERVER-RENDER default only: the live value is the visitor's own status, `usePresence()`
  // (`presence/use-presence.tsx`), swapped in where the page shows it (`withOwnPresence`,
  // `withOwnAccount`).
  presence: SERVER_PRESENCE,
  headline: "",
  isApp: false,
  role: "member",
  scopes: [
    "messages:read",
    "messages:write",
    "contacts:read",
    "contacts:write",
    "profile:write",
  ],
  chatId: "you",
};

/**
 * The assistant: an app with an account like anyone else's, but TIGHTER (owner): it reads and
 * writes only its own conversation, and may read Contacts; granted by the owner. Placeholder: no
 * AI is connected (the replies are canned, `ASSISTANT_REPLY`).
 */
export const ASSISTANT_ACCOUNT: Account = {
  id: "assistant",
  kind: "assistant",
  name: "Assistant",
  icon: "smart_toy",
  headline: "App · placeholder, not connected",
  isApp: true,
  role: "app",
  scopes: ["messages:read", "messages:write", "contacts:read"],
  grantedBy: OWNER_ACCOUNT.id,
  contactId: "assistant",
  chatId: "assistant",
  about:
    "The site's assistant, an app with its own account. Today it is a placeholder: no AI is connected, its replies are canned and stay in your browser. Later it gets only the permissions it is granted, fewer than a person's.",
};

/**
 * Devices: accounts that post to a space (Truck 4 and Air sensor 7 in Devices). Their ids ARE
 * their map node ids (`/maps/?node=<id>`). Not in Contacts (PLAN.md: devices live in Devices and
 * Maps; Google Contacts lists people, not machines).
 */
export const TRUCK_ACCOUNT: Account = {
  id: "truck-4",
  kind: "device",
  name: "Truck 4",
  icon: "local_shipping",
  headline: "Device",
  isApp: false,
  role: "device",
  scopes: ["spaces:post"],
  grantedBy: OWNER_ACCOUNT.id,
};

export const SENSOR_ACCOUNT: Account = {
  id: "sensor-7",
  kind: "device",
  name: "Air sensor 7",
  icon: "sensors",
  headline: "Device",
  isApp: false,
  role: "device",
  scopes: ["spaces:post"],
  grantedBy: OWNER_ACCOUNT.id,
};

export const ACCOUNTS: Account[] = [
  GUEST_ACCOUNT,
  OWNER_ACCOUNT,
  ASSISTANT_ACCOUNT,
  TRUCK_ACCOUNT,
  SENSOR_ACCOUNT,
];

export const findAccount = (id: string) => ACCOUNTS.find((a) => a.id === id);

/** An account as Messages shows it (`@seanperez/chat`'s `ChatPerson`). */
export const toChatPerson = (account: Account): ChatPerson => ({
  id: account.id,
  name: account.name,
  ...(account.icon ? { icon: account.icon } : {}),
  ...(account.presence ? { presence: account.presence } : {}),
});

/** How the contact page words a scope (placeholder permissions, read-only). */
export const SCOPE_WORDS: Record<AccountScope, string> = {
  "messages:read": "Read its own conversations",
  "messages:write": "Reply in its own conversations",
  "contacts:read": "See your contacts",
  "contacts:write": "Edit contacts",
  "spaces:post": "Post in spaces it is a member of",
  "profile:write": "Edit the profile",
};
