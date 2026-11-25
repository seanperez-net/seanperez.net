# AccountMenu

The app bar's account control, from e-store's `components/account-menu/` (ported in full
2026-11-23). Signed out it is a sign-in control (or nothing); signed in it is the person's avatar,
opening a menu with who is signed in, their account rows, status and theme rows, the host's rows
and Sign out.

- **M3 top app bar**: https://m3.material.io/components/top-app-bar/specs (trailing avatar 32dp)
- **M3 menu**: https://m3.material.io/components/menus
- **WAI-ARIA menu button**: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/

Built from `Menu`, `Avatar`, `Icon` and `iconButtonVariants`. **Pure UI: the host owns the
session.** It passes `user`, and ends the session either with `signOutHref` (a link to a server
route; works without JavaScript) or with `onSignOut$`.

## Signing out clears the account state (the host's job)

The component holds no session. With `onSignOut$`, the host ends the session there AND sets its
own `user` to `null`; the component then shows the signed-out control at once, with no reload
(the two states are different elements, keyed apart, so nothing of the menu survives). Focus,
which was on the menu, moves to the signed-out control (and back to the avatar after an in-page
sign in), so it is never lost to the page.

```tsx
const user = useSignal<AccountMenuUser | null>(session.value.user);
<AccountMenu
  user={user.value}
  onSignOut$={async () => {
    await signOut(); // the auth library's call
    user.value = null; // clear the account state
  }}
/>;
```

The playground's `/account-menu/` mimics this with a signal and a made-up person (there is no
auth library here): Sign out sets the user to `null`; its `signIn` override is a BUTTON that signs
the demo person back in.

## API

| Prop                  | Type                                        | Default                               | What                                                                      |
| --------------------- | ------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `user`                | `{ id?, name?, email?, image? } \| null`    |                                       | Unset or `null`: signed out                                               |
| `signIn`              | `JSXOutput \| null`                         | the sign-in link                      | The signed-out control. `null`: render nothing. JSX: that, as it is       |
| `signInHref`          | `string`                                    | `/sign-in/`                           | The default control's link                                                |
| `signInLabel`         | `string`                                    | `Sign in`                             | Its name and title                                                        |
| `signInIcon`          | `IconName`                                  | `login`                               | Its icon                                                                  |
| `manageAccountHref`   | `string`                                    |                                       | No row without it                                                         |
| `manageAccountLabel`  | `string`                                    | `Manage your account`                 |                                                                           |
| `manageAccountIcon`   | `IconName`                                  | `manage_accounts`                     |                                                                           |
| `items`               | `{ label, href?, icon?, id? }[]`            |                                       | Rows after the account rows                                               |
| `onSignOut$`          | `QRL<() => void \| Promise<void>>`          |                                       | Sign out in the page: end the session and clear `user`                    |
| `signOutHref`         | `string`                                    |                                       | Sign out as a link. Neither: no Sign out row                              |
| `signOutLabel`        | `string`                                    | `Sign out`                            |                                                                           |
| `signOutIcon`         | `IconName`                                  | `logout`                              |                                                                           |
| `presence`            | `"online" \| "away" \| "busy" \| "offline"` |                                       | Ring + glyph on both avatars, the word in the trigger's name              |
| `presenceLabels`      | `Partial<Record<AvatarPresence, string>>`   | English                               |                                                                           |
| `statusText`          | `string`                                    |                                       | Status line in the header, after the presence word                        |
| `presencePref`        | `"auto" \| "busy" \| "away" \| "invisible"` |                                       | The checked status row                                                    |
| `presenceAction`      | `string`                                    |                                       | Status rows POST `presence=<value>` here, without JavaScript              |
| `onPresenceChange$`   | `QRL<(value, duration?) => void>`           |                                       | Status chosen in the page (with the duration id for a row with `durations`). Rows only with this or `presenceAction` |
| `presenceDuration`    | `string`                                    |                                       | The current choice's duration id: the checked row of its submenu          |
| `presenceUntilText`   | `string`                                    |                                       | The current choice's end in the host's words ("Until 3:40 PM"): the submenu row's second line |
| `presenceOptions`     | `{ value, label, glyph, durations?, durationsLabel? }[]` | Automatic, Busy (with `DEFAULT_PRESENCE_DURATIONS`), Away, Appear offline |                                                                           |
| `presenceGroupLabel`  | `string`                                    | `Status`                              |                                                                           |
| `themeRows`           | `boolean`                                   | `false`                               | Device default / Light / Dark, bound to the theme context (`Layout.Root`) |
| `themeOptions`        | `{ value, label, icon }[]`                  | the three                             |                                                                           |
| `themeGroupLabel`     | `string`                                    | `Theme`                               |                                                                           |
| `accountLabel`        | `string`                                    | `Account`                             | Prefix of the trigger's name                                              |
| `size` / `headerSize` | `AvatarSize`                                | `appbar` / `lg`                       | Trigger and header avatars                                                |
| `align`               | `"start" \| "end"`                          | `end`                                 | Menu alignment                                                            |
| `class`, `data-*`     |                                             |                                       | On the signed-in `Menu.Root`, or the default sign-in link                 |

