/**
 * Effects shop.
 *
 * The shop has two shelves (avatar decorations and profile effects) and a thin
 * contract between the database catalogue and the drawings in code: a slug with
 * no art must never render. These guards keep that contract, keep the bitmap
 * pieces transparent, keep the clip screened instead of plated, and keep the
 * buy/equip path on the server RPCs instead of direct table writes.
 *
 * Run: node tests/effects-shop.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

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
const file = (path) => new URL(`../${path}`, import.meta.url);

const baseMigration = read("supabase/migrations/20261104000000_effects_shop_v3.sql");
const mediaMigration = read("supabase/migrations/20261105000000_effects_shop_media.sql");
const catalogueSql = `${baseMigration}\n${mediaMigration}`;
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
  assert.match(catalogueSql, /'avatar_decoration'/);
  assert.match(catalogueSql, /'profile_effect'/);
  const avatarSlugs = slugsIn(catalogueSql, /'(fx-chubby-[a-z]+|fx-ivory-[a-z]+)'/g);
  const profileSlugs = slugsIn(catalogueSql, /'(fx-web-[a-z-]+|fx-petal-[a-z]+)'/g);
  assert.ok(avatarSlugs.length >= 3, "at least three avatar decorations");
  assert.ok(profileSlugs.length >= 2, "at least two profile effects");
});

await check("every seeded slug has art, and every drawn slug is seeded", async () => {
  const seeded = slugsIn(catalogueSql, /'(fx-[a-z-]+)'/g);
  const drawn = slugsIn(registry, /"(fx-[a-z-]+)":/g);
  assert.deepEqual(drawn, seeded);
});

await check("the drawn frame is a transparent cutout, not a plate", async () => {
  assert.ok(!chubby.includes("<rect"), "the vector frame must not paint a box");
  assert.ok(!web.includes("<rect"), "the silk scene must not paint a box");

  const png = readFileSync(file("public/effects/fx-ivory-filigree.png"));
  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.equal(png[25], 6, "PNG colour type 6 = RGBA (real alpha, no white plate)");
  assert.ok(png.length > 60_000, "the frame carries enough resolution to scale");
});

await check("the profile clip is screened, low-opacity and muted", async () => {
  assert.match(registry, /kind: "profile-video"/);
  assert.match(registry, /mixBlendMode: "screen"/);
  assert.match(registry, /art\.opacity \* 0\.72/);
  for (const attr of ["autoPlay", "muted", "loop", "playsInline", "poster=", "disablePictureInPicture"]) {
    assert.ok(registry.includes(attr), `the video must keep ${attr}`);
  }
  assert.ok(
    registry.includes("if (!animated)") && registry.includes("art.poster"),
    "reduced motion and shop cards fall back to the poster",
  );

  const mp4 = statSync(file("public/effects/fx-petal-bloom.mp4")).size;
  assert.ok(mp4 > 200_000 && mp4 < 2_000_000, `clip is ${mp4} bytes — must stay light`);
  assert.ok(statSync(file("public/effects/fx-petal-bloom-poster.jpg")).size > 10_000);
});

await check("both premium pieces cost 2,099 Paws or $1.99", async () => {
  assert.match(mediaMigration, /'fx-petal-bloom'[\s\S]*?2099, 2099, 199/);
  assert.match(mediaMigration, /'fx-ivory-filigree'[\s\S]*?2099, 2099, 199/);
  assert.ok(effectsLib.includes("price_cents"));
  assert.ok(effectsLib.includes("formatCardPrice"));
  assert.ok(shop.includes("formatCardPrice(effect.price_cents)"), "the card shows the money price");
  assert.ok(shop.includes("formatCardPrice(staged.price_cents)"), "the sheet shows the money price");
});

await check("the scene sits over the banner but under the identity row", async () => {
  const effectAt = header.indexOf("profileEffect && !isPageProfileEffect(profileEffect)");
  const identityAt = header.indexOf('className="relative z-30" style={{ paddingInline');
  assert.ok(effectAt > 0, "ProfileHeader renders inline effects");
  assert.ok(identityAt > effectAt, "the effect paints before the name/avatar block");
  assert.ok(
    header.includes('height: "calc(100cqw / 3)"'),
    "the scene is anchored to the 3:1 banner box, not the whole header",
  );
});

await check("full-profile effects wash over the whole column", async () => {
  assert.ok(profilePage.includes("isPageProfileEffect(wornProfileEffect)"));
  assert.match(profilePage, /<ProfileEffectArt[\s\S]{0,140}intensity="page"/);
  assert.ok(
    profilePage.includes("pointer-events-none absolute inset-0 z-30"),
    "the wash ignores taps and covers the column",
  );
  assert.ok(shop.includes("isPageProfileEffect(effect.slug)"), "the shop preview shows the wash too");
});

await check("buying, wearing and removing go through the server RPCs", async () => {
  assert.match(effectsLib, /rpc\("purchase_profile_effect"/);
  assert.match(effectsLib, /rpc\("equip_profile_effect"/);
  assert.match(effectsLib, /rpc\("unequip_profile_effect"/);
  assert.ok(
    !/from\("user_profile_effects"\)\s*\.\s*(insert|update|upsert|delete)/.test(effectsLib),
    "the client never writes ownership directly",
  );
  assert.match(catalogueSql, /rights_review[\s\S]*?false/);
});

await check("the shop sells both categories from live cards", async () => {
  assert.ok(shop.includes("EFFECT_CATEGORIES.map"), "both shelves render");
  assert.ok(shop.includes("hasEffectArt(effect.slug)"), "art-less rows are skipped");
  assert.ok(shop.includes("AvatarDecorationArt") && shop.includes("ProfileEffectArt"));
  assert.ok(shop.includes("purchaseEffect") && shop.includes("equipEffect"));
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
  assert.ok(preview.includes("useWornEffects(p?.id)"));
});

await check("the ivory frame stays behind the photo and never covers it", async () => {
  assert.ok(
    header.includes('artKind(avatarDecoration) === "avatar-image" ? "z-0" : "z-[2]"'),
    "a cut-out frame is drawn behind the avatar, so the photo masks its inner edge",
  );
  assert.ok(
    shop.includes('className="relative z-[1] h-full w-full rounded-full object-cover"'),
    "the shop thumbnail layers the photo over the frame too",
  );
  // Tailwind v4 centres with the `translate` property; the breathing loop may
  // only scale, or the two would stack and push the frame off the avatar.
  assert.ok(
    !/transform: translate\(-50%/.test(css),
    "the loop must not repeat the centring translate",
  );
});

await check("the clip plays before it has fully downloaded", async () => {
  const buf = readFileSync(file("public/effects/fx-petal-bloom.mp4"));
  const moov = buf.indexOf("moov");
  const mdat = buf.indexOf("mdat");
  assert.ok(moov > 0 && mdat > moov, "moov must precede mdat (faststart)");
  assert.ok(!buf.includes("soun"), "the loop carries no audio track");
});

await check("the loops stop for reduced motion", async () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.fx-static,\s*\.fx-static \*\s*\{\s*animation: none !important;/);
  assert.match(header, /animated=\{!user\.reducedMotion\}/);
});

console.log(`\n${passed} checks passed.`);
