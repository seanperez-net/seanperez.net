import {
  $,
  component$,
  isBrowser,
  useOnDocument,
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
import { saveMessage } from "../messages/messages.server";
import { PROFILE_MAX } from "../profile/limits";
import {
  saveProfileChanges,
  useProfileOverride,
} from "../profile/use-profile";
import { SocialLinks } from "./social-links";

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
 * Rate limiting: Turnstile plus the honeypot to start with. If spam gets through, add a
 * Cloudflare WAF rate-limiting rule on POSTs whose query has `qaction` in the dashboard (no code); noted in
 * PLAN.md.
 */

/**
 * The Contact companion's id (`routes/layout.tsx` `CONTACT_PANEL`); `/contacts/` opens it with
 * `openCompanion`. SEAM for a chat (owner 2026-11-24, later): a "Chat" companion can sit beside
 * this one, and the contact row can open it instead.
 */
export const CONTACT_COMPANION_ID = "contact";

/** Echoed back by Siteverify for a real token; checked below. */
const TURNSTILE_ACTION = "contact";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
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

/** One line, no control characters: the name is shown as one line in the admin inbox. */
const oneLine = /^[^\p{Cc}]*$/u;

// Re-exported from routes/layout.tsx (see the file comment).
// eslint-disable-next-line qwik/loader-location
export const useSendMessage = routeAction$(
  async (data, { platform, request, fail }) => {
    // DEMO: with the layer off the panel is gone, but the action is still exported from the root
    // layout and reachable with `?qaction=`: refuse it, so the only visitor write is closed too.
    if (!DEMO) return fail(404, { message: "Not found." });
    // Honeypot: people never see this field (`hidden`); a bot that fills it is told "sent"
    // and nothing is sent, so it learns nothing.
    if (data[HONEYPOT]) return { sent: true };

    const env = platform.env;
    if (!env.TURNSTILE_SECRET_KEY) {
      return fail(503, { message: "The contact form is not open yet." });
    }

    // Turnstile Siteverify (developers.cloudflare.com/turnstile/get-started/server-side-
    // validation/): POST the secret, the token and the visitor's IP; fail closed.
    const token = data["cf-turnstile-response"] ?? "";
    if (!token) {
      return fail(400, {
        message: "Please complete the security check, then send again.",
      });
    }
    let outcome: {
      success?: boolean;
      hostname?: string;
      action?: string;
      "error-codes"?: string[];
    };
    try {
      const res = await fetch(SITEVERIFY, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: request.headers.get("CF-Connecting-IP") ?? "",
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`siteverify ${res.status}`);
      outcome = await res.json();
    } catch (error) {
      console.error("contact: siteverify failed", error);
      return fail(502, {
        message: "The security check could not be confirmed. Please try again.",
      });
    }
    const hostnames = (env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    // A real token carries the widget's action. Cloudflare's TEST secret answers
    // `hostname: "example.com"` and no action (Turnstile "Testing"); that is accepted only
    // where `TURNSTILE_HOSTNAMES` lists example.com, which is `.dev.vars` alone.
    const actionOk =
      outcome.action === TURNSTILE_ACTION ||
      (outcome.action === undefined && outcome.hostname === "example.com");
    if (
      !outcome.success ||
      !outcome.hostname ||
      !hostnames.includes(outcome.hostname) ||
      !actionOk
    ) {
      console.warn("contact: turnstile refused", outcome["error-codes"]);
      return fail(403, {
        message: "The security check failed. Please try again.",
      });
    }

    // Stored, not sent: the owner reads it at /admin/messages/. A database error (such as the
    // table not created yet, when the code is deployed before migration 0003) is logged and the
    // visitor is told to try later.
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
    return { sent: true };
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
  // Sending needs the internet (Turnstile and the Worker), unlike the rest of the site, which
  // works offline (`routes/service-worker.ts`). `navigator.onLine === false` is certain;
  // `true` is not proof of a connection, so a failed send still shows the action's own error.
  const offline = useSignal(false);
  // A submit waiting for the security check's token (`loadOn="interaction"` below): Send shows
  // its spinner from the click, before the action itself runs (`send.isRunning`).
  const checking = useSignal(false);
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
  // The name typed in a send, saved once the send succeeded.
  const sentName = useSignal("");
  const readOnline = $(() => {
    offline.value = !navigator.onLine;
  });
  const wake = $(() => {
    offline.value = !navigator.onLine;
    const saved = readPref(DRAFT_KEY, parseDraft);
    if (saved) Object.assign(draft, saved);
    // No name in the draft: the profile's, when the visitor set one.
    if (!draft.name && profile.fields?.name) draft.name = profile.fields.name;
  });
  // Server-rendered panel: read on resume (`qinit`); rendered in the browser (the usual case:
  // the pane opens it): read right away, before the first paint.
  useOnDocument("qinit", wake);
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
    confirmed.value = result;
    showSnackbar$({ message: "Message sent" });
    // Focus was on Send (now busy, then idle); a new message starts at Name.
    requestAnimationFrame(() =>
      root.value
        ?.querySelector<HTMLInputElement>('input[name="name"]:not(:disabled)')
        ?.focus(),
    );
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
            Send a message. Your email address is only used to reply.
          </p>
          <Form
            action={send}
            class="grid grid-cols-1 gap-4"
            // Turnstile loads on the first use of the form, so a quick Send can come before its
            // token: the router awaits this before it reads and posts the form, so the token the
            // widget writes meanwhile is sent. No token after 10 s (or a widget error): it is
            // posted anyway and the action answers "Please complete the security check".
            onSubmit$={async (_, form: HTMLFormElement) => {
              sentName.value = String(new FormData(form).get("name") ?? "");
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
              action="contact"
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
              <p role="status" class="text-body-medium text-on-surface-variant">
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
        </>
      )}
      <SocialLinks />
    </div>
  );
});
