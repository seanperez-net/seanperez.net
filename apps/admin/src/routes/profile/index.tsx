import { $, component$, useStore } from "@qwik.dev/core";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
  type DocumentHead,
} from "@qwik.dev/router";
import { Button, IconButton, Layout, TextField } from "@seanperez/ui";
import { requireAdmin } from "@seanperez/data/feed/access.server";
import { formatDate } from "@seanperez/data/feed/format";
import { PROFILE_MAX } from "@seanperez/data/profile/limits";
import { safeLinkHref } from "@seanperez/data/profile/profile";
import {
  getProfileForm,
  resetProfile,
  saveProfile,
} from "@seanperez/data/profile/profile.server";

/**
 * The profile editor (owner, 2026-11-24: the profile is "for the cms behind the zone"). Under
 * the admin app, so its root `layout.tsx` `onRequest` gates the page, its loader JSON and its
 * action POSTs (Cloudflare Access; fails closed). `requireAdmin` again in each action, as the
 * post editor does. Static `profile/` wins over the dynamic `[id]/`.
 *
 * Shape after e-store's dashboard profile page (`packages/dashboard/src/core/dashboard/pages/
 * profile.tsx`: TextFields in a form, one Save); its password and email fields are left out
 * (no sign-in, no email on the site).
 */
export const useProfileForm = routeLoader$(async ({ platform }) => {
  try {
    return { ok: true as const, form: await getProfileForm(platform.env.DB) };
  } catch (error) {
    // The table is missing: migration 0002 not applied yet.
    console.error("profile: admin read failed", error);
    return { ok: false as const };
  }
});

const linkRow = z.object({
  label: z.string().max(PROFILE_MAX.linkLabel),
  href: z.string().max(PROFILE_MAX.linkHref),
});

export const useSaveProfile = routeAction$(
  async (data, ev) => {
    await requireAdmin(ev);
    const db = ev.platform.env.DB;
    try {
      if (data.intent === "reset") {
        await resetProfile(db);
        return { message: "Back to the defaults." };
      }
      // A row with both fields empty is a blank; a half-filled or unsafe one is an error.
      const linkErrors: Record<string, string> = {};
      const links: { label: string; href: string }[] = [];
      (data.links ?? []).slice(0, PROFILE_MAX.links).forEach((row, i) => {
        const label = row.label.trim();
        const raw = row.href.trim();
        if (!label && !raw) return;
        const href = safeLinkHref(raw);
        if (!label) linkErrors[`links.${i}.label`] = "Enter a label.";
        if (!href)
          linkErrors[`links.${i}.href`] = /^\s*mailto:/i.test(raw)
            ? "No email addresses: the site shows none. Use a profile address."
            : "An https:// address.";
        if (label && href) links.push({ label, href });
      });
      if (Object.keys(linkErrors).length) {
        return ev.fail(400, {
          message: "Check the links.",
          fieldErrors: linkErrors,
        });
      }
      await saveProfile(db, {
        name: data.name,
        headline: data.headline,
        location: data.location,
        bio: data.bio,
        links,
      });
      return {
        message:
          "Saved. The profile page shows it now; the Contact me icons within a minute.",
      };
    } catch (error) {
      console.error("profile: save failed", error);
      return ev.fail(500, {
        message:
          "Could not save. Is migration 0002_create_profile applied to this database?",
      });
    }
  },
  zod$({
    name: z.string().max(PROFILE_MAX.name),
    headline: z.string().max(PROFILE_MAX.headline),
    location: z.string().max(PROFILE_MAX.location),
    bio: z.string().max(PROFILE_MAX.bio),
    links: z.array(linkRow).max(PROFILE_MAX.links).optional(),
    intent: z.enum(["save", "reset"]),
  }),
);

