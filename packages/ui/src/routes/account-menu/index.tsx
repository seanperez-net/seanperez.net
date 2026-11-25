import { $, component$, useSignal, useTask$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  AccountMenu,
  DEFAULT_PRESENCE_OPTIONS,
  IconButton,
  Layout,
} from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";
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

/** What a host would show for each duration id (made-up times: no clock here). */
const UNTIL: Record<string, string> = {
  "1h": "Until 3:40 PM",
  "4h": "Until 6:40 PM",
  today: "Until end of day",
  forever: "Until you change it",
};

const AVATAR_SIZES = [
  "xs",
  "search",
  "appbar",
  "md",
  "post",
  "lg",
  "xl",
  "profile",
  "2xl",
] as const;

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
    // Busy as a submenu of durations (2026-11-24); off: a plain Busy row.
    busyDurations: knob.boolean(true, "Busy durations"),
    themeRows: knob.boolean(false, "Theme rows"),
    manageAccount: knob.boolean(true, "Manage account row"),
    align: knob.select(["start", "end"] as const, "end"),
    // The trigger's avatar and the header's.
    size: knob.select(AVATAR_SIZES, "appbar"),
    headerSize: knob.select(AVATAR_SIZES, "lg"),
  });

  // The "session": what a host would read from its auth library. The knob and the menu both
  // write it; the menu only ever reads it through the `user` prop.
  const user = useSignal<AccountMenuUser | null>(DEMO_USER);
  const pref = useSignal<AccountPresencePref>("auto");
  // The host's part of a duration: the id it was given and the end it words (a real host
  // computes the time; this one only names it).
  const duration = useSignal<string | undefined>(undefined);
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
            size={knobs.values.size}
            headerSize={knobs.values.headerSize}
            presence={
              knobs.values.presence === "none"
                ? undefined
                : knobs.values.presence
            }
            statusText={
              pref.value === "busy" && duration.value
                ? UNTIL[duration.value]
                : "Demo session, no auth"
            }
            presencePref={pref.value}
            presenceDuration={pref.value === "busy" ? duration.value : undefined}
            presenceUntilText={
              pref.value === "busy" && duration.value
                ? UNTIL[duration.value]
                : undefined
            }
            presenceOptions={
              knobs.values.busyDurations
                ? DEFAULT_PRESENCE_OPTIONS
                : DEFAULT_PRESENCE_OPTIONS.map((o) => ({ ...o, durations: undefined }))
            }
            onPresenceChange$={
              knobs.values.statusRows
                ? $((value: AccountPresencePref, id?: string) => {
                    pref.value = value;
                    duration.value = id;
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
