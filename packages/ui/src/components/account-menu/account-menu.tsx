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
import type { ClassList, JSXOutput, QRL, Signal } from "@qwik.dev/core";
import { themeContextId } from "../../theme/theme-context";
import type { ColorMode } from "../../theme/theme-storage";
import { freshJsx } from "../../utils/jsx-prop";
import { AVATAR_PRESENCE_LABELS, Avatar, AvatarPresenceGlyph } from "../avatar";
import type { AvatarPresence, AvatarSize } from "../avatar";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { iconButtonVariants } from "../icon-button";
import { Menu, menuContextId } from "../menu";
import { DEFAULT_MODE_OPTIONS, ThemeChanger } from "../theme-changer";
import { IconButton } from "../icon-button";
import {
  DEFAULT_SOURCE_COLOR,
  THEME_STYLE_ID,
} from "../../theme/theme-storage";
import { openPopover } from "../../utils/top-layer";
import { ToggleGroup } from "../toggle-group";
import { menuRowKeys } from "../../utils/menu-keys";

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

/**
 * How long a status lasts, as data (NEW 2026-11-24, owner: "yes add the busy durations"). Ids
 * and labels only: the HOST turns the id into an end time (the library has no clock).
 */
export interface AccountPresenceDurationOption {
  id: string;
  label: string;
}

/**
 * Busy's choices: few, as Slack / Teams / Google Chat offer (a short list of hours, the end of
 * the day, until changed). `today` = the next local midnight, for the host to compute.
 */
export const DEFAULT_PRESENCE_DURATIONS: AccountPresenceDurationOption[] = [
  { id: "1h", label: "For 1 hour" },
  { id: "4h", label: "For 4 hours" },
  { id: "today", label: "Until end of day" },
  { id: "forever", label: "Until I change it" },
];

/** One status row, as data. */
export interface AccountPresenceOption {
  value: AccountPresencePref;
  label: string;
  /** The glyph drawn in the row. */
  glyph: AvatarPresence;
  /**
   * How long it lasts (NEW 2026-11-24): the row becomes a submenu of these (`menuitemradio`s);
   * choosing one calls `onPresenceChange$(value, id)`. Without JavaScript (`presenceAction`
   * only) the row stays a plain submit row and the server picks the length.
   */
  durations?: AccountPresenceDurationOption[];
  /** The submenu's name. Default "<label> for". */
  durationsLabel?: string;
}

