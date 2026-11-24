import {
  $,
  Slot,
  component$,
  isServer,
  untrack,
  useContext,
  useId,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { ClassList, JSXOutput, QRL } from "@qwik.dev/core";
import { themeContextId } from "../../theme/theme-context";
import type { ColorMode } from "../../theme/theme-storage";
import { freshJsx } from "../../utils/jsx-prop";
import { AVATAR_PRESENCE_LABELS, Avatar, AvatarPresenceGlyph } from "../avatar";
import type { AvatarPresence, AvatarSize } from "../avatar";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { iconButtonVariants } from "../icon-button";
import { Menu } from "../menu";

/**
 * The app bar's account control (M3 top app bar trailing avatar, 32dp). From e-store's
 * `components/account-menu/account-menu.tsx` (2026-11-23).
 *
 * - Signed out (no `user`): `signIn`, by default a 40dp icon-button link to the sign-in page
 *   with the `login` icon (the same slot the signed-in avatar takes, so the bar keeps its width).
 *   `signIn={null}` renders nothing.
 * - Signed in: the person's `Avatar` opens a `Menu` (native popover, top layer) with a header
 *   (a larger avatar, the name and the email), "Manage your account" (with
 *   `manageAccountHref`), optional status and theme rows, the host's `items`, slotted
 *   `Menu.Item`s, and Sign out.
 *
 * Pure UI: the host owns the session. It passes `user`, and either `signOutHref` (a real link,
 * no JavaScript) or `onSignOut$`, where it ends the session AND clears its `user`; the control
 * then switches to the signed-out one with no reload, and focus moves onto it.
 *
 * Changed from e-store: `signInIcon` defaults to `login` (owner, 2026-11-23; e-store
 * `account_circle`); `signIn={null}` renders nothing (e-store's `if (signIn)` fell through to
 * the default); after an in-page sign out focus moves to the signed-out control instead of being
 * lost with the removed trigger; icon names are `IconName`.
 */

export interface AccountMenuUser {
  /** Seeds the avatar's tone, so it survives a rename. */
  id?: string;
  name?: string;
  email?: string;
  image?: string | null;
}

/** One menu row, as data (serialisable). */
export interface AccountMenuItem {
  label: string;
  href?: string;
  icon?: IconName;
  /** Stable key; defaults to the label. */
  id?: string;
}

/**
 * The person's own presence CHOICE. What others see is `AvatarPresence`: `auto` follows
 * activity, `invisible` shows as offline.
 */
export type AccountPresencePref = "auto" | "busy" | "away" | "invisible";

/** One status row, as data. */
export interface AccountPresenceOption {
  value: AccountPresencePref;
  label: string;
  /** The glyph drawn in the row. */
  glyph: AvatarPresence;
}

export const DEFAULT_PRESENCE_OPTIONS: AccountPresenceOption[] = [
  { value: "auto", label: "Automatic", glyph: "online" },
  { value: "busy", label: "Busy", glyph: "busy" },
  { value: "away", label: "Away", glyph: "away" },
  { value: "invisible", label: "Appear offline", glyph: "offline" },
];

/** One theme row, as data. */
export interface AccountThemeOption {
  value: ColorMode;
  label: string;
  icon: IconName;
}

export const DEFAULT_THEME_OPTIONS: AccountThemeOption[] = [
  { value: "auto", label: "Device default", icon: "brightness_auto" },
  { value: "light", label: "Light", icon: "light_mode" },
  { value: "dark", label: "Dark", icon: "dark_mode" },
];

export type AccountMenuProps = {
  /** Who is signed in. Unset or `null`: the signed-out control. */
  user?: AccountMenuUser | null;
  signInHref?: string;
  signInLabel?: string;
  /** The default sign-in button's icon. */
  signInIcon?: IconName;
  /**
   * The signed-out control. Unset: a 40dp icon-button link built from `signInHref`,
   * `signInLabel` and `signInIcon`. `null`: nothing (a site without sign-in). Any JSX: that,
   * as it is (`class` and `data-*` given here go only on the default).
   */
  signIn?: JSXOutput | null;
  /** The person's own account settings. Without it there is no row. */
  manageAccountHref?: string;
  manageAccountLabel?: string;
  manageAccountIcon?: IconName;
  /** Extra rows (host data), between the account rows and Sign out. */
  items?: AccountMenuItem[];
  /**
   * Runs on Sign out, in the page. The host ends the session here AND sets its `user` to
   * `null`; the menu then shows the signed-out control. Without it (and without `signOutHref`)
   * there is no Sign out row.
   */
  onSignOut$?: QRL<() => void | Promise<void>>;
  /** Sign out as a link (a server route that ends the session). */
  signOutHref?: string;
  signOutLabel?: string;
  signOutIcon?: IconName;
  /** Prefix of the trigger's name: "Account: Ada Lovelace (ada@example.com)". */
  accountLabel?: string;
  /** The trigger avatar's size. Default `appbar` (32dp). */
  size?: AvatarSize;
  /** The header avatar's size. Default `lg` (56dp). */
  headerSize?: AvatarSize;
  /** What others see of the person: ring and glyph on both avatars, the word in the name. */
  presence?: AvatarPresence | null;
  presenceLabels?: Partial<Record<AvatarPresence, string>>;
  /** The person's own status line, under the email. */
  statusText?: string;
  /** The person's current choice: the checked status row. */
  presencePref?: AccountPresencePref;
  /** A same-origin URL the status rows POST `presence=<value>` to, without JavaScript. */
  presenceAction?: string;
  /** Runs with the chosen status. The rows render only with this or `presenceAction`. */
  onPresenceChange$?: QRL<(value: AccountPresencePref) => void>;
  presenceOptions?: AccountPresenceOption[];
  presenceGroupLabel?: string;
  /**
   * Device default / Light / Dark rows, bound to the enclosing theme context (`Layout.Root` or
   * `ThemeRoot` provides it), which applies and saves the pick. No rows without one.
   */
  themeRows?: boolean;
  themeOptions?: AccountThemeOption[];
  themeGroupLabel?: string;
  /** Menu alignment against the trigger; the app bar's trailing edge wants `end`. */
  align?: "start" | "end";
  class?: ClassList;
  [key: `data-${string}`]: string | undefined;
};

/** The first thing that takes focus inside `root`. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const AccountMenu = component$<AccountMenuProps>(
  ({
    user,
    signInHref = "/sign-in/",
    signInLabel = "Sign in",
    signInIcon = "login",
    signIn,
    manageAccountHref,
    manageAccountLabel = "Manage your account",
    manageAccountIcon = "manage_accounts",
    items,
    onSignOut$,
    signOutHref,
    signOutLabel = "Sign out",
    signOutIcon = "logout",
    accountLabel = "Account",
    size = "appbar",
    headerSize = "lg",
    align = "end",
    presence,
    presenceLabels,
    statusText,
    presencePref,
    presenceAction,
    onPresenceChange$,
    presenceOptions = DEFAULT_PRESENCE_OPTIONS,
    presenceGroupLabel = "Status",
    themeRows = false,
    themeOptions = DEFAULT_THEME_OPTIONS,
    themeGroupLabel = "Theme",
    class: className,
    ...rest
  }) => {
    // The one element that stays through a sign in or out: focus is put back inside it.
    const slotId = useId();

    // The checked status row follows the host's value, and a click marks it at once.
    const pref = useSignal<string>(presencePref ?? "");
    useTask$(({ track }) => {
      pref.value = track(() => presencePref) ?? "";
    });
    // The scaffold's colour mode; the checked theme row follows it, a pick writes it.
    const theme = useContext(themeContextId, null);
    // Untracked: reading the mode in render would re-render the whole menu on every change.
    const mode = useSignal<string>(
      untrack(() => theme?.colorMode.value ?? "auto"),
    );
    useTask$(({ track }) => {
      if (theme) mode.value = track(() => theme.colorMode.value);
    });
    const pickTheme$ = $((value: string) => {
      if (theme && (value === "auto" || value === "light" || value === "dark"))
        theme.colorMode.value = value;
    });

    // An in-page sign out (or sign in) removes the control that had focus: the trigger (which
    // the closing menu had focused, or a row of its menu), or the host's sign-in button. Focus
    // then moves onto the control that replaces it (WCAG 2.4.3), never onto it from elsewhere:
    // only when focus was inside this control, or already lost to the page, as the session
    // changed. Client only; with
    // `signIn={null}` there is nothing to focus and the host decides.
    useTask$(({ track }) => {
      const signedIn = track(() => !!user);
      if (isServer) return;
      // Focus was in this control, or already lost (the host's sign-in button can be gone by
      // the time this runs). Anywhere else, it stays where the person put it.
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        !document.getElementById(slotId)?.contains(active)
      )
        return;
      // Wait for the other branch to be in the DOM: the first time, its code is fetched
      // (Qwik loads it lazily), which can take a while. Polled with timers, not animation
      // frames, which a background tab does not run. Give up after 5s, or as soon as the person
      // has put focus somewhere else.
      const deadline = Date.now() + 5000;
      const focusNew = (): unknown =>
        setTimeout(() => {
          const slot = document.getElementById(slotId);
          const now = document.activeElement;
          if (!slot || Date.now() > deadline) return;
          if (now && now !== document.body && !slot.contains(now)) return;
          const rendered =
            !!slot.querySelector("[data-qds-account-menu-trigger]") ===
            signedIn;
          if (!rendered) return focusNew();
          slot
            .querySelector<HTMLElement>(
              signedIn ? "[data-qds-account-menu-trigger]" : FOCUSABLE,
            )
            ?.focus();
        }, 16);
      focusNew();
    });

    // Signed in and signed out are different elements, keyed apart, so a client re-render that
    // changes the session replaces the node rather than patching one into the other.
    if (!user) {
      return (
        <span id={slotId} class="contents" data-qds-account-menu-slot="">
          {signIn === null ? null : signIn !== undefined ? (
            <span key="account-signed-out" class="contents">
              {freshJsx(signIn)}
            </span>
          ) : (
            <a
              key="account-signed-out"
              {...rest}
              href={signInHref}
              aria-label={signInLabel}
              title={signInLabel}
              class={[iconButtonVariants(), className]}
              data-qds-account-menu-sign-in=""
            >
              <Icon name={signInIcon} />
            </a>
          )}
        </span>
      );
    }

    const name = user.name?.trim() || undefined;
    const email = user.email?.trim() || undefined;
    const who = name && email ? `${name} (${email})` : (name ?? email ?? "");
    const seed = user.id ?? email ?? name;
    const presenceWord = presence
      ? (presenceLabels?.[presence] ?? AVATAR_PRESENCE_LABELS[presence])
      : undefined;
    const named = [who, presenceWord].filter(Boolean).join(", ");
    const hasStatusRows = !!presenceAction || !!onPresenceChange$;
    const statusRows = presenceOptions.map((option) => (
      <Menu.RadioItem
        key={option.value}
        value={option.value}
        name={presenceAction ? "presence" : undefined}
        data-qds-account-menu-presence={option.value}
      >
        <AvatarPresenceGlyph presence={option.glyph} size="md" class="me-1" />
        {option.label}
      </Menu.RadioItem>
    ));
    const hasSignOut = !!onSignOut$ || !!signOutHref;
    const hasItems = (items?.length ?? 0) > 0;

    return (
      <span id={slotId} class="contents" data-qds-account-menu-slot="">
        <Menu.Root
          key="account-signed-in"
          {...rest}
          class={className}
          data-qds-account-menu=""
        >
          <Menu.Trigger
            look="bare"
            aria-label={named ? `${accountLabel}: ${named}` : accountLabel}
            data-qds-account-menu-trigger=""
          >
            <Avatar
              src={user.image}
              name={name ?? email}
              seed={seed}
              size={size}
              presence={presence}
              decorative
            />
          </Menu.Trigger>
          <Menu.Content align={align}>
            <div
              role="none"
              class="flex min-w-0 items-center gap-3 px-3 py-2"
              data-qds-account-menu-header=""
            >
              <Avatar
                src={user.image}
                name={name ?? email}
                seed={seed}
                size={headerSize}
                presence={presence}
                decorative
              />
              <div class="flex min-w-0 flex-col">
                {name && (
                  <span class="truncate text-body-large text-on-surface">
                    {name}
                  </span>
                )}
                {email && (
                  <span class="truncate text-body-medium text-on-surface-variant">
                    {email}
                  </span>
                )}
                {(presenceWord || statusText) && (
                  <span
                    class="truncate text-body-small text-on-surface-variant"
                    data-qds-account-menu-status=""
                  >
                    {[presenceWord, statusText].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </div>
            {manageAccountHref && (
              <Menu.Item
                href={manageAccountHref}
                data-qds-account-menu-manage=""
              >
                <Icon name={manageAccountIcon} size="sm" />
                {manageAccountLabel}
              </Menu.Item>
            )}
            {hasStatusRows && (
              <>
                <Menu.Separator />
                <Menu.RadioGroup
                  value={pref}
                  onValueChange$={
                    onPresenceChange$ as
                      | QRL<(value: string) => void>
                      | undefined
                  }
                  aria-label={presenceGroupLabel}
                  data-qds-account-menu-presence-group=""
                >
                  {presenceAction ? (
                    <form method="post" action={presenceAction}>
                      {statusRows}
                    </form>
                  ) : (
                    statusRows
                  )}
                </Menu.RadioGroup>
              </>
            )}
            {themeRows && theme && (
              <>
                <Menu.Separator />
                <Menu.RadioGroup
                  value={mode}
                  onValueChange$={pickTheme$}
                  aria-label={themeGroupLabel}
                  data-qds-account-menu-theme-group=""
                >
                  {themeOptions.map((option) => (
                    <Menu.RadioItem
                      key={option.value}
                      value={option.value}
                      data-qds-account-menu-theme={option.value}
                    >
                      <Icon name={option.icon} size="sm" />
                      {option.label}
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </>
            )}
            {(hasItems || hasSignOut) && <Menu.Separator />}
            {items?.map((item) => (
              <Menu.Item key={item.id ?? item.label} href={item.href}>
                {item.icon && <Icon name={item.icon} size="sm" />}
                {item.label}
              </Menu.Item>
            ))}
            <Slot />
            {hasSignOut && (
              <>
                {hasItems && <Menu.Separator />}
                <Menu.Item
                  href={signOutHref}
                  onClick$={onSignOut$}
                  data-qds-account-menu-sign-out=""
                >
                  <Icon name={signOutIcon} size="sm" />
                  {signOutLabel}
                </Menu.Item>
              </>
            )}
          </Menu.Content>
        </Menu.Root>
      </span>
    );
  },
);
