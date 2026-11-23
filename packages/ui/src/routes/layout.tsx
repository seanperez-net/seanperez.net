import { Slot, component$, useSignal } from "@qwik.dev/core";
import { Link, useLocation } from "@qwik.dev/router";
import { tv } from "tailwind-variants/lite";
import { Button, Layout, ThemeToggle } from "../index";

const pages = [
  { href: "/", label: "Overview" },
  { href: "/button/", label: "Button" },
  { href: "/icon-button/", label: "Icon button" },
  { href: "/switch/", label: "Switch" },
  { href: "/menu/", label: "Menu" },
];

const navVariants = tv({
  slots: {
    list: ["grid", "gap-0.5"],
    link: [
      "flex",
      "min-h-12",
      "items-center",
      "rounded-full",
      "px-4",
      "text-label-large",
      "text-on-surface-variant",
      "hover:bg-on-surface/8",
      "aria-[current=page]:bg-secondary-container",
      "aria-[current=page]:text-on-secondary-container",
    ],
  },
});

/**
 * The playground's scaffold, built with the library's own `Layout`: each route renders its
 * demo in the primary pane, and the components are listed in the supporting pane.
 * `supportExpanded` lives HERE and is bound into `Layout.Root`, which hands it down by
 * context: the app bar button writes it, `Layout.SupportingPane` reads it.
 */
export default component$(() => {
  const location = useLocation();
  const supportExpanded = useSignal(true);
  const styles = navVariants();

  return (
    <Layout.Root bind:supportExpanded={supportExpanded}>
      <Layout.AppBar title="@seanperez/ui">
        <Button
          look="text"
          label={supportExpanded.value ? "Hide components" : "Show components"}
          aria-expanded={supportExpanded.value}
          onClick$={() => (supportExpanded.value = !supportExpanded.value)}
        />
        <ThemeToggle />
      </Layout.AppBar>
      <Layout.Pane role="primary">
        <Slot />
      </Layout.Pane>
      <Layout.SupportingPane header="Components">
        <nav class={styles.list()} aria-label="Components">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              class={styles.link()}
              aria-current={
                location.url.pathname === page.href ? "page" : undefined
              }
            >
              {page.label}
            </Link>
          ))}
        </nav>
      </Layout.SupportingPane>
      <Layout.Footer>
        <p>
          The playground of @seanperez/ui. Not part of the published library.
        </p>
      </Layout.Footer>
    </Layout.Root>
  );
});
