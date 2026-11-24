import { Slot, component$, useSignal } from "@qwik.dev/core";
import { useLocation } from "@qwik.dev/router";
import type { DocumentHead } from "@qwik.dev/router";
import { AccountMenu, Layout, Search, Select, ThemeChanger } from "../index";
import type { LayoutCompanion, LayoutDrawerItem, LayoutMode } from "../index";

/**
 * The playground's destinations, as e-store's Component Gallery: rail destinations are the
 * categories, each a drawer item with its pages as children (the floating drawer shows them on
 * hover or focus of the category). A category's `href` is its first page.
 */
const sections: LayoutDrawerItem[] = [
  { href: "/", label: "Overview", icon: "home" },
  {
    href: "/button/",
    label: "Actions",
    icon: "add",
    items: [
      { href: "/button/", label: "Button" },
      { href: "/icon-button/", label: "Icon button" },
      { href: "/fab/", label: "FAB" },
      { href: "/fab-menu/", label: "FAB menu" },
      { href: "/split-button/", label: "Split button" },
      { href: "/toggle-group/", label: "Toggle group" },
    ],
  },
  {
    href: "/checkbox/",
    label: "Inputs",
    icon: "edit",
    items: [
      { href: "/checkbox/", label: "Checkbox" },
      { href: "/chip/", label: "Chip" },
      { href: "/combobox/", label: "Combobox" },
      { href: "/date-picker/", label: "Date picker" },
      { href: "/files-input/", label: "Files input" },
      { href: "/label/", label: "Label" },
      { href: "/radio/", label: "Radio" },
      { href: "/scroll-field/", label: "Scroll field" },
      { href: "/select/", label: "Select" },
      { href: "/slider/", label: "Slider" },
      { href: "/switch/", label: "Switch" },
      { href: "/text-field/", label: "Text field" },
      { href: "/time-picker/", label: "Time picker" },
    ],
  },
  {
    href: "/card/",
    label: "Containment",
    icon: "widgets",
    items: [
      { href: "/card/", label: "Card" },
      { href: "/carousel/", label: "Carousel" },
      { href: "/item/", label: "Item" },
      { href: "/list/", label: "List" },
      { href: "/modal/", label: "Modal" },
      { href: "/sheet/", label: "Bottom sheet" },
      { href: "/separator/", label: "Separator (divider)" },
    ],
  },
  {
    href: "/menu/",
    label: "Navigation",
    icon: "explore",
    items: [
      { href: "/menu/", label: "Menu" },
      { href: "/dropdown/", label: "Dropdown" },
      { href: "/navigation-bar/", label: "Navigation bar" },
      { href: "/navigation-rail/", label: "Navigation rail" },
      { href: "/search/", label: "Search" },
      { href: "/tabs/", label: "Tabs" },
      { href: "/toolbar/", label: "Toolbar" },
      { href: "/top-app-bar/", label: "Top app bar" },
    ],
  },
  {
    href: "/badge/",
    label: "Feedback",
    icon: "notifications",
    items: [
      { href: "/badge/", label: "Badge" },
      { href: "/tooltip/", label: "Tooltip" },
      { href: "/snackbar/", label: "Snackbar" },
      { href: "/progress/", label: "Progress indicators" },
      { href: "/loading-indicator/", label: "Loading indicator" },
    ],
  },
  {
    href: "/account-menu/",
    // One word (M3 navigation rail guidelines, read 2026-11-23: "All navigation items require
    // a one word label text."). The theme changer sits with the account's own settings.
    label: "Account",
    icon: "person",
    items: [
      { href: "/account-menu/", label: "Account menu" },
      { href: "/avatar/", label: "Avatar" },
      { href: "/theme-changer/", label: "Theme changer" },
    ],
  },
];

/** Every page, for the app bar's search. */
const pages = sections.flatMap((section) => section.items ?? [section]);

// One companion (owner, 2026-11-23): the theme changer.
const companions: LayoutCompanion[] = [
  { id: "theme", label: "Theme", icon: "palette" },
];