export default component$(() => {
  const loaded = useProfileForm();
  const save = useSaveProfile();
  const errors = (save.value?.fieldErrors ?? {}) as Record<
    string,
    string | string[] | undefined
  >;
  // What a field shows: the stored value, or after a refused save the text that was sent (the
  // post editor's `fieldValue`; a refusal must not wipe what was typed).
  const shown = (name: string, stored: string) =>
    save.value?.failed ? (save.formData?.get(name)?.toString() ?? "") : stored;
  const err = (key: string) => {
    const value = errors[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title="Profile">
        <Button type="link" href="/profile/" look="text" label="View profile" />
      </Layout.PaneHeader>
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid max-w-3xl content-start gap-6">
        {!loaded.value.ok ? (
          <p role="alert" class="text-body-large text-error">
            The profile table does not exist yet. Apply migration
            0002_create_profile to this database.
          </p>
        ) : (
          <>
            <p class="text-body-medium text-on-surface-variant">
              {loaded.value.form.updatedAt
                ? `Saved ${formatDate(loaded.value.form.updatedAt)}.`
                : "Not saved yet: the profile page shows the defaults."}{" "}
              An empty field shows its default. No email address: the site shows
              none.
            </p>
            <Form action={save} class="grid gap-4">
              <TextField
                name="name"
                label="Name"
                // The owner's own name: autofill is right here (HTML autofill "name").
                autocomplete="name"
                maxLength={PROFILE_MAX.name}
                value={shown("name", loaded.value.form.name)}
                supportingText={`Default: ${loaded.value.form.defaultName}`}
                error={err("name")}
              />
              <TextField
                name="headline"
                label="Headline"
                // HTML's job-title token (`organization-title`) is not in TypeScript's DOM
                // `AutoFill` list (5.9.3 `lib.dom.d.ts`), so it does not type-check: off.
                autocomplete="off"
                maxLength={PROFILE_MAX.headline}
                value={shown("headline", loaded.value.form.headline)}
                supportingText="One line under the name, e.g. your job title."
                error={err("headline")}
              />
              {/* A plain field since the move to apps/admin (2026-11-25): the site's
                  `PlaceField` (Maps place search + "Use my location") is apps/web code and is
                  not copied across apps (rule A15); OPEN for the owner (a shared place field).
                  `autocomplete="off"`: no token is "City, Country" (`address-level2` would
                  fill the city alone). */}
              <TextField
                name="location"
                label="Location"
                autocomplete="off"
                maxLength={PROFILE_MAX.location}
                value={shown("location", loaded.value.form.location)}
                supportingText="City, Country, or any place."
                error={err("location")}
              />
              <TextField
                name="bio"
                type="textarea"
                rows={4}
                resize="vertical"
                label="Bio"
                maxLength={PROFILE_MAX.bio}
                value={shown("bio", loaded.value.form.bio)}
                supportingText={`Plain text, up to ${PROFILE_MAX.bio} characters. Default: the résumé summary.`}
                error={err("bio")}
              />
              <fieldset class="grid gap-4">
                <legend class="mb-2 text-title-medium text-on-surface">
                  Links
                </legend>
                <p class="text-body-medium text-on-surface-variant">
                  {loaded.value.form.linksDefault
                    ? "Showing the résumé's links until you save."
                    : "Empty rows are left out. The order here is the order of the Contact me icons."}{" "}
                  A profile on GitHub, X, Bluesky, YouTube, Instagram or a large
                  Mastodon instance gets its mark (from the address), and
                  rel="me". Addresses are https:// only, never email.
                </p>
                <LinksEditor
                  initial={
                    save.value?.failed
                      ? sentLinks(save.formData)
                      : loaded.value.form.links
                  }
                  errors={errors}
                />
              </fieldset>
              {save.value?.failed && save.value.message && (
                <p role="alert" class="text-body-medium text-error">
                  {save.value.message}
                </p>
              )}
              {save.value?.message && !save.value.failed && (
                <p role="status" class="text-body-medium text-on-surface">
                  {save.value.message}
                </p>
              )}
              <div class="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  name="intent"
                  value="save"
                  label="Save"
                  isLoading={save.isRunning}
                />
                <Button
                  type="submit"
                  name="intent"
                  value="reset"
                  look="text"
                  label="Reset to defaults"
                />
              </div>
            </Form>
          </>
        )}
      </div>
    </Layout.Pane>
  );
});

/** The rows a refused save sent (`links.<i>.label` / `.href`), so a refusal keeps them. */
const sentLinks = (data: FormData | undefined) => {
  const rows: { label: string; href: string }[] = [];
  for (let i = 0; i < PROFILE_MAX.links; i++) {
    const label = data?.get(`links.${i}.label`);
    const href = data?.get(`links.${i}.href`);
    if (label === null && href === null) break;
    rows.push({ label: label?.toString() ?? "", href: href?.toString() ?? "" });
  }
  return rows;
};

type LinkRow = { id: number; label: string; href: string };

/**
 * The profile's links (2026-11-24, social icon row): add, remove, move up / down, label. The
 * rows are this form's state; names follow the current order (`links.<i>.*`), so Save stores them
 * in that order. Up to `PROFILE_MAX.links`. The row buttons are library `IconButton`s named with
 * the row's number (and its label, when it has one).
 */
const LinksEditor = component$<{
  initial: { label: string; href: string }[];
  errors: Record<string, string | string[] | undefined>;
}>(({ initial, errors }) => {
  const state = useStore<{ rows: LinkRow[]; next: number }>(() => {
    const rows = initial.map((link, id) => ({ id, ...link }));
    return {
      rows: rows.length ? rows : [{ id: 0, label: "", href: "" }],
      next: Math.max(rows.length, 1),
    };
  });
  const move = $((from: number, to: number) => {
    const rows = [...state.rows];
    const [row] = rows.splice(from, 1);
    rows.splice(to, 0, row);
    state.rows = rows;
  });
  const err = (key: string) => {
    const value = errors[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return (
    <>
      <ol
        class="grid gap-4"
        // `input` bubbles: keep each row's text in the state, so a move keeps what was typed.
        onInput$={(event: Event) => {
          const field = event.target as HTMLInputElement;
          const match = /^links\.(\d+)\.(label|href)$/.exec(field.name);
          if (!match) return;
          const row = state.rows[Number(match[1])];
          if (row) row[match[2] as "label" | "href"] = field.value;
        }}
      >
        {state.rows.map((link, i) => {
          const name = `Link ${i + 1}${link.label.trim() ? ` (${link.label.trim()})` : ""}`;
          return (
            <li
              key={link.id}
              class="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
            >
              <TextField
                name={`links.${i}.label`}
                label={`Link ${i + 1} label`}
                autocomplete="off"
                maxLength={PROFILE_MAX.linkLabel}
                value={link.label}
                error={err(`links.${i}.label`)}
              />
              <TextField
                name={`links.${i}.href`}
                type="url"
                label={`Link ${i + 1} address`}
                // `url` would offer the same address for every row; `type="url"` already
                // gives the URL keyboard.
                autocomplete="off"
                maxLength={PROFILE_MAX.linkHref}
                value={link.href}
                error={err(`links.${i}.href`)}
              />
              <div class="flex gap-1 sm:pt-2">
                <IconButton
                  icon="arrow_upward"
                  label={`Move ${name} up`}
                  disabled={i === 0}
                  onClick$={() => move(i, i - 1)}
                />
                <IconButton
                  icon="arrow_downward"
                  label={`Move ${name} down`}
                  disabled={i === state.rows.length - 1}
                  onClick$={() => move(i, i + 1)}
                />
                <IconButton
                  icon="delete"
                  label={`Remove ${name}`}
                  onClick$={() => {
                    state.rows = state.rows.filter((row) => row.id !== link.id);
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>
      <div>
        <Button
          look="text"
          leadingIcon="add"
          label="Add link"
          disabled={state.rows.length >= PROFILE_MAX.links}
          onClick$={() => {
            state.rows = [
              ...state.rows,
              { id: state.next++, label: "", href: "" },
            ];
          }}
        />
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "Profile · Admin",
  meta: [{ name: "robots", content: "noindex", key: "robots" }],
};
