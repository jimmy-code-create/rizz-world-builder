/**
 * Realm discovery guards.
 *
 * Static checks in the same style as the rest of the suite: the cover column
 * must be additive, the two official realms must be featured from ordinary
 * rows, and discovery must keep both a search and the public/private/owned
 * filters behind the new two-way switch.
 *
 * Run: node tests/realms-discovery.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20261117000000_realm_covers.sql");
const types = read("src/integrations/supabase/types.ts");
const officials = read("src/lib/official-realms.ts");
const page = read("src/routes/_app/realms.tsx");
const picker = read("src/components/realms/RealmCoverPicker.tsx");
const sheet = read("src/components/realms/EditRealmSheet.tsx");
const detail = read("src/routes/_app/r.$slug.tsx");
const cover = read("src/lib/realm-cover.ts");

await check("covers are an additive realm column", () => {
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS cover_url"), "no cover column");
  const row = types.slice(types.indexOf("realms: {"));
  assert.ok(row.includes("cover_url: string | null"), "generated types do not know the cover");
});

await check("both RIZZ-run realms are spotlighted from normal rows", () => {
  assert.ok(officials.includes('name: "Rizz Official"'), "official realm missing");
  assert.ok(officials.includes('name: "Rizz Support"'), "support realm missing");
  assert.ok(
    officials.includes("rizz-official") && officials.includes("rizz-support"),
    "slug match missing",
  );
  assert.ok(page.includes("Spotlight"), "spotlight section removed");
  assert.ok(page.includes("availableCount"), "directory lost its available count");
  assert.ok(page.includes("official.matches(realm)"), "rows are not matched to the official list");
  assert.ok(page.includes("featuredIds.has(realm.id)"), "featured realms can repeat in the list");
  assert.ok(page.includes("RealmSpotlight"), "spotlight component removed");
  assert.ok(page.includes("discoverRows"), "open rooms do not follow the spotlight");
});

await check("discovery is searchable and keeps the four scope filters", () => {
  assert.ok(page.includes('placeholder="Search rooms"'), "no room search");
  assert.ok(page.includes("matchesSearch(entry.realm)"), "spotlight ignores the search");
  assert.ok(page.includes("MY_SCOPES"), "no all/public/private/owned scope filters");
  assert.ok(page.includes('{ key: "all", label: "All" }'), "the All filter is missing");
  assert.ok(page.includes("scopeCounts[key]"), "filters have no counts");
  assert.ok(page.includes('realmScope === "public"'), "scope does not filter the list");
  assert.ok(page.includes('useState<MyScope>("all")'), "scope should start on every room");
  assert.ok(page.includes("setRealmScope(key)"), "scope filters cannot change the selection");
});

await check("the redesigned screen keeps one lead room and a ruled list", () => {
  assert.ok(page.includes('role="tablist"'), "no tab list");
  assert.ok(page.includes("My rooms") && page.includes("Discover"), "tab labels missing");
  assert.ok(!page.includes('layoutId="realms-tab-thumb"'), "the old sliding pill is back");
  assert.ok(page.includes("RealmRow"), "ruled realm rows removed");
  assert.ok(page.includes("myShown[0]"), "no lead room");
  assert.ok(page.includes("myShown.slice(1)"), "the lead room repeats in the list");
  assert.ok(page.includes("JoinButton"), "Join action removed");
  assert.ok(!page.includes("RealmBannerCard"), "the old banner card is back");
  assert.ok(!page.includes("rounded-[24px]"), "the old card radius is back");
});

await check("animated covers are accepted and shown", () => {
  assert.ok(cover.includes("image/gif,image/webp"), "GIF/WebP covers are rejected");
  assert.ok(cover.includes("uploadRealmCover"), "no cover upload path");
  assert.ok(picker.includes("REALM_COVER_ACCEPT"), "picker does not use the shared accept list");
  assert.ok(
    sheet.includes("coverUrl") && sheet.includes("removeCover"),
    "edit sheet cannot save a cover",
  );
  assert.ok(detail.includes("cover_url:"), "realm header does not map the cover");
});

await check("a missing migration does not empty the existing lists", () => {
  assert.ok(
    !page.includes('select("id,slug,name,topic,icon_url,cover_url'),
    "list hard-codes the new column",
  );
  assert.ok(
    page.includes('select("*, owner:profiles!realms_owner_id_fkey(username)")'),
    "list is not select-star",
  );
  assert.ok(
    page.includes('select("realm_id, role, realm:realms!realm_members_realm_id_fkey(*)")'),
    "membership join hard-codes the new column",
  );
});

if (process.exitCode) {
  console.error(`\n${passed} checks passed, failures above.`);
} else {
  console.log(`\n${passed} checks passed.`);
}
