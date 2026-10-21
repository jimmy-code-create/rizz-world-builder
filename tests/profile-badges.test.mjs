/**
 * Profile badge equip flow.
 *
 * The storage seam behind "equip badges on your profile" spans four files:
 * profiles.badges (migration), showcaseBadges (what may render), the section
 * component (control + write), and the profile route (wiring). Each link can
 * break silently — a column nobody writes, a control nobody renders — so the
 * loop is asserted here the same way the sprite tests assert the artwork.
 *
 * Run: bun tests/profile-badges.test.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MAX_SHOWCASE_BADGES, showcaseBadges } from "../src/lib/badge-set.ts";

const route = await readFile(new URL("../src/routes/_app/u.$username.tsx", import.meta.url), "utf8");
const section = await readFile(
  new URL("../src/components/profile/ProfileBadgesSection.tsx", import.meta.url),
  "utf8",
);
const featured = await readFile(new URL("../src/lib/featured-badge.ts", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../supabase/migrations/20261020010000_profile_card.sql", import.meta.url),
  "utf8",
);

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const earned = [
  { slug: "rookie" },
  { slug: "og" },
  { slug: "rising-star" },
  { slug: "streak-7" },
  { slug: "meme-lord" },
];

await check("equipping keeps order, drops duplicates and anything unearned", async () => {
  assert.deepEqual(
    showcaseBadges(["og", "rookie", "og", "not-a-real-badge"], earned),
    ["og", "rookie"],
  );
});

await check(`the showcase is capped at ${MAX_SHOWCASE_BADGES} badges`, async () => {
  const stored = earned.map((b) => b.slug);
  const shown = showcaseBadges(stored, earned);
  assert.equal(shown.length, MAX_SHOWCASE_BADGES);
  assert.deepEqual(shown, stored.slice(0, MAX_SHOWCASE_BADGES));
});

await check("a profile row without the column reads as an empty showcase", async () => {
  assert.deepEqual(showcaseBadges(undefined, earned), []);
  assert.deepEqual(showcaseBadges(null, earned), []);
});

await check("the column that stores the showcase exists in the migration", async () => {
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS badges text\[\] NOT NULL DEFAULT '\{\}'/,
    "profile_card migration must introduce profiles.badges",
  );
});

await check("the profile route renders the section with the stored column", async () => {
  assert.ok(route.includes("<ProfileBadgesSection"), "route must mount the section");
  assert.ok(
    route.includes("stored={profile.badges}"),
    "route must pass the stored profiles.badges slugs",
  );
  assert.ok(route.includes("earned={badges.data ?? []}"), "route must pass the earned badges");
  assert.ok(
    !route.includes("<BadgeRow badges={badges.data}"),
    "the bare badge row must be replaced by the section",
  );
});

await check("the section offers the equip control and writes it back", async () => {
  assert.ok(section.includes("Equip badges"), "owner control must offer equipping");
  assert.ok(/aria-label=\{on \? `Unequip /.test(section), "tiles must toggle with equip labels");
  assert.ok(section.includes("saveShowcaseBadges"), "toggling must persist through the helper");
  assert.ok(section.includes("showcaseBadges(stored, earned)"), "display must filter through the sanitizer");
  assert.ok(section.includes("BadgeRow badges={earned}"), "unequipped profiles keep the earned fallback row");
});

await check("persistence writes profiles.badges under the same cap, with a readable failure", async () => {
  assert.match(featured, /update\(\{\s*badges\s*\}\)/, "helper must update the badges column");
  assert.ok(featured.includes("MAX_SHOWCASE_BADGES"), "helper must enforce the cap on write");
  assert.ok(
    featured.includes("Badge showcase needs the latest database migration"),
    "a missing column must surface a readable message, not a PostgREST error",
  );
  assert.ok(featured.includes("didn't accept the update"), "a silent RLS no-op must not report success");
});

console.log(`\n${passed} checks passed.`);
