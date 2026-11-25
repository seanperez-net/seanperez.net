/**
 * Unit test for the owner's profile (`src/profile/profile.server.ts`): `getProfile` (per-field
 * defaults, links checked again on read, the isolate memo), `getProfileForm`, `saveProfile`
 * (upsert of the one row) and `resetProfile`, on a REAL local D1 with the real migrations
 * (`src/testing/d1.ts`, in memory). Added 2026-11-25 (backend inventory: "not covered"). Run from
 * packages/db:
 *   node --test scripts/profile-test.ts
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import {
  PROFILE_DEFAULTS,
  forgetProfile,
  getProfile,
  getProfileForm,
  resetProfile,
  saveProfile,
  type ProfileInput,
} from "../src/profile/profile.server.ts";
import { createTestD1 } from "../src/testing/d1.ts";

const testD1 = await createTestD1();
after(() => testD1.dispose());
// The module keeps the last read in memory for a minute: every test starts without it.
beforeEach(() => forgetProfile());

const input: ProfileInput = {
  name: "  Test Name  ",
  headline: "Builder",
  location: "Somewhere, Earth",
  bio: "Line one\nLine two",
  links: [
    { label: "GitHub", href: "https://github.com/example" },
    { label: "Site", href: "https://example.com/" },
  ],
};

test("no row: the defaults, and an empty form", async () => {
  const db = await testD1.reset();
  assert.deepEqual(await getProfile(db), PROFILE_DEFAULTS);
  const form = await getProfileForm(db);
  assert.equal(form.name, "");
  assert.equal(form.updatedAt, null);
  assert.equal(form.linksDefault, true);
  assert.equal(form.defaultName, PROFILE_DEFAULTS.name);
  assert.deepEqual(
    form.links,
    PROFILE_DEFAULTS.links.map(({ label, href }) => ({ label, href })),
  );
});

test("saveProfile stores one row; getProfile and the form read it back", async () => {
  const db = await testD1.reset();
  await saveProfile(db, input);
  const rows = await db
    .prepare("SELECT id FROM profile")
    .all<{ id: number }>();
  assert.deepEqual(
    rows.results.map((r) => r.id),
    [1],
  );

  const profile = await getProfile(db);
  assert.equal(profile.name, "Test Name");
  assert.equal(profile.headline, "Builder");
  assert.equal(profile.location, "Somewhere, Earth");
  assert.equal(profile.bio, "Line one\nLine two");
  assert.deepEqual(profile.links, [
    {
      label: "GitHub",
      href: "https://github.com/example",
      detail: "github.com/example",
      brand: "github",
      me: true,
    },
    { label: "Site", href: "https://example.com/", detail: "example.com" },
  ]);

  const form = await getProfileForm(db);
  assert.equal(form.name, "Test Name");
  assert.equal(form.linksDefault, false);
  assert.ok(form.updatedAt);
  assert.deepEqual(form.links, input.links);
});

test("a second save updates the same row (upsert)", async () => {
  const db = await testD1.reset();
  await saveProfile(db, input);
  await saveProfile(db, { ...input, headline: "Changed", links: [] });
  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM profile")
    .first<{ n: number }>();
  assert.equal(count?.n, 1);
  const profile = await getProfile(db);
  assert.equal(profile.headline, "Changed");
  // A saved empty list means "no links", not the defaults.
  assert.deepEqual(profile.links, []);
  assert.equal((await getProfileForm(db)).linksDefault, false);
});

test("empty fields fall back to their defaults, per field", async () => {
  const db = await testD1.reset();
  await saveProfile(db, {
    name: "   ",
    headline: "",
    location: "Here",
    bio: "",
    links: [],
  });
  const profile = await getProfile(db);
  assert.equal(profile.name, PROFILE_DEFAULTS.name);
  assert.equal(profile.bio, PROFILE_DEFAULTS.bio);
  assert.equal(profile.location, "Here");
  const form = await getProfileForm(db);
  // The form shows what is stored (nothing), not the default.
  assert.equal(form.name, "");
  assert.equal(form.bio, "");
});

test("stored links are checked again on read: unsafe or unlabelled ones are dropped", async () => {
  const db = await testD1.reset();
  await db
    .prepare(
      "INSERT INTO profile (id, links, updated_at) VALUES (1, ?, '2026-11-25T00:00:00.000Z')",
    )
    .bind(
      JSON.stringify([
        { label: "Good", href: "https://example.com/a" },
        { label: "Plain http", href: "http://example.com/" },
        { label: "Script", href: "javascript:alert(1)" },
        { label: "Mail", href: "mailto:someone@example.com" },
        { label: "", href: "https://example.com/no-label" },
        { label: "Creds", href: "https://user:pw@example.com/" },
      ]),
    )
    .run();
  assert.deepEqual(
    (await getProfile(db)).links.map((l) => l.href),
    ["https://example.com/a"],
  );

  // Not JSON: the defaults.
  forgetProfile();
  await db.prepare("UPDATE profile SET links = 'not json' WHERE id = 1").run();
  assert.deepEqual((await getProfile(db)).links, PROFILE_DEFAULTS.links);
});

test("getProfile is kept for a minute; a save clears it", async () => {
  const db = await testD1.reset();
  await saveProfile(db, input);
  assert.equal((await getProfile(db)).headline, "Builder");
  // Changed behind the module's back: the memo still answers.
  await db.prepare("UPDATE profile SET headline = 'Sneaky' WHERE id = 1").run();
  assert.equal((await getProfile(db)).headline, "Builder");
  // A save drops the memo.
  await saveProfile(db, { ...input, headline: "Fresh" });
  assert.equal((await getProfile(db)).headline, "Fresh");
});

test("resetProfile removes the row: the defaults again", async () => {
  const db = await testD1.reset();
  await saveProfile(db, input);
  assert.equal((await getProfile(db)).name, "Test Name");
  await resetProfile(db);
  assert.deepEqual(await getProfile(db), PROFILE_DEFAULTS);
  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM profile")
    .first<{ n: number }>();
  assert.equal(count?.n, 0);
  assert.equal((await getProfileForm(db)).updatedAt, null);
});

test("getProfile shows the defaults when the table is missing; the form throws", async () => {
  const bare = await createTestD1({ migrate: false });
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await getProfile(bare.db), PROFILE_DEFAULTS);
    await assert.rejects(getProfileForm(bare.db));
  } finally {
    console.error = original;
    await bare.dispose();
  }
});