Order: header, Manage your account, status rows, theme rows, separator, `items`, slotted
`Menu.Item`s, separator, "Theme colors" (`themeColors`, ours), separator, Sign out. Each group
after the header starts with its own separator.

## ARIA

- Signed out: a link named by `signInLabel` (icon decorative), or the host's control.
- Signed in: `Menu.Trigger` named "Account: Ada Lovelace (ada@example.com), Online". Both avatars
  are `decorative`. The header is `role="none"` (its text is in the trigger's name; a screen
  reader inside the menu may not read it). Status and theme rows are `menuitemradio`s in named
  groups. Keyboard model: `menu.md`.

## Where it differs from e-store

- `signInIcon` defaults to `login` (owner, 2026-11-23; e-store `account_circle`).
- `signIn={null}` renders nothing (e-store's `if (signIn)` cannot): for a site without sign-in.
  One prop, not a boolean such as `showSignIn`, which could contradict `signIn`.
- Focus moves onto the new control after an in-page sign out or sign in (e-store loses it to the
  page). A `useTask$` polls with timers for up to 5s for the new branch; it never takes focus from
  something the person focused meanwhile.
- The default sign-in control is an `<a>` with `iconButtonVariants()`, not e-store's
  `IconButton type="link"`; icon names are `IconName`.
- The whole control sits in a `display: contents` span (`data-qds-account-menu-slot`), the one
  element that stays through a session change.

Proof (2026-11-23): menu-button keyboard and focus against the APG and the HTML spec (second
agent); run in Chrome on `/account-menu/`: open by mouse and keyboard, Escape, Tab, ArrowUp to
Sign out, sign out and back in by keyboard (focus followed), status and theme rows, the `none`
sign-in control, light and dark. Not checked with a screen reader.

## `themeLook="segmented"` (NEW, not in e-store; owner 2026-11-24)

`themeRows themeLook="segmented"`: a separator, a small "Theme" label (`themeGroupLabel`,
label-medium on-surface-variant) and our `ToggleGroup` (M3 segmented button, its default size: 40dp, the same props as `ThemeChanger`'s) with one
icon-only segment per `themeOptions` entry (Device default / Light / Dark), each named by its
label (`aria-label`) with the global plain tooltip (`data-tooltip`). Bound to the theme context's
color mode, the same signal as `Layout.Root themeToggle`'s switch. The default `rows` is
e-store's three radio rows.

Keys (run in Chrome 2026-11-24): the segmented row is ONE stop in the menu's Up / Down / Home /
End (`data-qds-menu-row` + `menuRowKeys`, and `navigateMenuItems` counts the row, at its pressed
segment); Left / Right move between segments (`rovingKeys`); Enter / Space choose (the menu stays
open); Tab closes the menu and moves on, as from a row. Escape first dismisses a segment's
tooltip when one shows (WCAG 1.4.13), then closes the menu. The menu opens on its first ROW
("Theme colors..."), not the segments (APG: focus the first item); Up reaches them.

OPEN (ARIA): a `role="group"` of `<button aria-pressed>` inside `role="menu"` is not one of the
menu's allowed owned roles (menuitem\*, group of menuitems, separator). Screen readers may announce
it oddly; not checked in a screen reader. The ARIA-clean alternative is e-store's `rows`.

## `themeColors` (NEW, not in e-store; owner 2026-11-24)

A "Theme colors" row (`themeColorsLabel`, `aria-haspopup="dialog"`, `aria-controls`), in its
own group AFTER the host's `items` and slotted rows, before Sign out (moved 2026-11-24, owner:
Profile and Contacts above it; it sat before `items` until then. e-store has no such row, so its
order of account rows, `items` and Sign out is unchanged). Choosing it closes the menu (focus back on the trigger) and opens Theme Controls, a
SEPARATE `popover="auto"` `role="dialog"` anchored under the trigger (placed as `Menu.Content`:
4px below, end edges lined up, `position-try` flips, last `--qds-menu-scroll-below-end`; the
menu's surface, 4dp, level 2; `min(360px, 100vw - 1rem)` wide, scrolling within the window).
Its contents follow the Material Web catalog's theme menu (material-web.dev, and
`catalog/src/components/theme-changer.ts`, read 2026-11-24): the headline "Theme Controls"
(`themeColorsTitle`) with a copy `IconButton` on its row (copies the generated palette CSS, else
the built-in source color; the icon turns to a check for 2s), then `ThemeChanger reset={false}
mode={false}`. Focus moves to the copy button on open; Escape or a click outside closes it and
focus returns to the avatar (run in Chrome 2026-11-24 at 1512px, 500px and in a 360px iframe).
Rendered lazily (2026-11-24, perf audit; NEW, not in e-store): the closed panel's `popover`
element and its heading row (title and copy button) are server-rendered on every page, but
`ThemeChanger` mounts on the FIRST open (the panel's `toggle` to `open`) and then stays, so its
sliders and their state are not in every page's HTML. The copy button is the focus target, so
focus on open is unchanged; the sliders appear a moment after the first open. The panel has no
enter / exit transition of its own (light dismiss of `popover="auto"` cannot be deferred, rule
L26).
Differs from the catalog: opened from a menu row, not an app-bar button; no light / dark here
(the site has it in the rail and the drawer footer, one place only); "Source color" for
"Hex Source Color".

## Usage on the site

`apps/web` has no sign-in. It LOOKS signed in (owner, 2026-11-23): `user` is the name only (`id`
seeds the avatar's tone). Presence (2026-11-24) is the VISITOR's own: `presence`, `presencePref`,
`onPresenceChange$`, `presenceDuration`, `presenceUntilText` and `statusText` ("Until 3:40 PM"
for a Busy that ends) from
`apps/web/src/presence/use-presence.tsx`, saved in their browser, never sent. NO email (owner 2026-11-24, spam). The menu:
header, then `items` Profile (`/profile/`, `person`) and Contacts (`/contacts/`, `contacts`), as
e-store's `CFOS_ACCOUNT_LINKS` (`packages/os/src/cfos/app-shell.tsx`: Profile `/profile/` `person`),
then "Theme colors" (`themeColors`). No `themeRows` (light / dark is in the rail and the drawer
footer), no Sign out. Not `manageAccountHref`: "Manage your account" means editing, and visitors
cannot edit (the owner edits at `/admin/profile`).

## Busy durations (NEW, not in e-store; owner 2026-11-24: "yes add the busy durations")

e-store's AccountMenu has no durations (its status rows are four `menuitemradio`s; checked
2026-11-24: no duration, until or expiry anywhere in its `account-menu/`). New here, with the
owner's approval.

- A status option with `durations` (default: Busy, `DEFAULT_PRESENCE_DURATIONS`: "For 1 hour" `1h`,
  "For 4 hours" `4h`, "Until end of day" `today`, "Until I change it" `forever`) is a `Menu.Sub`:
  the row opens a submenu, a `Menu.RadioGroup` named "Busy for" (`durationsLabel`) of
  `menuitemradio`s; choosing one calls `onPresenceChange$("busy", id)` and closes the whole menu.
- The library has NO clock: ids and labels only. The host turns the id into an end time
  (`apps/web/src/presence/presence.ts` `presenceUntil`: `today` = the next LOCAL midnight,
  `d.setHours(24, 0, 0, 0)`, DST-safe) and words it (`presenceUntilText`, `statusText`).
- State: a `menuitem` with `aria-haspopup` cannot be `aria-checked` (ARIA), so while Busy is the
  current choice no row of the Status group is checked; the Busy row gets the checked FILL
  (`Menu.SubTrigger checked`, `data-checked`) and the host's "Until 3:40 PM" as a second line,
  which is part of its name ("Busy, Until 3:40 PM"; a visually hidden comma). The submenu's
  radio for `presenceDuration` is checked. The header line says it too ("Busy · Until 3:40 PM").
- Choices kept few (Slack, Teams and Google Chat offer a short list of hours, the end of the day
  and "until changed"; Google Chat's help shows "select a duration from the list", read
  2026-11-24). Away and Appear offline stay "until changed".
- Without JavaScript (`presenceAction` only) a submenu cannot open: such a row stays a plain
  submit row (`presence=busy`) and the server picks the length (`today` needs the visitor's time
  zone, which the server does not have). No host uses `presenceAction` today.
- Narrow windows: at 390px the submenu flips to the start side of the menu (`menu.md`
  "Submenus"); run in Chrome 2026-11-24. M3 suggests a bottom sheet for menus on compact
  windows: not done.
- Playground: `/account-menu/`, knob "Busy durations" (off: a plain Busy row). Run in Chrome
  2026-11-24: click and hover open it, Enter / Down / Right open it on "For 1 hour", Enter
  chooses and closes all with focus back on the avatar, light and dark.
- Second agent (RULE 2, 2026-11-24, given the problem, not this design): the same shape (Busy
  as `Menu.Sub` with a "Busy for" radio group, the four choices, state in the trigger's text
  and the checked fill, ids only in the library, `today` at local midnight, the no-JS fallback).