export const DEFAULT_PRESENCE_OPTIONS: AccountPresenceOption[] = [
  { value: "auto", label: "Automatic", glyph: "online" },
  {
    value: "busy",
    label: "Busy",
    glyph: "busy",
    durations: DEFAULT_PRESENCE_DURATIONS,
  },
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
  /**
   * Runs with the chosen status, and the chosen duration's id for a row with `durations`. The
   * rows render only with this or `presenceAction`.
   */
  onPresenceChange$?: QRL<
    (value: AccountPresencePref, duration?: string) => void
  >;
  /** The current choice's duration id: the checked row of its submenu. */
  presenceDuration?: string;
  /**
   * The current choice's end, as the host words it ("Until 3:40 PM", "Until you change it"):
   * the second line of a submenu row that holds the current choice (part of its name).
   */
  presenceUntilText?: string;
  presenceOptions?: AccountPresenceOption[];
  presenceGroupLabel?: string;
  /**
   * Device default / Light / Dark rows, bound to the enclosing theme context (`Layout.Root` or
   * `ThemeRoot` provides it), which applies and saves the pick. No rows without one.
   */
  themeRows?: boolean;
  /**
   * How `themeRows` draws: `rows` (default, e-store's: three radio rows) or `segmented` (NEW,
   * owner 2026-11-24: a small label and our `ToggleGroup`, M3's segmented button, icon-only
   * segments named by their labels, with tooltips). The segmented row is one stop for the menu's
   * Up / Down (`data-qds-menu-row`, `menuRowKeys`); Left / Right move between its segments.
   */
  themeLook?: "rows" | "segmented";
  themeOptions?: AccountThemeOption[];
  themeGroupLabel?: string;
  /**
   * A "Theme colors..." row (NEW, owner 2026-11-24) that closes the menu and opens a theme
   * dropdown anchored at the avatar: a `popover="auto"` dialog with a heading and `ThemeChanger`
   * (source color, hue / chroma / tone, mode), after the Material Web catalog's top app bar
   * theme menu (material-web.dev: an `md-menu` re-roled `dialog`, "Theme Controls"). Needs a
   * theme context, as `themeRows`.
   */
  themeColors?: boolean;
  /** The row's label. */
  themeColorsLabel?: string;
  /** The dropdown's heading and name. */
  themeColorsTitle?: string;
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
    presenceDuration,
    presenceUntilText,
    presenceOptions = DEFAULT_PRESENCE_OPTIONS,
    presenceGroupLabel = "Status",
    themeRows = false,
    themeLook = "rows",
    themeOptions: givenThemeOptions,
    themeGroupLabel = "Theme",
    themeColors = false,
    themeColorsLabel = "Theme colors",
    themeColorsTitle = "Theme Controls",
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
    // The checked duration row, the same way.
    const duration = useSignal<string>(presenceDuration ?? "");
    useTask$(({ track }) => {
      duration.value = track(() => presenceDuration) ?? "";
    });
    // The scaffold's color mode; the checked theme row follows it, a pick writes it.
    const theme = useContext(themeContextId, null);
    // The segmented row is the SAME ToggleGroup as `ThemeChanger`'s mode button (owner
    // 2026-11-24): its options (dark / auto / light) unless the host gives its own.
    const themeOptions =
      givenThemeOptions ??
      (themeLook === "segmented"
        ? DEFAULT_MODE_OPTIONS
        : DEFAULT_THEME_OPTIONS);
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

    const themeLabelId = useId();
    const themePanelId = useId();

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
    const statusRows = presenceOptions.map((option) =>
      // A row with durations is a submenu, on the JavaScript path only (a submenu needs it).
      option.durations?.length && !presenceAction ? (
        <PresenceDurationRow
          key={option.value}
          option={option}
          pref={pref}
          duration={duration}
          untilText={presenceUntilText}
          onPresenceChange$={onPresenceChange$}
        />
      ) : (
      <Menu.RadioItem
        key={option.value}
        value={option.value}
        name={presenceAction ? "presence" : undefined}
        data-qds-account-menu-presence={option.value}
      >
        <AvatarPresenceGlyph presence={option.glyph} size="md" class="me-1" />
        {option.label}
      </Menu.RadioItem>
      ),
    );
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
            {themeRows && theme && themeLook === "segmented" && (
              <>
                <Menu.Separator />
                <div
                  // As the header row: 12dp sides, 8dp block; the label over the group.
                  class="grid gap-2 px-3 py-2"
                  data-qds-account-menu-theme-group=""
                >
                  <span
                    id={themeLabelId}
                    class="text-label-medium text-on-surface-variant"
                  >
                    {themeGroupLabel}
                  </span>
                  <ToggleGroup.Root
                    bind:value={mode}
                    onValueChange$={pickTheme$}
                    aria-labelledby={themeLabelId}
                    fullWidth
                    checkmark
                    data-qds-menu-row=""
                    onKeyDown$={menuRowKeys}
                  >
                    {themeOptions.map((option) => (
                      <ToggleGroup.Item
                        key={option.value}
                        value={option.value}
                        icon={option.icon}
                        aria-label={option.label}
                        // The global plain tooltip (`TooltipProvider`), not `title`.
                        data-tooltip=""
                        data-qds-account-menu-theme={option.value}
                      />
                    ))}
                  </ToggleGroup.Root>
                </div>
              </>
            )}
            {themeRows && theme && themeLook === "rows" && (
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
            {hasItems && <Menu.Separator />}
            {items?.map((item) => (
              <Menu.Item key={item.id ?? item.label} href={item.href}>
                {item.icon && <Icon name={item.icon} size="sm" />}
                {item.label}
              </Menu.Item>
            ))}
            <Slot />
            {themeColors && theme && (
              <>
                {/* After the host's rows (owner 2026-11-24: Profile and Contacts above it),
                    in its own group. */}
                <Menu.Separator />
                <Menu.Item
                  aria-haspopup="dialog"
                  aria-controls={themePanelId}
                  // After the row's own handler has closed the menu (focus is back on the
                  // trigger, which the dropdown's Escape then returns to).
                  onClick$={() => {
                    const panel = document.getElementById(themePanelId);
                    if (panel) openPopover(panel);
                  }}
                  data-qds-account-menu-theme-colors=""
                >
                  <Icon name="palette" size="sm" />
                  {themeColorsLabel}
                </Menu.Item>
              </>
            )}
            {hasSignOut && (
              <>
                {/* Its own group, after everything else (e-store's). */}
                <Menu.Separator />
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
          {themeColors && theme && (
            <AccountThemePanel
              id={themePanelId}
              title={themeColorsTitle}
              align={align}
            />
          )}
        </Menu.Root>
      </span>
    );
  },
);

/**
 * A status row with durations (NEW 2026-11-24, owner: "yes add the busy durations"; e-store's
 * AccountMenu has none): `Menu.Sub`, its trigger the status (glyph, label and, while it is the
 * current choice, the host's "Until 3:40 PM" as a second line, so the state is in the row's
 * name: a `menuitem` with a submenu cannot be `aria-checked`), the checked fill
 * (`SubTrigger checked`); the submenu a radio group of the durations. Its own component so the
 * signals are read in its JSX only (rule Q12).
 */
const PresenceDurationRow = component$<{
  option: AccountPresenceOption;
  pref: Signal<string>;
  duration: Signal<string>;
  untilText?: string;
  onPresenceChange$?: QRL<
    (value: AccountPresencePref, duration?: string) => void
  >;
}>(({ option, pref, duration, untilText, onPresenceChange$ }) => {
  const value = option.value;
  const pick$ = $((id: string) => {
    pref.value = value;
    duration.value = id;
    return onPresenceChange$?.(value, id);
  });
  return (
    <Menu.Sub>
      <Menu.SubTrigger
        checked={pref.value === value}
        data-qds-account-menu-presence={value}
      >
        <AvatarPresenceGlyph presence={option.glyph} size="md" class="me-1" />
        <span class="flex min-w-0 flex-col">
          <span>{option.label}</span>
          {pref.value === value && untilText && (
            <span
              class="text-body-small text-on-surface-variant"
              data-qds-account-menu-presence-until=""
            >
              {/* A pause in the row's name: "Busy, Until 3:40 PM". */}
              <span class="sr-only">, </span>
              {untilText}
            </span>
          )}
        </span>
      </Menu.SubTrigger>
      <Menu.SubContent>
        <Menu.RadioGroup
          // The host passes `presenceDuration` only for the current choice, so only its
          // duration is checked.
          value={duration}
          onValueChange$={pick$}
          aria-label={option.durationsLabel ?? `${option.label} for`}
          data-qds-account-menu-durations={value}
        >
          {option.durations!.map((d) => (
            <Menu.RadioItem
              key={d.id}
              value={d.id}
              data-qds-account-menu-duration={d.id}
            >
              {d.label}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.SubContent>
    </Menu.Sub>
  );
});

/**
 * The theme dropdown (`AccountMenu themeColors`): a `popover="auto"` dialog anchored under the
 * account menu's trigger, placed as `Menu.Content` is (4px below, end edges lined up, flipping,
 * last scrolling below), with the menu's surface (surface-container, extra-small corners, level
 * 2). Focus moves to its first control on open; Escape or a click outside closes it (the
 * browser's light dismiss) and focus goes back to the trigger.
 */
const AccountThemePanel = component$<{
  id: string;
  title: string;
  align: "start" | "end";
  copyLabel?: string;
  copiedLabel?: string;
}>(
  ({
    id,
    title,
    align,
    copyLabel = "Copy current theme",
    copiedLabel = "Copied",
  }) => {
    const menu = useContext(menuContextId);
    const copied = useSignal(false);
    // The theme controls render on the FIRST open only, then stay (perf audit 2026-11-24): closed,
    // the panel is on every page, and `ThemeChanger` (three sliders and their state) was about
    // 16 KB of HTML plus its serialized state for a dialog most visitors never open. The heading
    // row stays server-rendered, so the copy button is there for focus the moment it opens.
    // Never reset on close: the sliders keep their state between opens. NEW, not in e-store.
    const mounted = useSignal(false);
    const titleId = `${id}-title`;
    const anchor = `--menu-${menu.triggerId}`;
    const end = align === "end";
    return (
      <div
        id={id}
        popover="auto"
        role="dialog"
        aria-labelledby={titleId}
        data-qds-account-theme-panel=""
        style={{
          positionAnchor: anchor,
          top: "calc(anchor(bottom) + 4px)",
          bottom: "auto",
          left: end ? "auto" : "anchor(start)",
          right: end ? "anchor(end)" : "auto",
          position: "absolute",
          margin: "unset",
          positionTry: end
            ? "normal flip-block, flip-inline, flip-block flip-inline, --qds-menu-scroll-below-end"
            : "normal flip-block, flip-inline, flip-block flip-inline, --qds-menu-scroll-below",
        }}
        // No `display` class here: it would beat the browser's `display: none` for a closed
        // popover (the grid is on the inner wrapper).
        class={[
          "w-[min(22.5rem,calc(100vw-1rem))] p-4",
          "scrollbar-pane max-h-[calc(100dvh-2rem)] overflow-y-auto",
          "rounded-xs bg-surface-container text-on-surface shadow-2",
        ]}
        onToggle$={(event: ToggleEvent, element: HTMLDivElement) => {
          if (event.newState === "open") {
            mounted.value = true;
            requestAnimationFrame(() =>
              element.querySelector<HTMLElement>(FOCUSABLE)?.focus(),
            );
            return;
          }
          // Escape and `hidePopover()` return focus themselves (HTML spec); a click elsewhere
          // keeps that control's focus. Only focus left inside or lost goes back to the trigger.
          const active = document.activeElement;
          if (!active || active === document.body || element.contains(active))
            menu.triggerRef.value?.focus();
        }}
      >
        {/* The catalog's order: the headline and a copy button on one row, then the theme
          controls without a Reset (`ThemeChanger reset={false}`). */}
        <div class="grid content-start gap-4">
          <div class="flex items-center justify-between gap-2">
            <h2 id={titleId} class="text-title-medium text-on-surface">
              {title}
            </h2>
            <IconButton
              icon={copied.value ? "check" : "content_copy"}
              label={copied.value ? copiedLabel : copyLabel}
              data-tooltip=""
              onClick$={async () => {
                // The generated palette CSS (as the catalog copies its theme), or the built-in
                // source color when no theme has been made.
                const css =
                  document
                    .getElementById(THEME_STYLE_ID)
                    ?.textContent?.trim() || DEFAULT_SOURCE_COLOR;
                await navigator.clipboard.writeText(css);
                copied.value = true;
                setTimeout(() => (copied.value = false), 2000);
              }}
            />
          </div>
          {/* Light / dark is not here: one place only (the rail, the drawer footer). */}
          {mounted.value && <ThemeChanger reset={false} mode={false} />}
        </div>
      </div>
    );
  },
);
