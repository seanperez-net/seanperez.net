import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  Button,
  Card,
  IconButton,
  Knobs,
  Layout,
  TextField,
  cardVariantNames,
  knob,
  useKnobs,
} from "../../index";

/** A plain picture for the demo (no image files in the playground). */
const picture = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="hsl(${hue} 45% 62%)"/><circle cx="240" cy="60" r="34" fill="hsl(${hue} 60% 82%)"/><path d="M0 180 110 80l80 70 40-30 90 60Z" fill="hsl(${hue} 40% 38%)"/></svg>`,
  )}`;

export default component$(() => {
  const clicks = useSignal(0);
  const knobs = useKnobs({
    variant: knob.select(cardVariantNames, "elevated"),
    // M3 accessibility: a card is either a container holding actions, or directly actionable
    // (the link or button role) with no actions inside.
    kind: knob.select(
      ["container", "link card", "button card"] as const,
      "container",
    ),
    media: knob.boolean(true),
    disabled: knob.boolean(false),
    dragged: knob.boolean(false),
    headline: knob.text("Glacier hike"),
    subhead: knob.text("Saturday, 9:00"),
  });

  return (
    <>
      <Layout.PaneHeader title="Card" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-90 gap-4">
          {knobs.values.kind === "container" && (
            <Card.Root
              variant={knobs.values.variant}
              disabled={knobs.values.disabled}
              dragged={knobs.values.dragged}
            >
              {knobs.values.media && (
                <Card.Media src={picture(200)} width={320} height={180} />
              )}
              <Card.Header>
                <Card.Title>{knobs.values.headline}</Card.Title>
                <Card.Description>{knobs.values.subhead}</Card.Description>
              </Card.Header>
              <Card.Content>
                <p class="text-on-surface-variant">
                  A short walk on the ice with a guide. Boots are provided.
                </p>
                <TextField label="Your name" disabled={knobs.values.disabled} />
              </Card.Content>
              <Card.Footer>
                <IconButton
                  icon="star"
                  iconSelected="star_filled"
                  label="Save"
                  toggle
                  disabled={knobs.values.disabled}
                />
                <Button
                  look="outlined"
                  label="Details"
                  disabled={knobs.values.disabled}
                />
                <Button
                  look="filled"
                  label="Book"
                  disabled={knobs.values.disabled}
                />
              </Card.Footer>
            </Card.Root>
          )}
          {knobs.values.kind === "link card" && (
            <Card.Root
              as="link"
              href="/card/"
              variant={knobs.values.variant}
              disabled={knobs.values.disabled}
              dragged={knobs.values.dragged}
              aria-labelledby="card-demo-title"
            >
              {knobs.values.media && (
                <Card.Media src={picture(30)} width={320} height={180} />
              )}
              <Card.Header>
                <Card.Title id="card-demo-title">
                  {knobs.values.headline}
                </Card.Title>
                <Card.Description>{knobs.values.subhead}</Card.Description>
              </Card.Header>
              <Card.Content>
                <p class="text-on-surface-variant">
                  The whole card is one link.
                </p>
              </Card.Content>
            </Card.Root>
          )}
          {knobs.values.kind === "button card" && (
            <Card.Root
              interactive
              variant={knobs.values.variant}
              disabled={knobs.values.disabled}
              dragged={knobs.values.dragged}
            >
              <Card.Action
                aria-labelledby="card-demo-button-title"
                aria-describedby="card-demo-button-text"
                disabled={knobs.values.disabled}
                onClick$={() => clicks.value++}
              />
              {knobs.values.media && (
                <Card.Media src={picture(280)} width={320} height={180} />
              )}
              <Card.Header>
                <Card.Title id="card-demo-button-title">
                  {knobs.values.headline}
                </Card.Title>
                <Card.Description>{knobs.values.subhead}</Card.Description>
              </Card.Header>
              <Card.Content>
                <p id="card-demo-button-text" class="text-on-surface-variant">
                  The whole card is one button: pressed {clicks.value} times.
                </p>
              </Card.Content>
            </Card.Root>
          )}
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Card: @seanperez/ui" };
