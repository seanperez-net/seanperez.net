import {
  $,
  Slot,
  component$,
  isServer,
  useComputed$,
  useContextProvider,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";
import { useLocation } from "@qwik.dev/router";
import { AccountMenu, Layout, Snackbar } from "@seanperez/ui";
import type {
  AccountMenuItem,
  AccountPresencePref,
  LayoutCompanion,
  LayoutConfig,
  LayoutDrawerItem,
} from "@seanperez/ui";
import { useMyAppsProvider } from "../apps/use-my-apps";
import { AppActionFab, appActionFor } from "../components/app-action";
import { ContactMeMenu } from "../components/contact-me-menu";
import {
  CONTACT_COMPANION_ID,
  ContactPanel,
  useContactSetup,
  useSendMessage,
} from "../components/contact-panel";
import {
  useResendVerification,
  useSendToSean,
  useVerifyCode,
} from "../components/contact-actions";
import {
  MAPS_COMPANIONS,
  MapPanel,
  isMapsCompanion,
} from "../components/map-panel";
import { useMapsProvider } from "../components/map-state";
import {
  MESSAGES_DETAILS_COMPANION,
  MessagesDetailsPanel,
  isMessagesThreadPath,
} from "../components/messages-details";
import {
  MessagesWindowHost,
  useMessagesWindowProvider,
} from "../components/messages-window-host";
import { SiteSearch } from "../components/site-search";
import { useOwnerLinks } from "../components/social-links";
import { readLabelCache } from "../contacts/frequency";
import { localLabelsId, type DrawerLabel } from "../contacts/local-context";
import { contactsDrawerGroups } from "../content/contacts";
import { GUEST_ACCOUNT } from "../content/accounts";
import { MESSAGES_DRAWER_GROUPS, messagesHref } from "../content/conversations";
import { DEMO } from "../demo/demo";
import { choosePresence } from "../presence/presence-client";
import { untilText, usePresenceProvider } from "../presence/use-presence";
import { YOUR_APPS_ID } from "../components/profile-parts";
import { ownName, useProfileOverrideProvider } from "../profile/use-profile";

// The contact form's loader and action, re-exported so the router runs them (Qwik rc.5
// "Re-exporting loaders"). Here, in the ROOT layout, they serve every route: the form in the
// side pane posts to the page the visitor is on, so there is no /contact/ route.
export { useContactSetup, useSendMessage };
// The contact account's code, resend and Sean's-thread send (`components/contact-actions.ts`),
// re-exported for the same reason: they run on whatever page the visitor is on.
export { useResendVerification, useSendToSean, useVerifyCode };
// The owner's profile links for the Contact me companion's icon row (`social-links.tsx`).
export { useOwnerLinks };

/**
 * The scaffold for every route, as plain data (rule L2: ONE `Layout.Root`, here). It is spread
 * onto `Layout.Root`, which hands it to the app bar, the rail and the companion rail through
 * context. A CMS can store this object as it is.
 *
 * The site is a showcase of the owner's Layout with small apps in it (owner, 2026-11-23): the
 * rail holds the apps (Home, Contacts, Maps open in the primary pane), and each app brings its own
 * side panels, plus Contact on every route (owner, 2026-11-24): see `MAPS_COMPANIONS`, `CONTACT_PANEL`.
 */
const layout: LayoutConfig = {
  title: "Sean Perez",
  titleHref: "/",
  // No drawer items: no drawer from 600px, the rail's menu button stays but is disabled; below
  // 600px the app bar's menu button opens the modal drawer with the rail items (e-store's).
  railItems: [
    // Home is the feed; Contacts is the owner's contact profile with the résumé in it (owner,
    // 2026-11-24: "change about to contacts"). `contacts`: e-store's Contacts app icon
    // (`contacts-app.tsx` `headingIcon`), Material's contacts symbol.
    { href: "/", label: "Home", icon: "home" },
    { href: "/contacts/", label: "Contacts", icon: "contacts" },
    // Messages (owner, 2026-11-24): the chat package's app. `chat`: Material's messaging symbol.
    { href: "/messages/", label: "Messages", icon: "chat" },
    // `explore`: Material's maps / discover symbol. `prefetchBundles: "intent"` (perf audit
    // 2026-11-24): the router's default `"visible"` fetched the Maps route, MapLibre included
    // (about 250 KB brotli), on every page because the rail is always on screen. Now only on
    // hover or focus of the item; the other apps are light and keep the default.
    {
      href: "/maps/",
      label: "Maps",
      icon: "explore",
      prefetchBundles: "intent",
    },
  ],
  // The light / dark switch at the rail's foot from 600px only (owner, 2026-11-24). Below 600px
  // there is no rail: the account menu's Theme submenu is the control there.
  themeToggle: "rail",
  // e-store's floating drawer (owner's choice, drawer-own-surface): the drawer items are the
  // same on every public route (`drawerItems` below); today only Messages has a section.
  drawerType: "floating",
};

/**
 * Each rail destination's drawer groups (its sub-navigation), by the destination's `href`. A
 * destination listed here gets e-store's floating card on hover / focus from any page, and the
 * rail's menu button (dock / undock) on its own pages; one not listed opens nothing and leaves
 * the button disabled there. To give an app a drawer, add its `href` and its groups
 * (`LayoutDrawerItem[]`: groups with `items`, or plain rows) here. Its pages then mark their own
 * row (`activeHref` is the path, `inDrawerApp`); the rail marks the destination as the section
 * when a row holds the page (prefix match), and the docked card shows from then on.
 */
const DRAWER_GROUPS: Record<string, LayoutDrawerItem[]> = {
  // Contacts (2026-11-24): Google Contacts' navigation (`content/contacts.ts`); the visitor's own
  // labels are added in the component (`contactLabels`).
  "/contacts/": contactsDrawerGroups(),
  "/messages/": MESSAGES_DRAWER_GROUPS,
};

/** The drawer's row for the visitor's own conversation, named "<edited name> (you)". */
const withOwnDrawerName = (
  items: LayoutDrawerItem[],
  name: string | undefined,
): LayoutDrawerItem[] =>
  !name
    ? items
    : items.map((item) =>
        item.items
          ? { ...item, items: withOwnDrawerName(item.items, name) }
          : item.href === messagesHref(GUEST_ACCOUNT.chatId!)
            ? { ...item, label: `${name} (you)` }
            : item,
      );

/** A page inside an app with drawer groups: the drawer marks the page's own row. */
const inDrawerApp = (path: string) =>
  Object.keys(DRAWER_GROUPS).some((href) => path.startsWith(href));

/**
 * Each app's side panel (owner, 2026-11-24): the supporting pane follows the route, as e-store's
 * UI gallery chooses its supporting pane's content from the path (`packages/ui/src/routes/
 * layout.tsx`, `bleed`). Maps: the map's own controls. Home has none: its Theme panel moved to
 * the account menu's theme dropdown (owner, 2026-11-24: "if its in the menu it should be a menu
 * not go into the pane"), and a second copy of the same controls is filler. M3: a supporting
 * pane holds content "only meaningful in relation to the primary content", and a side sheet
 * "actions that affect the screen's primary content".
 * Maps has THREE companions, Search, Directions and Style (`MAPS_COMPANIONS` in
 * `components/map-panel.tsx`; owner 2026-11-24: one rail item per panel, not tabs in one).
 */

/**
 * The contact form (owner, 2026-11-24): its OWN companion-rail button on every route, never a
 * section inside another panel ("you can add more rail items to change the sub pane"). It is
 * last, after the route's own panels.
 */
// "Contact me" (2026-11-24, was "Message me"): the panel holds every way to reach the owner, the
// form AND his links under Send; "Message me" also read as the Messages app. The profile's
// "Message" button is the action that opens it.
const CONTACT_PANEL = {
  id: CONTACT_COMPANION_ID,
  label: "Contact me",
  // Owner 2026-11-24: its own icon (not `mail`, which reads as Messages' `chat` and the admin
  // inbox's `mail`) and a primary colour that stands out: the rail's FAB colours at rest,
  // `primary` while open (`LayoutCompanion.emphasis`). The public site only; the admin has none.
  icon: "waving_hand",
  // Filled while its panel is open (owner, 2026-11-24).
  iconSelected: "waving_hand_filled",
  emphasis: "primary",
} satisfies LayoutCompanion;

/**
 * Who the account menu shows: THE VISITOR, a guest account (owner decision 2026-11-25, memory
 * `visitor-is-guest-you`; until then the site looked signed in as the owner). "You" until they
 * set a name in Profile (`profile.local`, their browser). The owner is a separate person
 * (Contacts, Messages). No email (owner, 2026-11-24: no address anywhere on the site); `id` keeps
 * the avatar's tone stable.
 */

/**
 * The account menu's rows (owner, 2026-11-24): what a signed-in person has, read-only here.
 * e-store's account links pattern (`CFOS_ACCOUNT_LINKS`: Profile `/profile/` `person`), as
 * `AccountMenu items` (href-only data), above "Theme colors".
 */
const ACCOUNT_ITEMS: AccountMenuItem[] = [
  { id: "profile", label: "Profile", href: "/profile/", icon: "person" },
  // The Maps nodes as the account's devices (owner, 2026-11-24).
  { id: "devices", label: "Devices", href: "/devices/", icon: "devices" },
  // No Contacts row (owner, 2026-11-25: "we dont need contacts in both places leave it in the
  // rail"): Contacts is a rail app.
];

export default component$(() => {
  const loc = useLocation();
  // The companion rail's button opens the supporting pane on the route's panel (below 600px the
  // pane's own opener does).
  // Every page opens with Contact beside it (owner, 2026-11-24: "the contact pane should always
  // be open on every route just for this demo so people see it except on small screens").
  // Server-rendered expanded: from 840px the pane shows in the grid; below 840px it is a sheet
  // that stays closed until asked for (`layout.md`, compact screens). Only the first load: a
  // visitor who closes it keeps it closed while navigating.
  // DEMO: Contact me open on the first load is the showcase; with the layer off the pane starts
  // closed and nothing is chosen (`demo/demo.ts`).
  const supportExpanded = useSignal(DEMO);
  const activeCompanion = useSignal<string | null>(
    DEMO ? CONTACT_COMPANION_ID : null,
  );
  // The route's panels, then Contact (read in `useComputed$`, rule Q12).
  // The rail destination the page is in: the page itself, or the destination it sits under
  // (`/contacts/sean-perez/` is in Contacts). The rail and the drawer mark `href === activeHref`
  // only, so a detail page would otherwise show no current destination.
  // The rail's destinations (the admin and its own rail left for `apps/admin`, 2026-11-25).
  const railItems = useComputed$(() => layout.railItems ?? []);
  const activeHref = useComputed$(() => {
    const path = loc.url.pathname;
    // A route with drawer items marks its own row in the drawer (`href === activeHref`), and the
    // rail marks the destination whose drawer item holds it as the section (`layout.md`).
    if (inDrawerApp(path)) return path;
    const within = railItems.value
      .map((item) => item.href)
      .filter((href) => href !== "/" && path.startsWith(href))
      .sort((a, b) => b.length - a.length)[0];
    return within ?? path;
  });
  // The drawer (2026-11-24, owner: "the shortcuts etc are in the drawer why are you not using
  // our drawer for this"): the rail's destinations with each app's groups under its own entry
  // (`DRAWER_GROUPS`)
  // (ONE list with the rail, rule L24; the compact modal drawer lists all of it), on EVERY public
  // route (owner, 2026-11-24: hovering Messages floats its sections from any page). The Layout
  // decides the rest: docked on Messages, the rail's menu button disabled elsewhere
  // (`layout.md`).
  // The VISITOR's contact labels (2026-11-24, browser only): the Contacts layout keeps this
  // signal current from their book; on other routes a small cache fills it once the page is
  // idle, so the floating Contacts card lists them too. Empty in the server HTML.
  const contactLabels = useSignal<DrawerLabel[]>([]);
  useContextProvider(localLabelsId, contactLabels);
  // VISIBLE-TASK AUDIT 2026-11-25: REPLACE — useOnDocument('qidle', $(...)): the document-idle strategy IS useOnDocument('qidle'), untracked, root layout always SSR (core.mjs useRegisterTaskEvents; docs best-practices)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      if (!contactLabels.value.length) contactLabels.value = readLabelCache();
    },
    { strategy: "document-idle" },
  );
  // The visitor's own profile edit (`/profile/` Edit, saved in their browser, 2026-11-24): their
  // name ("You" until set) in the account menu, Messages and `/profile/`.
  const profileOverride = useProfileOverrideProvider();
  const accountUser = useComputed$(() => ({
    id: GUEST_ACCOUNT.id,
    name: ownName(profileOverride.fields),
  }));
  // The visitor's removed apps (2026-11-25, Contact me), from their browser after resume.
  const myApps = useMyAppsProvider();
  const contactMeOn = useComputed$(
    () => DEMO && !myApps.removed.includes("contact"),
  );
  // While Contact me is removed, the account menu offers the way back (to Profile's "Your apps").
  const accountItems = useComputed$<AccountMenuItem[]>(() =>
    DEMO && !contactMeOn.value
      ? [
          ...ACCOUNT_ITEMS,
          {
            id: "contact-me",
            label: "Add Contact me back",
            href: `/profile/#${YOUR_APPS_ID}`,
            icon: "waving_hand",
          },
        ]
      : ACCOUNT_ITEMS,
  );
  const drawerItems = useComputed$<LayoutDrawerItem[] | undefined>(() => {
    const groups: Record<string, LayoutDrawerItem[]> = {
      ...DRAWER_GROUPS,
      "/contacts/": contactsDrawerGroups(contactLabels.value),
      // The self conversation's row under the visitor's own edited name.
      "/messages/": withOwnDrawerName(
        MESSAGES_DRAWER_GROUPS,
        profileOverride.fields?.name,
      ),
    };
    return (layout.railItems ?? []).map((item) =>
      groups[item.href] ? { ...item, items: groups[item.href] } : item,
    );
  });
  // Docked from the first load (Google Chat's nav is always beside the conversation); the rail's
  // menu button undocks it into e-store's floating card. Only Messages has a section, so this
  // choice only shows there; elsewhere the button is disabled and hover floats the card.
  const drawerDocked = useSignal(true);
  // The route's key action (`components/app-action.tsx`): the rail's FAB from 600px.
  const action = useComputed$(() => appActionFor(loc.url.pathname));
  const companions = useComputed$<LayoutCompanion[]>(() => [
    ...(loc.url.pathname.startsWith("/maps") ? MAPS_COMPANIONS : []),
    // A conversation's details (2026-11-24, Google Chat's members panel): on `/messages/<id>/`.
    ...(isMessagesThreadPath(loc.url.pathname)
      ? [MESSAGES_DETAILS_COMPANION]
      : []),
    // DEMO: Contact me exists only in the showcase layer; off, it is gone everywhere. The
    // visitor may remove it locally (2026-11-25, `apps/my-apps.ts`); the server HTML has it.
    ...(contactMeOn.value ? [CONTACT_PANEL] : []),
  ],
  );
  // Contact me removed while its panel was the open one (2026-11-25, `/docs/apps/`): set when it
  // goes, so that adding it back (Undo, "Add it back", Profile) leaves the pane as it was. Only a
  // pane ON SHOW beside the page reopens (from 840px); below 840px the pane is a modal sheet,
  // which the visitor had closed to reach the button, so it stays closed.
  const contactRestore = useSignal<{ expanded: boolean } | null>(null);
  // Client navigation with the pane open on a panel the new route does not have (a Maps panel
  // when leaving /maps/): it switches to the new route's first panel. Contact stays open across
  // routes; a closed pane stays closed.
  useTask$(({ track }) => {
    const ids = track(() => companions.value.map((c) => c.id));
    const active = activeCompanion.value;
    const restore = contactRestore.value;
    if (restore && ids.includes(CONTACT_PANEL.id)) {
      contactRestore.value = null;
      // Not over a panel the visitor opened meanwhile: only from a closed pane or the task's own
      // fallback below (the route's first panel).
      if (restore.expanded && (active === null || active === ids[0])) {
        activeCompanion.value = CONTACT_PANEL.id;
        supportExpanded.value = true;
      }
      return;
    }
    if (active === null || ids.includes(active)) return;
    if (active === CONTACT_PANEL.id && !isServer)
      contactRestore.value = {
        expanded:
          supportExpanded.value && matchMedia("(min-width: 840px)").matches,
      };
    activeCompanion.value = ids[0] ?? null;
    // DEMO: only with the layer off can a route have no panels (no Contact me): close the pane
    // rather than leave it open and empty.
    if (ids.length === 0) supportExpanded.value = false;
  });

  // Registered here as well as in the panel (rc.5 "Re-exporting loaders": a loader used only
  // by a conditionally rendered component must be registered in the route boundary).
  useContactSetup();
  useSendMessage();
  useVerifyCode();
  useResendVerification();
  useSendToSean();
  useOwnerLinks();

  // The signed-in user's presence: the VISITOR's own activity and chosen status, kept in their
  // browser through the shared sync seam (owner, 2026-11-24; `presence/presence.ts`). The same
  // code in `apps/admin`, plus its service-worker dispatcher.
  const presence = usePresenceProvider();
  // When the chosen status ends, in the visitor's words and clock ("Until 3:40 PM").
  const presenceUntil = useComputed$(() => untilText(presence));

  // The Maps app's state (search, directions, style, nodes), shared by its side panel and its
  // map. `supportExpanded` too: a click on a node on the map opens the Nodes panel.
  useMapsProvider(activeCompanion, supportExpanded);

  // The floating Messages window (2026-11-24): `useMessagesWindow().open$(accountId, el)` from
  // any page (the Contacts person page's "Message"); `<MessagesWindowHost />` below renders it.
  useMessagesWindowProvider();

  return (
    // ONE snackbar for the site (2026-11-24): the rail's FAB is outside every app's pane, so the
    // apps' own `Snackbar.Root`s went (two roots could stack two snackbars). It renders only its
    // slot plus a top-layer popover and a live region, so the scaffold grid is untouched.
    <Snackbar.Root>
      <Layout.Root
        {...layout}
        // Read in JSX, not the body (rule Q12): the rail marks the route the visitor is on.
        railItems={railItems.value}
        activeHref={activeHref.value}
        drawerItems={drawerItems.value}
        companions={companions.value}
        bind:drawerDocked={drawerDocked}
        bind:supportExpanded={supportExpanded}
        bind:activeCompanion={activeCompanion}
      >
        <Layout.Rail
          fab={
            action.value ? <AppActionFab action={action.value} /> : undefined
          }
        />
        {/* From 600px the floating / docked drawer on routes with drawer items (Messages); below
          600px the modal drawer with every destination. */}
        <Layout.Drawer />
        <Layout.AppBar>
          {/* The site-wide search on every route, Maps too (owner, 2026-11-24): the app bar's
            `pane` column. Maps keeps its own place search in its Search companion. */}
          <SiteSearch q:slot="pane" />
          {/* The visitor's own account: name and presence dot (no email). The menu holds
            Profile and Devices (`ACCOUNT_ITEMS`; Contacts is in the rail only, 2026-11-25), then "Theme colors" (owner, 2026-11-24): it opens the Theme Controls menu at the avatar
            on every route (`themeColors`). Light / dark is in the rail and the compact drawer's
            footer (`themeToggle: "rail"`), not here. No Sign out: nothing would work. */}
          <AccountMenu
            // The visitor (guest): their edited name, else "You" (`profile/use-profile.tsx`).
            user={accountUser.value}
            // The visitor's own status (not a demo literal since 2026-11-24): automatic from
            // their activity, or the status row they chose (saved locally, never sent).
            presence={presence.shown}
            presencePref={presence.pref}
            // Busy's length (1 h, 4 h, end of day, until changed) from its submenu.
            presenceDuration={presence.lasts ?? undefined}
            presenceUntilText={presenceUntil.value}
            // ONE Status row opening the choices (owner, 2026-11-25: "it takes up to much space").
            presenceLook="submenu"
            onPresenceChange$={$((pref: AccountPresencePref, lasts?: string) =>
              choosePresence(pref, lasts),
            )}
            statusText={presenceUntil.value}
            items={accountItems.value}
            themeColors
          />
        </Layout.AppBar>
        <Slot />
        {/* The floating Messages window: nothing until a page opens one; then a
          `popover="manual"` in the top layer, outside the scaffold grid. */}
        <MessagesWindowHost />
        {/* Always mounted (see the task above). No `header`: the pane titles itself with the open
          companion's label. The body is the open companion's panel, nothing while closed (so
          Turnstile's script loads only once Contact is opened). */}
        <Layout.SupportingPane>
          {/* The pane's ONE body element (layout.md). */}
          <div>
            {isMapsCompanion(activeCompanion.value) && (
              <MapPanel which={activeCompanion.value} />
            )}
            {activeCompanion.value === MESSAGES_DETAILS_COMPANION.id && (
              <MessagesDetailsPanel />
            )}
            {activeCompanion.value === CONTACT_PANEL.id &&
              contactMeOn.value && <ContactPanel />}
          </div>
          {/* Contact me's own "More" menu (Remove from my apps), in the pane's title row. */}
          {activeCompanion.value === CONTACT_PANEL.id && contactMeOn.value && (
            <ContactMeMenu q:slot="header-actions" />
          )}
        </Layout.SupportingPane>
        {/* DEMO: with the layer on every route has Contact, so the rail is always there; off, a
          route without panels has no companion rail (`layout.css` collapses its track). */}
        {companions.value.length > 0 && <Layout.CompanionRail />}
        {/* No Layout.Footer (owner, 2026-11-24): M3 app layouts have no site footer; the
          GitHub profile and the source link are the owner's contact profile's "Links" section, and the copyright line
          was dropped. */}
      </Layout.Root>
    </Snackbar.Root>
  );
});
