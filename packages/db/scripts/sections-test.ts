/**
 * Unit test for the profile's SECTIONS (`src/profile/profile-sections.ts`, the `profile.sections`
 * column through `profile.server.ts`) on a REAL local D1 with the real migrations
 * (`src/testing/d1.ts`). Fixture text is neutral filler ("(test)"), never the owner's text.
 * Run from packages/db:
 *   node --test scripts/sections-test.ts
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import {
  formatSectionDates,
  importSectionsJson,
  parseStoredSections,
  toPublicSections,
  type ProfileSectionsDoc,
} from "../src/profile/profile-sections.ts";
import {
  forgetProfile,
  getProfile,
  getProfileForm,
  getSectionsForm,
  resetProfile,
  saveProfile,
  saveSections,
} from "../src/profile/profile.server.ts";
import { createTestD1 } from "../src/testing/d1.ts";

const testD1 = await createTestD1();
after(() => testD1.dispose());
beforeEach(() => forgetProfile());

const doc: ProfileSectionsDoc = {
  v: 1,
  sections: [
    {
      id: "dev",
      title: "Experience (test)",
      kind: "work",
      visibility: "shown",
      entries: [
        {
          id: "dev-1",
          visibility: "shown",
          position: "Developer (test)",
          name: "Org (test)",
          location: "Town (test)",
          startDate: "2018-01",
          endDate: "present",
          highlights: ["Did a thing (test)", "Did another (test)"],
          url: "https://example.com/",
        },
        {
          id: "dev-2",
          visibility: "hidden",
          position: "Secret role (test)",
          startDate: "2010",
          endDate: "2012-06",
        },
      ],
    },
    {
      id: "food",
      title: "Hospitality (test)",
      kind: "work",
      visibility: "collapsed",
      entries: [
        { id: "food-1", visibility: "shown", position: "Server (test)", startDate: "2008-05", endDate: "2010-10" },
      ],
    },
    {
      id: "gone",
      title: "Hidden section (test)",
      kind: "other",
      visibility: "hidden",
      entries: [{ id: "gone-1", visibility: "shown", position: "Never sent (test)" }],
    },
    {
      id: "skills",
      title: "Skills (test)",
      kind: "skills",
      visibility: "shown",
      entries: [{ id: "skills-1", visibility: "shown", position: "Frontend (test)", keywords: ["Qwik", "TypeScript"] }],
    },
  ],
};

test("dates read as a CV prints them", () => {
  assert.equal(formatSectionDates("2018-01", "present"), "Jan 2018 – Present");
  assert.equal(formatSectionDates("2008-05", "2010-10"), "May 2008 – Oct 2010");
  assert.equal(formatSectionDates("2016"), "2016");
  assert.equal(formatSectionDates(undefined, undefined), "");
});

test("no row: no sections, an empty form", async () => {
  const db = await testD1.reset();
  assert.deepEqual((await getProfile(db)).sections!, []);
  const form = await getSectionsForm(db);
  assert.deepEqual(form.doc.sections, []);
  assert.equal(form.updatedAt, null);
  assert.equal(form.broken, false);
});

test("save, then read: hidden sections and entries never leave the server", async () => {
  const db = await testD1.reset();
  assert.deepEqual(await saveSections(db, doc), { ok: true });
  const sections = (await getProfile(db)).sections!;
  assert.deepEqual(
    sections.map((s) => [s.id, s.open, s.entries.map((e) => e.id)]),
    [
      ["dev", true, ["dev-1"]],
      ["food", false, ["food-1"]],
      ["skills", true, ["skills-1"]],
    ],
  );
  const text = JSON.stringify(sections);
  assert.ok(!text.includes("Secret role"));
  assert.ok(!text.includes("Never sent"));
  assert.equal(sections[0].entries[0].where, "Org (test) · Town (test)");
  assert.equal(sections[0].entries[0].dates, "Jan 2018 – Present");
  // The admin sees everything.
  const form = await getSectionsForm(db);
  assert.deepEqual(form.doc, doc);
  assert.ok(form.updatedAt);
});

test("a refused save writes nothing", async () => {
  const db = await testD1.reset();
  await saveSections(db, doc);
  const bad = structuredClone(doc) as unknown as { sections: { entries: Record<string, unknown>[] }[] };
  bad.sections[0].entries[0].url = "javascript:alert(1)";
  bad.sections[0].entries[0].email = "someone@example.com";
  const result = await saveSections(db, bad);
  assert.equal(result.ok, false);
  assert.deepEqual((await getSectionsForm(db)).doc, doc);
});

test("checks: end before start, duplicate ids, http, limits", async () => {
  const db = await testD1.reset();
  const clone = () => structuredClone(doc);
  const a = clone();
  a.sections[0].entries[0].endDate = "2017-12";
  assert.equal((await saveSections(db, a)).ok, false);
  const b = clone();
  b.sections[1].entries[0].id = "dev-1";
  assert.equal((await saveSections(db, b)).ok, false);
  const c = clone();
  c.sections[0].entries[0].url = "http://example.com/";
  assert.equal((await saveSections(db, c)).ok, false);
  const d = clone();
  d.sections[0].entries[0].highlights = Array.from({ length: 7 }, (_, i) => `h${i}`);
  assert.equal((await saveSections(db, d)).ok, false);
  // A year-only start before a month end in the same year is fine.
  const e = clone();
  e.sections[0].entries[0].startDate = "2018";
  e.sections[0].entries[0].endDate = "2018-03";
  assert.deepEqual(await saveSections(db, e), { ok: true });
});

test("a bad stored record is dropped, the rest kept; a broken doc reads as none and is not rewritten", async () => {
  const db = await testD1.reset();
  const stored = structuredClone(doc) as unknown as { sections: { entries: unknown[] }[] };
  stored.sections[0].entries.push({ id: "bad", visibility: "shown" }); // no position
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO profile (id, sections, updated_at) VALUES (1, ?, ?)")
    .bind(JSON.stringify(stored), now)
    .run();
  const parsed = parseStoredSections(JSON.stringify(stored));
  assert.equal(parsed.dropped, 1);
  assert.equal(((await getProfile(db)).sections!)[0].entries.length, 1);
  assert.equal((await getSectionsForm(db)).dropped, 1);

  forgetProfile();
  await db.prepare("UPDATE profile SET sections = ? WHERE id = 1").bind("{not json").run();
  assert.deepEqual((await getProfile(db)).sections!, []);
  const form = await getSectionsForm(db);
  assert.equal(form.broken, true);
  const row = await db.prepare("SELECT sections FROM profile").first<{ sections: string }>();
  assert.equal(row?.sections, "{not json");
});

test("the read is kept for a minute, and a save clears it", async () => {
  const db = await testD1.reset();
  await saveSections(db, doc);
  assert.equal(((await getProfile(db)).sections!).length, 3);
  await db.prepare("UPDATE profile SET sections = NULL").run();
  assert.equal(((await getProfile(db)).sections!).length, 3);
  const one = structuredClone(doc);
  one.sections = one.sections.slice(0, 1);
  await saveSections(db, one);
  assert.equal(((await getProfile(db)).sections!).length, 1);
});

test("JSON Resume import maps sections, never contact details", () => {
  const { doc: imported, ignored } = importSectionsJson({
    basics: { name: "Test", email: "test@example.com", phone: "555" },
    work: [
      { name: "Org (test)", position: "Dev (test)", startDate: "2019-03-01", highlights: ["A"] },
      { name: "Old (test)", position: "Old (test)", startDate: "2010", endDate: "2012-01-31" },
    ],
    education: [{ institution: "School (test)", studyType: "B.S.", area: "Testing" }],
    skills: [{ name: "Web (test)", keywords: ["HTML", "CSS"] }],
    certificates: [{ name: "Cert (test)", issuer: "Board (test)", date: "2020-05-01" }],
  });
  assert.deepEqual(ignored, ["basics"]);
  const out = imported as ProfileSectionsDoc;
  assert.deepEqual(
    out.sections.map((s) => s.id),
    ["experience", "education", "certifications", "skills"],
  );
  assert.equal(out.sections[0].entries[0].endDate, "present");
  assert.equal(out.sections[0].entries[1].endDate, "2012-01");
  assert.equal(out.sections[1].entries[0].position, "B.S., Testing");
  assert.ok(!JSON.stringify(out).includes("test@example.com"));
  // And it passes the write schema as it is.
  assert.equal(toPublicSections(out).length, 4);
});

test("an imported document passes saveSections", async () => {
  const db = await testD1.reset();
  const { doc: imported } = importSectionsJson({
    work: [{ name: "Org (test)", position: "Dev (test)", startDate: "2019-03" }],
  });
  assert.deepEqual(await saveSections(db, imported), { ok: true });
});

test("the profile form and the sections never overwrite each other; a reset keeps the sections", async () => {
  const db = await testD1.reset();
  await saveSections(db, doc);
  await saveProfile(db, {
    name: "Name (test)",
    headline: "",
    location: "",
    bio: "",
    links: [],
  });
  assert.deepEqual((await getSectionsForm(db)).doc, doc);
  const one = structuredClone(doc);
  one.sections = one.sections.slice(0, 1);
  await saveSections(db, one);
  assert.equal((await getProfileForm(db)).name, "Name (test)");
  await resetProfile(db);
  assert.equal((await getProfileForm(db)).name, "");
  assert.deepEqual((await getSectionsForm(db)).doc, one);
  assert.equal((await getProfile(db)).sections!.length, 1);
});
