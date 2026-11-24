import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  Badge,
  Icon,
  IconButton,
  Knobs,
  Layout,
  NavigationRail,
  badgeSizes,
  badgeSpokenText,
  knob,
  useKnobs,
} from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    count: knob.boolean(true, "count (large badge)"),
    value: knob.number(3, { min: 0, max: 99999 }),
    max: knob.number(999, { min: 1, max: 9999 }),
    size: knob.select(["auto", ...badgeSizes] as const, "auto"),
  });

  return (
    <>
      <Layout.PaneHeader title="Badge" />
      <Knobs knobs={knobs}>
        <div class="flex flex-wrap items-center gap-8">
          {/* On an icon. */}
          <Badge.Root>
            <Icon name="mail" label="Mail" />
            <Badge.Badge
              value={knobs.values.count ? knobs.values.value : undefined}
              max={knobs.values.max}
              size={
                knobs.values.size === "auto" ? undefined : knobs.values.size
              }
            />
          </Badge.Root>
          {/* On an icon button. */}
          <Badge.Root>
            {/* The badge is outside the button, so the button's own name carries the count. */}
            <IconButton
              icon="notifications"
              label={
                knobs.values.count
                  ? `Notifications, ${badgeSpokenText(knobs.values.value)}`
                  : "Notifications, new notification"
              }
            />
            <Badge.Badge
              announce={false}
              value={knobs.values.count ? knobs.values.value : undefined}
              max={knobs.values.max}
              size={
                knobs.values.size === "auto" ? undefined : knobs.values.size
              }
            />
          </Badge.Root>
          {/* On navigation rail destinations (`NavigationRail.Item badge`). */}
          <NavigationRail.Root aria-label="Badge demo" class="h-64 rounded-lg">
            <NavigationRail.Item
              href="#"
              icon="mail"
              label="Mail"
              current
              badge={knobs.values.count ? knobs.values.value : true}
            />
            <NavigationRail.Item
              href="#"
              icon="notifications"
              label="Alerts"
              badge
            />
          </NavigationRail.Root>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Badge: @seanperez/ui" };
