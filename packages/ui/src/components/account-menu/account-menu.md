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
| `onPresenceChange$`   | `QRL<(value) => void>`                      |                                       | Status chosen in the page. Rows only with this or `presenceAction`        |
| `presenceOptions`     | `{ value, label, glyph }[]`                 | Automatic, Busy, Away, Appear offline |                                                                           |
| `presenceGroupLabel`  | `string`                                    | `Status`                              |                                                                           |
| `themeRows`           | `boolean`                                   | `false`                               | Device default / Light / Dark, bound to the theme context (`Layout.Root`) |
| `themeOptions`        | `{ value, label, icon }[]`                  | the three                             |                                                                           |
| `themeGroupLabel`     | `string`                                    | `Theme`                               |                                                                           |
| `accountLabel`        | `string`                                    | `Account`                             | Prefix of the trigger's name                                              |
| `size` / `headerSize` | `AvatarSize`                                | `appbar` / `lg`                       | Trigger and header avatars                                                |
| `align`               | `"start" \| "end"`                          | `end`                                 | Menu alignment                                                            |
| `class`, `data-*`     |                                             |                                       | On the signed-in `Menu.Root`, or the default sign-in link                 |

Order: header, Manage your account, status rows, theme rows, separator, `items`, slotted
`Menu.Item`s, separator, Sign out.

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

## Usage on the site

`apps/web` has no sign-in: it passes the owner as `user` with `accountLabel="About"` and his
links as `items`, and no Sign out. (Showing nothing, `signIn={null}` without a `user`, would also
work; the avatar with links was the owner's earlier choice.)
