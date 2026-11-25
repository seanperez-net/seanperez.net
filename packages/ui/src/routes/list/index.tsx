import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  Avatar,
  Checkbox,
  IconButton,
  Layout,
  List,
  Switch,
} from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

const heading = "text-title-small text-on-surface-variant";

export default component$(() => {
  const chosen = useSignal("wifi");
  const clicked = useSignal("nothing yet");
  const sound = useSignal(true);
  const openGroups = useSignal<string[]>(["settings"]);
  const knobs = useKnobs({
    look: knob.select(["standard", "segmented"], "standard"),
    shape: knob.select(["default", "rounded"], "default"),
    indicator: knob.select(["primary", "secondary"], "primary"),
    padding: knob.select(["default", "tight", "none"], "default"),
    inset: knob.select(["default", "drawer"], "default"),
    density: knob.select(["default", "compact"], "default"),
    dividers: knob.select(["none", "full", "inset"], "none"),
    disabled: knob.boolean(false, "Disable the third row"),
  });
  const v = knobs.values;

  return (
    <>
      <Layout.PaneHeader title="List" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-xl gap-8">
          <section class="grid gap-2">
            <h2 class={heading} id="list-select-label">
              Selection list (interactive: a listbox). Chosen: {chosen.value}
            </h2>
            <List.Root
              interactive
              aria-labelledby="list-select-label"
              bind:value={chosen}
              look={v.look}
              shape={v.shape}
              indicator={v.indicator}
              padding={v.padding}
              inset={v.inset}
              density={v.density}
              class="bg-surface"
            >
              <List.Item
                value="wifi"
                headline="Wi-Fi"
                supportingText="Connected"
                startIcon="widgets"
              />
              {v.dividers !== "none" && (
                <List.Divider inset={v.dividers === "inset"} />
              )}
              <List.Item
                value="sound"
                headline="Sound"
                supportingText="Vibrate on ring"
                startIcon="volume_up"
              />
              {v.dividers !== "none" && (
                <List.Divider inset={v.dividers === "inset"} />
              )}
              <List.Item
                value="display"
                headline="Display"
                supportingText="Dark theme, brightness"
                startIcon="dark_mode"
                disabled={v.disabled}
              />
              {v.dividers !== "none" && (
                <List.Divider inset={v.dividers === "inset"} />
              )}
              <List.Item
                value="about"
                overline="System"
                headline="About"
                supportingText="Version, licences and the people who made it, in a text long enough to wrap"
                startIcon="info"
                trailingSupportingText="v1"
              />
            </List.Root>
          </section>

          <section class="grid gap-2">
            <h2 class={heading}>Display list (no interaction)</h2>
            <List.Root
              look={v.look}
              shape={v.shape}
              padding={v.padding}
              inset={v.inset}
              density={v.density}
              class="bg-surface"
            >
              <List.Item
                headline="Ada Lovelace"
                supportingText="Analyst"
                start={<Avatar name="Ada Lovelace" decorative />}
                trailingSupportingText="9:41"
              />
              {v.dividers !== "none" && (
                <List.Divider inset={v.dividers === "inset"} />
              )}
              <List.Item
                headline="Grace Hopper"
                supportingText="Compiler author"
                start={<Avatar name="Grace Hopper" decorative />}
                trailingSupportingText="Yesterday"
              />
              {v.dividers !== "none" && (
                <List.Divider inset={v.dividers === "inset"} />
              )}
              <List.Item headline="Selected display row" selected />
              <List.Item
                headline="A clickable row in a plain list (its own Tab stop)"
                startIcon="info"
                onClick$={() => (clicked.value = "the plain list's row")}
              />
            </List.Root>
          </section>

          <section class="grid gap-2">
            <h2 class={heading}>
              Navigation list (href rows: each link a Tab stop)
            </h2>
            <List.Root
              aria-label="Components"
              look={v.look}
              shape={v.shape}
              indicator={v.indicator}
              padding={v.padding}
              inset={v.inset}
              density={v.density}
              class="bg-surface"
            >
              <List.Item headline="Item" href="/item/" startIcon="widgets" />
              <List.Item
                headline="List (this page)"
                href="/list/"
                startIcon="widgets"
                selected
              />
              <List.Item
                headline="Button"
                href="/button/"
                startIcon="widgets"
                disabled={v.disabled}
              />
              <List.Item
                headline="A full page load (reload)"
                href="/"
                reload
                startIcon="home"
              />
            </List.Root>
          </section>

          <section class="grid gap-2">
            <h2 class={heading}>
              Actionable rows with controls (rovingFocus). Clicked:{" "}
              {clicked.value}
            </h2>
            <List.Root
              rovingFocus
              aria-label="People"
              look={v.look}
              shape={v.shape}
              padding={v.padding}
              inset={v.inset}
              density={v.density}
              class="bg-surface"
            >
              <List.Item
                headline="Ada Lovelace"
                supportingText="ada@example.com"
                start={<Avatar name="Ada Lovelace" decorative />}
                onClick$={() => (clicked.value = "Ada's row")}
                end={
                  <IconButton
                    icon="more_vert"
                    label="More for Ada"
                    onClick$={() => (clicked.value = "Ada's more button")}
                  />
                }
                endProps={{ "stoppropagation:click": true }}
              />
              <List.Item
                headline="Sound"
                startIcon="volume_up"
                onClick$={() => (sound.value = !sound.value)}
                end={<Switch aria-label="Sound" bind:checked={sound} />}
                endProps={{ "stoppropagation:click": true }}
              />
              <List.Item
                defaultSlot={
                  <Checkbox label="A checkbox row: its label is the whole text" />
                }
              />
            </List.Root>
          </section>

          <section class="grid gap-2">
            <h2 class={heading}>
              Groups (expand and collapse). Open: {openGroups.value.join(", ")}
            </h2>
            <List.Root
              bind:openGroups={openGroups}
              look={v.look}
              shape={v.shape}
              padding={v.padding}
              inset={v.inset}
              density={v.density}
              class="bg-surface"
            >
              <List.Group value="settings">
                <List.GroupHeader
                  label="Settings"
                  startIcon="manage_accounts"
                />
                <List.GroupContent>
                  <List.Item headline="Wi-Fi" startIcon="widgets" />
                  <List.Item headline="Sound" startIcon="volume_up" />
                </List.GroupContent>
              </List.Group>
              <List.Group value="about">
                <List.GroupHeader label="About" startIcon="info" />
                <List.GroupContent>
                  <List.Item
                    headline="Version"
                    trailingSupportingText="1.0.0"
                  />
                </List.GroupContent>
              </List.Group>
              <List.Group value="add-only">
                <List.GroupHeader
                  label="Add-only section (disabled header)"
                  chevronIcon={null}
                  aria-disabled
                />
              </List.Group>
            </List.Root>
          </section>

          <section class="grid gap-2">
            <h2 class={heading} id="list-accordion-label">
              Groups in a selection list, one open at a time
            </h2>
            <List.Root
              interactive
              multipleGroups={false}
              aria-labelledby="list-accordion-label"
              look={v.look}
              shape={v.shape}
              indicator={v.indicator}
              density={v.density}
              class="bg-surface"
            >
              <List.Group value="a" open>
                <List.GroupHeader label="Fruit" />
                <List.GroupContent>
                  <List.Item value="apple" headline="Apple" />
                  <List.Item value="pear" headline="Pear" />
                </List.GroupContent>
              </List.Group>
              <List.Group value="b" open={false}>
                <List.GroupHeader label="Vegetables" />
                <List.GroupContent>
                  <List.Item value="leek" headline="Leek" />
                  <List.Item value="kale" headline="Kale" />
                </List.GroupContent>
              </List.Group>
            </List.Root>
          </section>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "List: @seanperez/ui" };
