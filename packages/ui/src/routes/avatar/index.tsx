import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Avatar, Layout } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

/** A picture that always loads: an inline SVG, so the demo fetches nothing. */
const DEMO_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#7c9ce0"/><circle cx="48" cy="38" r="18" fill="#e8eefc"/><rect x="18" y="62" width="60" height="40" rx="30" fill="#e8eefc"/></svg>',
  );

const IMAGES = {
  none: undefined,
  working: DEMO_IMAGE,
  // A path the playground does not serve: the image errors and the initials show.
  broken: "/no-such-avatar.png",
};

export default component$(() => {
  const knobs = useKnobs({
    name: knob.text("Ada Lovelace"),
    image: knob.select(["none", "working", "broken"] as const, "none"),
    size: knob.select(
      [
        "xs",
        "search",
        "appbar",
        "md",
        "post",
        "lg",
        "xl",
        "profile",
        "2xl",
      ] as const,
      "md",
    ),
    tone: knob.select(
      ["seeded", "primary", "secondary", "tertiary", "neutral"] as const,
      "seeded",
    ),
    edge: knob.select(["none", "hairline"] as const, "none"),
    presence: knob.select(
      ["none", "online", "away", "busy", "offline"] as const,
      "none",
    ),
    // Shown with neither a picture nor initials (clear the name to see it).
    fallbackIcon: knob.select(["person", "account_circle"] as const, "person"),
    decorative: knob.boolean(false),
    // The edit badge (NEW 2026-11-24): sizes lg and up.
    editable: knob.boolean(false, "Editable"),
    badgeIcon: knob.select(["add", "photo_camera", "edit"] as const, "add"),
    badgeLook: knob.select(["tonal", "filled"] as const, "tonal"),
    group: knob.boolean(false, "Group"),
  });

  const pressed = useSignal(0);

  return (
    <>
      <Layout.PaneHeader title="Avatar" />
      <Knobs knobs={knobs}>
        <div class="flex flex-wrap items-center gap-6">
          <Avatar
            name={knobs.values.name}
            src={IMAGES[knobs.values.image]}
            size={knobs.values.size}
            tone={
              knobs.values.tone === "seeded" ? undefined : knobs.values.tone
            }
            edge={knobs.values.edge}
            fallbackIcon={knobs.values.fallbackIcon}
            decorative={knobs.values.decorative}
            presence={
              knobs.values.presence === "none"
                ? undefined
                : knobs.values.presence
            }
            editable={knobs.values.editable}
            badgeIcon={knobs.values.badgeIcon}
            badgeLook={knobs.values.badgeLook}
            badgeLabel="Change photo"
            onBadgeClick$={() => pressed.value++}
          />
          {knobs.values.editable && (
            <p class="text-body-medium text-on-surface-variant" role="status">
              {`Badge pressed ${pressed.value} times`}
            </p>
          )}
          {knobs.values.group && (
            <Avatar.Group
              label="Attendees"
              size={knobs.values.size}
              max={3}
              items={[
                { name: "Ada Lovelace" },
                { name: "Grace Hopper" },
                { name: "Alan Turing" },
                { name: "Mara Vale" },
                { name: "Kai Ito" },
              ]}
            />
          )}
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Avatar: @seanperez/ui" };