/**
 * The playground's scaffold, built with the library's own `Layout`: the rail and its drawer
 * (the list of components) on the leading side, each route's demo in the primary pane, and the
 * companion rail with the supporting pane on the trailing side.
 *
 * The layout state lives HERE and is bound into `Layout.Root`, which hands it down by context:
 * the rails write it, the drawer and the supporting pane read it.
 */
export default component$(() => {
  const location = useLocation();
  const drawerDocked = useSignal(false);
  const supportExpanded = useSignal(false);
  const activeCompanion = useSignal<string | null>("theme");
  // What is typed in the app bar's search: its results list the matching pages.
  const query = useSignal("");
  // The layout mode knob (in the Theme companion): `compact` tightens margins and corners.
  const layoutMode = useSignal<LayoutMode>("default");

  return (
    <Layout.Root
      title="@seanperez/ui"
      titleHref="/"
      activeHref={location.url.pathname}
      // e-store's Component Gallery: the categories on the rail, their pages in the drawer.
      railItems={sections.map(({ href, label, icon }) => ({
        href,
        label,
        icon: icon ?? "widgets",
      }))}
      drawerTitle="@seanperez/ui"
      drawerItems={sections}
      drawerType="floating"
      themeToggle
      layoutMode={layoutMode.value}
      companions={companions}
      bind:drawerDocked={drawerDocked}
      bind:supportExpanded={supportExpanded}
      bind:activeCompanion={activeCompanion}
    >
      <Layout.Rail />
      <Layout.Drawer />
      <Layout.AppBar>
        {/* `adaptive`: a search icon below 600px that opens the full-screen view, the docked
            bar from 600px. Its results are the matching pages. It does NOT filter the drawer
            (owner, 2026-11-23: no M3 search in the app bar does that). */}
        <Search.Root q:slot="pane" layout="adaptive" bind:query={query}>
          <Search.Trigger label="Search components" />
          <Search.Bar size="compact" placeholder="Search components" />
          <Search.View placeholder="Search components">
            {pages
              .filter((page) =>
                page.label
                  .toLowerCase()
                  .includes(query.value.trim().toLowerCase()),
              )
              .map((page) => (
                <Search.Item
                  key={page.href}
                  label={page.label}
                  href={page.href}
                />
              ))}
          </Search.View>
        </Search.Root>
        {/* A fixed demo person: the playground has no auth. Sign out is a link back home;
            the signing in and out in the page is on /account-menu/. */}
        <AccountMenu
          user={{
            id: "demo-user-1",
            name: "Ada Lovelace",
            email: "ada@example.com",
          }}
          items={[{ label: "Account menu demo", href: "/account-menu/" }]}
          signOutHref="/"
        />
      </Layout.AppBar>
      <Layout.Pane role="primary">
        <Slot />
      </Layout.Pane>
      <Layout.SupportingPane>
        {/* One child: the pane's ruler grid puts each child in the same content cell. */}
        <div class="grid content-start gap-6">
          <ThemeChanger />
          <Select.Root
            value={layoutMode.value}
            options={[
              { value: "default", label: "default" },
              { value: "compact", label: "compact" },
            ]}
            onValueChange$={(value) => (layoutMode.value = value as LayoutMode)}
          >
            <Select.Label label="layoutMode" />
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="default">default</Select.Item>
              <Select.Item value="compact">compact</Select.Item>
            </Select.Content>
            <Select.SupportingText />
          </Select.Root>
        </div>
      </Layout.SupportingPane>
      <Layout.CompanionRail />
      <Layout.Footer>
        <p>
          The playground of @seanperez/ui. Not part of the published library.
        </p>
      </Layout.Footer>
    </Layout.Root>
  );
});

/** Every playground page gets a description (Lighthouse SEO); a page's own `head` adds the title. */
export const head: DocumentHead = {
  meta: [
    {
      name: "description",
      content:
        "The playground of @seanperez/ui: Material 3 components for Qwik.",
      key: "description",
    },
  ],
};
