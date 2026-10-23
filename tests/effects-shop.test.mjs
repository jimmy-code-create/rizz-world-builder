/**
 * Effects shop.
 *
 * The shop has two shelves (avatar decorations and profile effects) and a thin
 * contract between the database catalogue and the drawings in code: a slug with
 * no art must never render. These guards keep that contract, keep the art
 * transparent (no plates behind the avatar), and keep the buy/equip path on the
 * server RPCs instead of direct table writes.
 *
 * Run: node tests/effects-shop.test.mjs
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

const migration = read("supabase/migrations/20261104000000_effects_shop_v3.sql");
const registry = read("src/components/effects/registry.tsx");
const chubby = read("src/components/effects/ChubbyDecoration.tsx");
const web = read("src/components/effects/WebProfileEffect.tsx");
const css = read("src/components/effects/effects.css");
const shop = read("src/routes/_app/shop.tsx");
const effectsLib = read("src/lib/effects.ts");
const profilePage = read("src/routes/_app/u.$username.tsx");
const preview = read("src/components/ProfilePreview.tsx");
const header = read("src/components/profile/ProfileHeader.tsx");

const slugsIn = (text, pattern) => [...new Set([...text.matchAll(pattern)].map((m) => m[1]))].sort();

await check("the catalogue ships both shelves", async () => {
  assert.match(migration, /'avatar_decoration'/);
  assert.match(migration, /'profile_effect'/);
  const avatarSlugs = slugsIn(migration, /'(fx-chubby-[a-z]+)'/g);
  const profileSlugs = slugsIn(migration, /'(fx-web-[a-z-]+)'/g);
  assert.ok(avatarSlugs.length >= 2, "at least two avatar decorations");
  assert.ok(profileSlugs.length >= 1, "at least one profile effect");
});

await check("every seeded slug has art, and every drawn slug is seeded", async () => {
  const seeded = slugsIn(migration, /'(fx-[a-z-]+)'/g);
  const drawn = slugsIn(registry, /"(fx-[a-z-]+)":/g);
  assert.deepEqual(drawn, seeded);
});

await check("the art is transparent: no plate behind the avatar or the banner", async () => {
  assert.ok(!chubby.includes("<rect"), "the avatar frame must not paint a background box");
  assert.ok(!web.includes("<rect"), "the profile scene must not paint a background box");
  assert.ok(
    chubby.includes("-inset-[20%]"),
    "the frame overhangs the avatar instead of sitting inside it",
  );
  assert.ok(
    chubby.includes('viewBox="0 0 140 140"'),
    "the viewBox reserves space for the overhang without clipping",
  );
});

await check("the scene sits over the banner but under the identity row", async () => {
  const effectAt = header.indexOf("profileEffect && (");
  const identityAt = header.indexOf('className="relative z-30" style={{ paddingInline');
  assert.ok(effectAt > 0, "ProfileHeader renders the effect");
  assert.ok(identityAt > effectAt, "the effect paints before the name/avatar block");
  assert.ok(
    header.includes('height: "calc(100cqw / 3)"'),
    "the scene is anchored to the 3:1 banner box, not the whole header",
  );
  assert.ok(header.includes('className="overflow-visible"'));
});

await check("buying, wearing and removing go through the server RPCs", async () => {
  assert.match(effectsLib, /rpc\("purchase_profile_effect"/);
  assert.match(effectsLib, /rpc\("equip_profile_effect"/);
  assert.match(effectsLib, /rpc\("unequip_profile_effect"/);
  assert.ok(
    !/from\("user_profile_effects"\)\s*\.\s*(insert|update|upsert|delete)/.test(effectsLib),
    "the client never writes ownership directly",
  );
  assert.match(
    migration,
    /rights_review[\s\S]*?false/,
    "nothing in the new catalogue is held for rights review",
  );
});

await check("the shop sells both categories from live cards", async () => {
  assert.ok(shop.includes("EFFECT_CATEGORIES.map"), "both shelves render");
  assert.ok(shop.includes("hasEffectArt(effect.slug)"), "art-less rows are skipped");
  assert.ok(shop.includes("AvatarDecorationArt") && shop.includes("ProfileEffectArt"));
  assert.ok(shop.includes("purchaseEffect") && shop.includes("equipEffect"));
  assert.ok(!shop.includes("EffectsShopTile"), "no dead tile helper left behind");
});

await check("the preview wears the effect on a real profile header", async () => {
  assert.ok(shop.includes("<ProfileHeader"), "the preview reuses the profile header");
  assert.ok(shop.includes("avatarDecoration={isAvatar ? effect.slug : wornAvatarSlug}"));
  assert.ok(shop.includes("profileEffect={isAvatar ? wornProfileSlug : effect.slug}"));
  assert.ok(shop.includes("Dialog"), "the preview opens as a dialog");
});

await check("worn cosmetics show to everyone opening a profile", async () => {
  assert.ok(profilePage.includes("useWornEffects(profile?.id)"));
  assert.ok(profilePage.includes("avatarDecoration={wornEffects.data?.avatar_decoration?.slug"));
  assert.ok(profilePage.includes("profileEffect={wornEffects.data?.profile_effect?.slug"));
  assert.ok(preview.includes("useWornEffects(p?.id)"));
  assert.ok(preview.includes("avatarDecoration={wornEffects.data?.avatar_decoration?.slug"));
});

await check("the loops stop for reduced motion", async () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.fx-static,\s*\.fx-static \*\s*\{\s*animation: none !important;/);
  assert.match(header, /animated=\{!user\.reducedMotion\}/);
});

console.log(`\n${passed} checks passed.`);
