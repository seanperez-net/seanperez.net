import {
  $,
  component$,
  isBrowser,
  useOnDocument,
  useId,
  useOnWindow,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import {
  Button,
  TextField,
  Turnstile,
  useSnackbar,
  waitForTurnstileToken,
} from "@seanperez/ui";
import { DEMO } from "../demo/demo";
import { readPref, writePref } from "../local-store";
import { OWNER_ACCOUNT } from "../content/accounts";
import { MAX_BODY } from "../messages/messages-local";
import { storeMessage } from "../messages/messages-store";
import { saveMessage } from "@seanperez/data/messages/messages.server";
import {
  normalizeEmail,
  sendAsSession,
  signOut,
  startContact,
} from "@seanperez/data/account/account.server";
import {
  accountsOpen,
  checkTurnstile,
  floor,
  notifyOwnerLater,
  sendVerificationLater,
  sessionOf,
  setSessionCookie,
} from "@seanperez/data/account/contact.server";
import { TURNSTILE_ACTIONS } from "@seanperez/data/account/turnstile-actions";
import { TOO_MANY, WEIGHT, allow } from "@seanperez/data/limits/limit.server";
import { PROFILE_MAX } from "@seanperez/data/profile/limits";
import { saveProfileChanges, useProfileOverride } from "../profile/use-profile";
import { SocialLinks } from "./social-links";
import { useResendVerification, useVerifyCode } from "./contact-actions";
import { ME_CHANGED_EVENT, fetchMe, signOutMe, type Me } from "../account/me";

/**
 * The Contact panel (owner, 2026-11-24): a form instead of any published address (spam). It is
 * a companion in the supporting pane on every route (`routes/layout.tsx`), not a route of its
 * own. The message is stored in D1 (table `message`, `messages/messages.server.ts`) after
 * Cloudflare Turnstile and a honeypot, and read at /admin/messages/ behind Cloudflare Access
 * (owner, 2026-11-24: "that can just post to the db and then from the admin route i can see it").
 * It is the ONE thing on the site a visitor can write (the demo is otherwise read-only). It used
 * to be emailed (Workers `send_email`); an email notification could come back later.
 *
 * Where the action lives (Qwik 2.0.0-rc.5 docs, "Action" and "Re-exporting loaders"): a
 * `routeAction$` must be exported from a route boundary file (`layout.tsx` / `index.tsx`) or it
 * does not run. Declared here and RE-EXPORTED from `routes/layout.tsx`, the root layout, it
 * belongs to every route under it, so `<Form>` posts to whatever page the visitor is on
 * (`?qaction=...`) and no `/contact/` route is needed. `globalAction$` would also work, but the
 * docs recommend `routeAction$` first, and the root layout already covers every page.
 * `invalidate: []`: sending a message changes no loader, so the page's loaders (the feed, the
 * map) are not fetched again after a send.
 *
 * Server side, in order: the honeypot, the field limits (`zod$`), Turnstile Siteverify, then one
 * INSERT (bound parameters), refused once the day's cap is reached (`MESSAGES_PER_DAY`). Same-origin only: Qwik Router's `checkOrigin` (on by default, rc.5
 * `request-handler`) refuses a POST whose `Origin` is not the site's own.
 *
 * Rate limiting (2026-11-25): the Workers Rate Limiting binding first (`allow(env, "contact", ...)`,
 * `limits/limit.server.ts`), then the honeypot, Turnstile and the D1 caps. A WAF rule on
 * `?qaction=` POSTs cannot be written on the Free plan (path-only, IP-only: rate-limiting note).
 */

/**
 * The Contact companion's id (`routes/layout.tsx` `CONTACT_PANEL`); `/contacts/` opens it with
 * `openCompanion`. SEAM for a chat (owner 2026-11-24, later): a "Chat" companion can sit beside
 * this one, and the contact row can open it instead.
 */
export const CONTACT_COMPANION_ID = "contact";

/**
 * The honeypot's name. Not `website` (forms audit 2026-11-24, owner): browsers and password
 * managers guess a field's purpose from its name, and "website" reads as a URL field (the `url`
 * autofill token), so one of them could fill it and a real message would be dropped. `hpot` is
 * no autofill token (MDN `autocomplete` token list, read 2026-11-24) and no word a fill heuristic
 * looks for.
 */
const HONEYPOT = "hpot";

/** Limits, shared by the inputs (`maxLength`) and the server schema. */
const MAX = { name: 100, email: 254, message: 5000 } as const;

/**
 * Whether the form can work here: a site key to draw the widget, and the secret to verify it. Until the owner sets them in production the page says so instead of
 * showing a form that cannot send. Only the PUBLIC site key leaves the server.
 */
// Re-exported from routes/layout.tsx (see the file comment).
// eslint-disable-next-line qwik/loader-location
export const useContactSetup = routeLoader$(
  ({ platform }) => {
    // DEMO: with the layer off there is no Contact me companion; nothing draws the widget.
    if (!DEMO) return { siteKey: "", open: false };
    const env = platform.env;
    const siteKey = env.TURNSTILE_SITE_KEY ?? "";
    return {
      siteKey,
      open: !!siteKey && !!env.TURNSTILE_SECRET_KEY,
    };
  },
  // In the page's HTML (two small public values), not fetched as JSON when the panel opens: a
  // page the service worker serves offline then still has it (offline, 2026-11-24; rule Q7).
  { serializationStrategy: "always" },
);

/**
 * The unsent message, kept in THIS browser (`local-store.ts`) so it survives the panel closing,
 * another companion opening, a route change and a reload (forms audit, 2026-11-24). Removed once
 * the message is sent. Only the three fields: never the honeypot or the Turnstile token.
 *
 * Why storage and no context: the panel unmounts whenever the pane closes or switches companion,
 * so an in-memory draft would need a context in the root layout; storage already outlives the
 * panel AND the page, so a context would only duplicate it (second agent's review agreed).
 */
const DRAFT_KEY = "contact.draft";
type ContactDraft = { name: string; email: string; message: string };
const DRAFT_FIELDS = ["name", "email", "message"] as const;

/** Stored data is untrusted (`readPref`): three strings within the limits, or nothing. */
const parseDraft = (raw: unknown): ContactDraft | null => {
  if (!raw || typeof raw !== "object") return null;
  const draft = raw as Record<string, unknown>;
  const ok = DRAFT_FIELDS.every(
    (k) =>
      typeof draft[k] === "string" && (draft[k] as string).length <= MAX[k],
  );
  return ok ? (raw as ContactDraft) : null;
};

/** Tells an open Contact me panel that its draft changed (`draftContactMessage`). */
const CONTACT_DRAFT_EVENT = "spn:contact-draft";

/**
 * Puts `text` in Contact me's Message field (after anything already drafted; Name and Email kept)
 * and tells an open panel to read it and focus Name. Used by Sean's thread (2026-11-25): a message
 * to him is sent through Contact me until the visitor has an account. Browser only.
 */
export function draftContactMessage(text: string) {
  const saved = readPref(DRAFT_KEY, parseDraft) ?? {
    name: "",
    email: "",
    message: "",
  };
  const message = (saved.message ? `${saved.message}\n\n${text}` : text).slice(
    0,
    MAX.message,
  );
  writePref(DRAFT_KEY, { ...saved, message });
  document.dispatchEvent(new CustomEvent(CONTACT_DRAFT_EVENT));
}

/** One line, no control characters: the name is shown as one line in the admin inbox. */
const oneLine = /^[^\p{Cc}]*$/u;

// Re-exported from routes/layout.tsx (see the file comment).
// eslint-disable-next-line qwik/loader-location
export const useSendMessage = routeAction$(
  async (data, { platform, request, cookie, url, fail }) => {
    // DEMO: with the layer off the panel is gone, but the action is still exported from the root
    // layout and reachable with `?qaction=`: refuse it, so the only visitor write is closed too.
    if (!DEMO) return fail(404, { message: "Not found." });
    const env = platform.env;
    // Rate limit FIRST (2026-11-25, `limits/limit.server.ts`): one route-wide key (the visitor
    // is anonymous; no IP keys), before Siteverify and any D1 write. The D1 caps stay the hard
    // limit; this cuts a burst off before it spends them.
    if (!(await allow(env, "contact", WEIGHT.contact)))
      return fail(429, { message: TOO_MANY });
    // Honeypot: people never see this field (`hidden`); a bot that fills it is told "sent"
    // and nothing is sent, so it learns nothing.
    if (data[HONEYPOT]) return { sent: true, needsCode: false };

    // Turnstile Siteverify, fail closed (`checkTurnstile`, shared with Sean's thread).
    const check = await checkTurnstile(
      env,
      data["cf-turnstile-response"],
      request.headers.get("CF-Connecting-IP") ?? "",
      TURNSTILE_ACTIONS.contact,
    );
    if (!check.ok) return fail(check.status, { message: check.message });

    const started = Date.now();
    // Before accounts are set up here (no AUTH_SECRET, or no RESEND_API_KEY in production): as
    // before them, stored, read at /admin/messages/, nothing said about an account (plan 6).
    if (!accountsOpen(env)) {
      try {
        const saved = await saveMessage(env.DB, {
          name: data.name,
          email: data.email,
          body: data.message,
        });
        if (saved === "full") {
          return fail(429, {
            message: "Too many messages today. Please try again tomorrow.",
          });
        }
      } catch (error) {
        console.error("contact: save failed", error);
        return fail(500, {
          message: "Your message could not be sent. Please try again later.",
        });
      }
      return { sent: true, needsCode: false };
    }

    // Accounts (owner, 2026-11-25; plan 1.1 to 1.3). A database error (migration 0004 not
    // applied yet) is logged and the visitor is told to try later.
    try {
      const session = await sessionOf(env, cookie, url);
      // The address this browser is already signed in with: a later message.
      if (session && normalizeEmail(data.email) === session.email) {
        const result = await sendAsSession(env.DB, session, data.message);
        if (result.kind === "full") {
          return fail(429, {
            message: "Too many messages today. Please try again tomorrow.",
          });
        }
        if (result.kind === "capped") {
          return fail(429, {
            message: result.verified
              ? "You've sent 10 messages today. Please try again tomorrow."
              : "Confirm your email first: enter the code from the email below.",
          });
        }
        if (result.confirmed) {
          notifyOwnerLater(
            env,
            platform.ctx,
            url.origin,
            session.accountId,
            result.messageId,
          );
        }
        return { sent: true, needsCode: !session.verified };
      }
      // A first message from this address in this browser: an unverified account (or the
      // existing one), the message waiting, a new session, one email. The SAME answer whether the
      // address is new, known, verified or capped (enumeration, plan 5.3), after the floor.
      const result = await startContact(env.DB, env.AUTH_SECRET, {
        name: data.name,
        email: data.email,
        body: data.message,
      });
      if (result.kind === "full") {
        await floor(started);
        return fail(429, {
          message: "Too many messages today. Please try again tomorrow.",
        });
      }
      // Another account's session in this browser gives way to this one.
      if (session) await signOut(env.DB, session.tokenHash);
      setSessionCookie(cookie, url, result.sessionToken, false);
      // The email goes out AFTER the response (owner, 2026-11-25): new, known and capped
      // addresses all answer after the same D1 work and the floor. A failed send shows in
      // /admin, not here.
      if (result.token) {
        void sendVerificationLater(
          env,
          platform.ctx,
          url.origin,
          normalizeEmail(data.email),
          result.token,
        );
      }
      await floor(started);
      return { sent: true, needsCode: true };
    } catch (error) {
      console.error("contact: save failed", error);
      return fail(500, {
        message: "Your message could not be sent. Please try again later.",
      });
    }
  },
  {
    invalidate: [],
    validation: [
      zod$({
        name: z
          .string()
          .trim()
          .min(1, "Enter your name.")
          .max(MAX.name, `At most ${MAX.name} characters.`)
          .regex(oneLine, "Use one line."),
        email: z
          .string()
          .trim()
          .min(1, "Enter your email address.")
          .max(MAX.email, `At most ${MAX.email} characters.`)
          .email("Enter an email address like name@example.com."),
        message: z
          .string()
          .trim()
          .min(1, "Enter a message.")
          .max(MAX.message, `At most ${MAX.message} characters.`),
        // The honeypot and the token the widget adds (Turnstile tokens are at most 2048 chars).
        [HONEYPOT]: z.string().max(200).optional(),
        "cf-turnstile-response": z.string().max(2048).optional(),
      }),
    ],
  },
);

/**
 * The panel's body. The supporting pane gives it its header ("Contact me", the companion's label),
 * so it has none of its own.
 *
 * Under the form (owner, 2026-11-24: "add the social stuff at the bottom of the message me under
 * the Send button", then "just the icons ... get it from the user profile"): one row of icon
 * links from the owner's D1 profile (`social-links.tsx`), shown whatever the form's state (not
 * open, offline). NO email (no-email rule): the links are `https:` only.
 *
 * After a send (owner, 2026-11-24: "the message should open up a snackbar"): the snackbar says
 * "Message sent" (M3 snackbar: brief feedback on a finished process, no action, leaves by
 * itself) and the form is emptied for a new message, focus on Name. The inline "Thanks" text is
 * kept ONLY for a send without JavaScript (the server renders the result; no snackbar can show).
 * Errors stay inline (M3: a snackbar is not for an error the visitor must fix).
 */
export const ContactPanel = component$(() => {
  const setup = useContactSetup();
  const send = useSendMessage();
  const verify = useVerifyCode();
  const resend = useResendVerification();
  // This browser's contact account (`/api/me`, plan 1.5): null until read, or with no session.
  // An unverified one shows the code field and "Send the email again" above the form.
  const me = useSignal<Me | null>(null);
  // Sending needs the internet (Turnstile and the Worker), unlike the rest of the site, which
  // works offline (`routes/service-worker.ts`). `navigator.onLine === false` is certain;
  // `true` is not proof of a connection, so a failed send still shows the action's own error.
  const offline = useSignal(false);
  // A submit waiting for the security check's token (`loadOn="interaction"` below): Send shows
  // its spinner from the click, before the action itself runs (`send.isRunning`).
  const checking = useSignal(false);
  // The last code the Code field submitted by itself (six digits in), so each value goes once.
  const autoCode = useSignal("");
  // The same for "Send the email again" (its own security check, below).
  const checkingResend = useSignal(false);
  // "Send the email again" sits beside Confirm but submits its OWN form (the `form` attribute),
  // which holds its Turnstile widget: a form inside the code form is not allowed.
  const resendFormId = useId();
  // What the fields show. On the server (a no-JS POST) the text that was sent; in the browser the
  // saved draft replaces it on mount (it is saved on every keystroke, so it is never older).
  const root = useSignal<HTMLElement>();
  const draft = useStore<ContactDraft>(() => ({
    name: send.formData?.get("name")?.toString() ?? "",
    email: send.formData?.get("email")?.toString() ?? "",
    message: send.formData?.get("message")?.toString() ?? "",
  }));
  // ONE NAME (owner, 2026-11-25: "if there is a name it should auto fill the name in the form and
  // vice versa if they fill the contact me name it should fill the name in the profile name"):
  // the guest's profile name (`profile.local` through the seam, `ProfileOverrideContext`) is the
  // single source. Only a name the visitor SET counts (never the "You" placeholder); the email is
  // never stored or prefilled.
  const profile = useProfileOverride();
  /** Saves a name typed here as the profile's name; empty or unchanged writes nothing. */
  const saveName = $(async (raw: string) => {
    const name = raw.trim().slice(0, PROFILE_MAX.name);
    if (!name || !oneLine.test(name) || name === profile.fields?.name) return;
    await saveProfileChanges(profile, { name });
  });
  // The form itself (owner, 2026-11-25: "why doesnt the form disapear when send"): closed after a
  // send and while a code is awaited, so the panel shows what comes next; "Write another
  // message" opens it again.
  const formOpen = useSignal(true);
  // The name typed in a send, saved once the send succeeded.
  const sentName = useSignal("");
  // The message sent, for Sean's thread (below).
  const sentText = useSignal("");
  const readOnline = $(() => {
    offline.value = !navigator.onLine;
  });
  const readMe = $(async () => {
    me.value = await fetchMe();
  });
  const wake = $(() => {
    offline.value = !navigator.onLine;
    // Back with a code still awaited: the code step, not a blank form.
    void readMe().then(() => {
      if (me.value && !me.value.verified) formOpen.value = false;
    });
    const saved = readPref(DRAFT_KEY, parseDraft);
    if (saved) Object.assign(draft, saved);
    // No name in the draft: the profile's, when the visitor set one.
    if (!draft.name && profile.fields?.name) draft.name = profile.fields.name;
  });
  // Server-rendered panel: read on resume (`qinit`); rendered in the browser (the usual case:
  // the pane opens it): read right away, before the first paint.
  useOnDocument("qinit", wake);
  // Another view of this tab verified or signed out.
  useOnDocument(ME_CHANGED_EVENT, readMe);
  // Sean's thread moved a message here while the panel was open: read it, focus Name.
  useOnDocument(
    CONTACT_DRAFT_EVENT,
    $(async () => {
      await wake();
      requestAnimationFrame(() =>
        root.value
          ?.querySelector<HTMLInputElement>('input[name="name"]:not(:disabled)')
          ?.focus(),
      );
    }),
  );
  useTask$(() => {
    if (isBrowser) return wake();
  });
  useOnWindow(["online", "offline"], readOnline);
  // The profile's name changed elsewhere (Profile edit, another tab, read on resume): the field
  // follows, unless the visitor is typing in it.
  useTask$(({ track }) => {
    const name = track(() => profile.fields?.name);
    if (!isBrowser || !name || name === draft.name) return;
    // The visitor is typing in Name: never overwrite it.
    const active = document.activeElement as HTMLInputElement | null;
    if (active?.name === "name" && root.value?.contains(active)) return;
    draft.name = name;
  });
  // Opened by the visitor (owner, 2026-11-24: "when the Contacts open the name field should gain
  // focus"): the panel mounts in the browser when its companion is chosen, so focus goes to Name.
  // Not when it was server-rendered (a page load: focus stays at the top of the page), and not
  // when a tab of the compact sheet holds focus (arrowing through the tabs must stay there).
  // `useSignal(isBrowser)`: false when serialized from the server, true when created here.
  const openedHere = useSignal(isBrowser);
  // Focus needs the rendered element: no `useTask$` / `useOn` equivalent.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (!openedHere.value) return;
    if (document.activeElement?.getAttribute("role") === "tab") return;
    root.value
      ?.querySelector<HTMLInputElement>('input[name="name"]:not(:disabled)')
      ?.focus();
  });
  const { showSnackbar$ } = useSnackbar();
  // The send result this browser has already confirmed with the snackbar (so the form, not the
  // no-JS "Thanks" text, shows). Tracks the result object: a second send is a new object.
  const confirmed = useSignal<unknown>(null);
  // Sent: the draft is done with, the snackbar confirms it, the form is ready for a new message.
  useTask$(({ track }) => {
    const result = track(() => send.value);
    if (!isBrowser || !result?.sent) return;
    // The name sent becomes the profile's (one name); the new message starts with it.
    const name = sentName.value;
    sentName.value = "";
    void saveName(name);
    Object.assign(draft, {
      name: name.trim() || profile.fields?.name || "",
      email: "",
      message: "",
    });
    writePref(DRAFT_KEY, null);
    // The same message in Sean's thread in Messages, "Sent" (one conversation with him).
    const text = sentText.value.trim();
    sentText.value = "";
    if (text)
      void storeMessage(OWNER_ACCOUNT.chatId!, {
        id: `contact-${Date.now()}`,
        body: text.slice(0, MAX_BODY),
        createdAt: new Date().toISOString(),
        mine: true,
        status: "sent",
      });
    confirmed.value = result;
    formOpen.value = false;
    // A first message: the account waits for the link or code; the code field is next.
    if (result.needsCode) {
      me.value = { name: name.trim() || me.value?.name || "", verified: false };
      // This panel (`readMe` listens) and Sean's thread, which needs the security check for an
      // unverified session's send (`use-demo-thread.ts`), read the new session.
      document.dispatchEvent(new CustomEvent(ME_CHANGED_EVENT));
    }
    showSnackbar$({
      message: result.needsCode
        ? "Message sent. Check your email to confirm it."
        : "Message sent",
    });
    // Focus was on Send (gone with the form): to the code, else to "Write another message".
    // The code step renders a frame or two later (found in Chrome): try for up to 10 frames.
    const target = result.needsCode
      ? 'input[name="code"]'
      : "[data-write-another]";
    let tries = 10;
    const focusNext = () => {
      const el = root.value?.querySelector<HTMLElement>(target);
      if (el) el.focus();
      else if (--tries > 0) requestAnimationFrame(focusNext);
    };
    requestAnimationFrame(focusNext);
  });
  // Confirmed with the code: the account is verified in this browser.
  useTask$(({ track }) => {
    const result = track(() => verify.value);
    if (!isBrowser || !result || result.failed) return;
    me.value = me.value ? { ...me.value, verified: true } : null;
    document.dispatchEvent(new CustomEvent(ME_CHANGED_EVENT));
    showSnackbar$({ message: "Email confirmed" });
  });

  return (
    <div ref={root} class="grid grid-cols-1 content-start gap-4">
      {send.value?.sent && confirmed.value !== send.value ? (
        <p role="status" class="text-body-large text-on-surface">
          Thanks, I'll get back to you.
        </p>
      ) : !setup.value.open ? (
        <p class="text-body-large text-on-surface-variant">
          The contact form is not open yet.
        </p>
      ) : (
        <>
          <p class="text-body-medium text-on-surface-variant">
            Send a message. Your email address is only used to confirm it's you
            and to reply.{" "}
            <a
              href="/privacy/"
              class="text-primary underline underline-offset-4"
            >
              Privacy
            </a>
          </p>
          {/* The account waiting for its link or code (plan 1.1 step 5). No email address is
            shown, not even the visitor's own (no-email rule). */}
          {me.value && !me.value.verified && (
            <div class="grid grid-cols-1 gap-3">
              <p role="status" class="text-body-medium text-on-surface">
                To confirm it's you, enter the 6-digit code from the email we
                sent, or open its link. It works for 30 minutes.
              </p>
              <Form
                action={verify}
                class="grid grid-cols-1 gap-3"
                // Six digits in = submit (2026-11-25): typing, a paste and iOS / macOS AutoFill
                // of the emailed code all fire `input` (it bubbles to the form). Once per value,
                // so a wrong code is not posted again by itself (Confirm still can), and not
                // while a check is running. `requestSubmit` goes through the router's submit,
                // like pressing Confirm.
                onInput$={(event: Event, form: HTMLFormElement) => {
                  const field = event.target as HTMLInputElement;
                  if (field.name !== "code") return;
                  const code = field.value.trim();
                  if (!/^\d{6}$/.test(code) || code === autoCode.value) return;
                  if (verify.isRunning) return;
                  autoCode.value = code;
                  form.requestSubmit();
                }}
              >
                <TextField
                  name="code"
                  label="Code"
                  inputMode="numeric"
                  autocomplete="one-time-code"
                  spellcheck={false}
                  required
                  maxLength={6}
                  error={
                    verify.value?.fieldErrors?.code ??
                    (verify.value?.failed ? verify.value.message : undefined)
                  }
                />
                <div class="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    label="Confirm"
                    isLoading={verify.isRunning}
                  />
                  <Button
                    type="submit"
                    form={resendFormId}
                    look="text"
                    label="Send the email again"
                    isLoading={checkingResend.value || resend.isRunning}
                  />
                </div>
              </Form>
              {/* "Send the email again" passes its own security check (security review,
                2026-11-25; action `resend`, checked by `useResendVerification`): without it, anyone
                who typed an address could send its owner the day's 3 emails from a script. The
                same widget settings as Contact me's below; it loads on the first submit of this
                form (`loadOn="interaction"`), so it costs nothing until then, and the submit waits
                for its token. */}
              <Form
                action={resend}
                id={resendFormId}
                onSubmit$={async (_, form: HTMLFormElement) => {
                  checkingResend.value = true;
                  try {
                    await waitForTurnstileToken(form);
                  } finally {
                    checkingResend.value = false;
                  }
                }}
              >
                <Turnstile
                  siteKey={setup.value.siteKey}
                  action={TURNSTILE_ACTIONS.resend}
                  size="compact"
                  appearance="interaction-only"
                  loadOn="interaction"
                  pending={resend.isRunning}
                />
              </Form>
              {resend.value?.failed && resend.value.message && (
                <p role="alert" class="text-body-medium text-error">
                  {resend.value.message}
                </p>
              )}
              {resend.value?.resent && (
                <p
                  role="status"
                  class="text-body-medium text-on-surface-variant"
                >
                  A new email is on its way. Use the newest code.
                </p>
              )}
            </div>
          )}
          {!formOpen.value && (
            <div class="grid grid-cols-1 justify-items-start gap-2">
              {!(me.value && !me.value.verified) && (
                <p role="status" class="text-body-large text-on-surface">
                  Your message was sent.
                </p>
              )}
              <Button
                look="text"
                leadingIcon="edit"
                label="Write another message"
                data-write-another=""
                onClick$={() => {
                  formOpen.value = true;
                  requestAnimationFrame(() =>
                    root.value
                      ?.querySelector<HTMLInputElement>(
                        'input[name="name"]:not(:disabled)',
                      )
                      ?.focus(),
                  );
                }}
              />
            </div>
          )}
          {formOpen.value && (
            <Form
              action={send}
              class="grid grid-cols-1 gap-4"
              // Turnstile loads on the first use of the form, so a quick Send can come before its
              // token: the router awaits this before it reads and posts the form, so the token the
              // widget writes meanwhile is sent. No token after 10 s (or a widget error): it is
              // posted anyway and the action answers "Please complete the security check".
              onSubmit$={async (_, form: HTMLFormElement) => {
                const data = new FormData(form);
                sentName.value = String(data.get("name") ?? "");
                sentText.value = String(data.get("message") ?? "");
                checking.value = true;
                try {
                  await waitForTurnstileToken(form);
                } finally {
                  checking.value = false;
                }
              }}
              // The Name field committed (blur, Enter): it becomes the profile's name. Not per
              // keystroke; `change` bubbles.
              onChange$={(event: Event) => {
                const field = event.target as HTMLInputElement;
                if (field.name === "name") void saveName(field.value);
              }}
              // `input` bubbles: one listener saves whichever field changed.
              onInput$={(event: Event) => {
                const field = event.target as HTMLInputElement;
                const name = DRAFT_FIELDS.find((k) => k === field.name);
                if (!name) return;
                draft[name] = field.value;
                writePref(
                  DRAFT_KEY,
                  draft.name || draft.email || draft.message
                    ? { ...draft }
                    : null,
                );
              }}
            >
              <TextField
                name="name"
                label="Name"
                // The compact sheet opens on it (`data-autofocus`, Layout.SupportingPane).
                data-autofocus=""
                autocomplete="name"
                autocapitalize="words"
                spellcheck={false}
                required
                maxLength={MAX.name}
                value={draft.name}
                error={send.value?.fieldErrors?.name}
              />
              <TextField
                name="email"
                type="email"
                label="Email"
                autocomplete="email"
                required
                maxLength={MAX.email}
                value={draft.email}
                error={send.value?.fieldErrors?.email}
              />
              <TextField
                name="message"
                type="textarea"
                rows={6}
                label="Message"
                required
                maxLength={MAX.message}
                value={draft.message}
                error={send.value?.fieldErrors?.message}
              />
              {/* Honeypot: `hidden`, so it is not shown, not focusable and not read out, but it
              is still posted. `aria-hidden`, `tabIndex` and `autocomplete` are belt and braces
              for a reader or a filler that ignores `hidden`. */}
              <div hidden aria-hidden="true">
                <label>
                  Leave this empty
                  <input
                    name={HONEYPOT}
                    type="text"
                    tabIndex={-1}
                    autocomplete="off"
                  />
                </label>
              </div>
              <Turnstile
                siteKey={setup.value.siteKey}
                action={TURNSTILE_ACTIONS.contact}
                // `compact` (150 x 140): `normal` and `flexible` need at least 300px, wider than
                // the side pane's 264px of content (Turnstile widget-configurations, "Widget size").
                size="compact"
                // Shown only when Cloudflare needs the visitor to click (most never see it). Also
                // hides the dev test key's "for testing only" badge.
                appearance="interaction-only"
                // Not on view (perf audit 2026-11-24): this panel is open by default on every
                // route, so api.js (about 87 KB) and its iframe loaded for every visitor. Now on
                // the first focus, press, typing or submit in this form.
                loadOn="interaction"
                pending={send.isRunning}
              />
              {offline.value && (
                <p
                  role="status"
                  class="text-body-medium text-on-surface-variant"
                >
                  You're offline, so the message can't be sent now. Send it when
                  you're back online.
                </p>
              )}
              {send.value?.failed && send.value.message && (
                <p role="alert" class="text-body-medium text-error">
                  {send.value.message}
                </p>
              )}
              <div>
                <Button
                  type="submit"
                  label="Send"
                  leadingIcon="mail"
                  isLoading={checking.value || send.isRunning}
                  disabled={offline.value}
                />
              </div>
            </Form>
          )}
        </>
      )}
      {/* Signed in (a session from Contact me): who, and the way out (a shared computer). */}
      {me.value && (
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-body-medium text-on-surface-variant">
            {/* An unverified session gets no name from `/api/me` (it may be someone else's
              account): the name this visitor set in their profile, else "you". */}
            {`Sending as ${me.value.name || profile.fields?.name || "you"}${me.value.verified ? "." : " (unverified)."}`}
          </p>
          <Button
            look="text"
            label="Sign out"
            onClick$={async () => {
              await signOutMe();
              me.value = null;
              formOpen.value = true;
            }}
          />
        </div>
      )}
      <SocialLinks />
    </div>
  );
});
