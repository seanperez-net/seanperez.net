import type { DocumentHead } from "@qwik.dev/router";
import { component$, useSignal } from "@qwik.dev/core";
import { AccountMenu, Layout, ThemeChanger } from "@seanperez/ui";
import { pageHead } from "../seo";
import type { LayoutConfig } from "@seanperez/ui";

const GITHUB = "https://github.com/seanperez-net";
const SOURCE = "https://github.com/seanperez-net/seanperez.net";

/**
 * What the scaffold shows, as plain data. It is spread onto `Layout.Root`, which hands it to
 * the app bar, the rail, the drawer and the companion rail through context. A CMS can store
 * this object as it is.
 */
const pages = [{ href: "/", label: "Home", icon: "home" as const }];

const layout: LayoutConfig = {
  title: "Sean Perez",
  titleHref: "/",
  activeHref: "/",
  // The destinations. No drawer items: no drawer, the rail's menu button stays but is disabled; below 600px
  // the app bar's menu button opens the modal drawer with these (e-store's defaults). GitHub is
  // not a destination of this site: it is the page's own link and the account menu's.
  railItems: pages,
  // The light / dark switch: the layout puts it at the foot of the rail, or in the app bar below
  // 600px.
  themeToggle: true,
  companions: [
    { id: "about", label: "About", icon: "info" },
    { id: "theme", label: "Theme", icon: "palette" },
  ],
};

export default component$(() => {
  // The companion rail's buttons open the supporting pane and choose what it shows (below 600px
  // the pane's own opener does).
  const supportExpanded = useSignal(false);
  const activeCompanion = useSignal<string | null>(null);

  return (
    <Layout.Root
      {...layout}
      bind:supportExpanded={supportExpanded}
      bind:activeCompanion={activeCompanion}
    >
      <Layout.Rail />
      {/* Only the modal drawer below 600px: no destination has children. */}
      <Layout.Drawer />
      <Layout.AppBar>
        {/* The site has no sign-in: this is the owner's own avatar, with his links. */}
        <AccountMenu
          user={{ name: "Sean Perez" }}
          accountLabel="About"
          items={[
            { label: "GitHub", href: GITHUB },
            { label: "Source of this site", href: SOURCE },
          ]}
        />
      </Layout.AppBar>
      <Layout.Pane role="primary">
        <Layout.PaneHeader title="Projects and code" />
        <nav
          class="flex flex-wrap gap-x-5 gap-y-2 text-primary"
          aria-label="Links"
        >
          <a
            href={GITHUB}
            rel="me external"
            class="underline underline-offset-4"
          >
            GitHub
          </a>
        </nav>
      </Layout.Pane>
      <Layout.SupportingPane>
        {activeCompanion.value === "theme" ? (
          <ThemeChanger />
        ) : (
          <p class="text-body-medium">
            Sean Perez: projects and code. This site is built with Qwik on
            Cloudflare Workers.
          </p>
        )}
      </Layout.SupportingPane>
      <Layout.CompanionRail />
      <Layout.Footer>
        <p>
          © Sean Perez ·{" "}
          <a href={SOURCE} rel="external" class="underline underline-offset-4">
            Source
          </a>
        </p>
      </Layout.Footer>
    </Layout.Root>
  );
});

export const head: DocumentHead = ({ url }) => pageHead("/", url);
