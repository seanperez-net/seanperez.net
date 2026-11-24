import { $, component$, useSignal, useTask$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  AccountMenu,
  IconButton,
  Knobs,
  Layout,
  knob,
  useKnobs,
} from "../../index";
import type {
  AccountMenuUser,
  AccountPresencePref,
  AvatarPresence,
} from "../../index";

/** A made-up person: this playground has no auth library, so the session is a signal here. */
const DEMO_USER: AccountMenuUser = {
  id: "demo-user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

/** What others would see for each of the person's own choices (the host's job, mimicked). */
const SEEN_AS: Record<AccountPresencePref, AvatarPresence> = {
  auto: "online",
  busy: "busy",
  away: "away",
  invisible: "offline",
};

export default component$(() => {
  const knobs = useKnobs({
    signedIn: knob.boolean(true, "Signed in"),
    signInControl: knob.select(
      ["button", "default link", "none"] as const,
      "button",
      "Signed-out control",
    ),
    presence: knob.select(
      ["none", "online", "away", "busy", "offline"] as const,
      "online",
    ),
    statusRows: knob.boolean(true, "Status rows"),
    themeRows: knob.boolean(false, "Theme rows"),
    manageAccount: knob.boolean(true, "Manage account row"),
    align: knob.select(["start", "end"] as const, "end"),
  });

  // The "session": what a host would read from its auth library. The knob and the menu both
  // write it; the menu only ever reads it through the `user` prop.
  const user = useSignal<AccountMenuUser | null>(DEMO_USER);
  const pref = useSignal<AccountPresencePref>("auto");
  useTask$(({ track }) => {
    user.value = track(() => knobs.values.signedIn) ? DEMO_USER : null;
  });

  // What a host does on Sign out: end the session, then clear its user. The menu switches to
  // the signed-out control with no reload.
  const signOut$ = $(() => {
    user.value = null;
    knobs.values.signedIn = false;
  });

  return (
    <>
      <Layout.PaneHeader title="Account menu" />
      <Knobs knobs={knobs}>
        <div class="flex items-center gap-4">
          <AccountMenu
            user={user.value}
            align={knobs.values.align}
            presence={
              knobs.values.presence === "none"
                ? undefined
                : knobs.values.presence
            }
            statusText="Demo session, no auth"
            presencePref={pref.value}
            onPresenceChange$={
              knobs.values.statusRows
                ? $((value: AccountPresencePref) => {
                    pref.value = value;
                    knobs.values.presence = SEEN_AS[value];
                  })
                : undefined
            }
            themeRows={knobs.values.themeRows}
            manageAccountHref={knobs.values.manageAccount ? "#" : undefined}
            items={[{ label: "Settings", href: "#", icon: "palette" }]}
            onSignOut$={signOut$}
            signInHref="#"
            signIn={
              knobs.values.signInControl === "none" ? null : knobs.values
                  .signInControl === "button" ? (
                // A button, not a link: it signs the demo person back in, in the page.
                <IconButton
                  icon="login"
                  label="Sign in"
                  data-demo-sign-in=""
                  onClick$={() => {
                    user.value = DEMO_USER;
                    knobs.values.signedIn = true;
                  }}
                />
              ) : undefined
            }
          />
          <span class="text-body-medium text-on-surface-variant">
            {user.value ? `Signed in as ${user.value.name}` : "Signed out"}
          </span>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Account menu: @seanperez/ui" };
