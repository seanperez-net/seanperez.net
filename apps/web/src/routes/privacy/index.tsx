import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout } from "@seanperez/ui";

/**
 * What the site keeps about a visitor who writes (plan step 9; accounts plan A.2 "Tracked").
 * Plain text on purpose. Not in `pages.ts` (no card, no OG image). Keep it true: change it when
 * what is stored changes (migrations 0003, 0004; `account/account.server.ts`).
 */
export default component$(() => (
  <Layout.Pane role="primary">
    <Layout.PaneHeader title="Privacy" />
    {/* The pane's ONE body element (layout.md). */}
    <div class="grid max-w-3xl content-start gap-4 text-body-large text-on-surface">
      <p>
        Browsing this site stores nothing about you on its server. What you
        change here (your name in Profile, contacts, messages to others) stays
        in your own browser.
      </p>
      <h2 class="text-title-large">When you message Sean</h2>
      <p>
        Contact me and Sean's thread in Messages keep, on the site's server:
        your name, your email address, your messages, and when they were sent.
        Your first message also makes a small account for that address, so the
        same browser can write again without the form. It gives no other access.
        No IP address, device details or location are kept.
      </p>
      <p>
        We email you once with a link and a code to confirm the address is
        yours. Until you confirm, your messages are marked unverified, and if
        you never confirm, the account and those messages are deleted after 7
        days. A verified account is kept until you delete it (below).
      </p>
      <h2 class="text-title-large">Who else handles it</h2>
      <p>
        Cloudflare hosts the site and runs Turnstile, the check that stops
        automated messages. Resend sends the confirmation email and keeps its
        own delivery log for 30 days. Your address is used only to confirm it
        and to reply to you: no newsletter, no tracking in the emails.
      </p>
      <h2 class="text-title-large">Deleting it</h2>
      <p>
        You can delete your account yourself, from a browser where you
        confirmed your address (the link or the code): open{" "}
        <a href="/profile/" class="text-primary underline underline-offset-4">
          Profile
        </a>{" "}
        and choose “Delete my account”. That deletes the account, every
        message sent from it, Sean's replies to them and its sign-in on every
        browser, at once. A browser that has not confirmed the address cannot
        delete it, so no one who only typed your address can.
      </p>
      <p>
        Signing out (in Contact me) only removes the sign-in from that browser.
        From another browser, send a message asking for your account to be
        deleted, and it will be.
      </p>
    </div>
  </Layout.Pane>
));

export const head: DocumentHead = {
  title: "Privacy · Sean Perez",
  meta: [
    {
      name: "description",
      content:
        "What seanperez.net keeps when you send a message, and for how long.",
    },
  ],
};
