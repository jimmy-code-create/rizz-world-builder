/**
 * Puppy Love — the only profile effect.
 *
 * These checks guard the things that break silently:
 *   - another effect (or the retired Web Slinger) creeping back in,
 *   - a background sneaking into the "transparent" scene,
 *   - the profile mounting the effect under the banner gradient, or without
 *     the pointer-events/aria safeguards,
 *   - the motion fallbacks disappearing,
 *   - the migration deleting the row owners are still using.
 *
 * Run: bun tests/puppy-love-effect.test.mjs
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [catalog, effect, css, layer, route, styles, avatarDeco, nameplate, effectsPage, tour] =
  await Promise.all([
    read("src/lib/effects.ts"),
    read("src/components/profile/PuppyLoveEffect.tsx"),
    read("src/components/profile/puppy-love.css"),
    read("src/components/profile/ProfileEffect.tsx"),
    read("src/routes/_app/u.$username.tsx"),
    read("src/styles.css"),
    read("src/components/profile/AvatarDecoration.tsx"),
    read("src/components/profile/Nameplate.tsx"),
    read("src/routes/_app/effects.tsx"),
    read("src/components/onboarding/WelcomeTourOverlay.tsx"),
  ]);

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

await check("the catalogue contains exactly one effect: Puppy Love", async () => {
  assert.match(catalog, /const PUPPY_LOVE_SLUG = "fx-puppy-love"/);
  assert.match(catalog, /export const PROFILE_EFFECTS: ProfileEffect\[\] = \[PUPPY_LOVE_EFFECT\];/);
  assert.match(catalog, /export const COSMETICS_ENABLED = true;/);
  assert.match(catalog, /name: "Puppy Love"/);
  assert.match(catalog, /preview_color: "#c9ff3d"/);
  assert.ok(!catalog.includes("web-slinger"), "the Web Slinger must stay retired");
  assert.ok(!catalog.includes("#e8253f"), "its red preview colour must be gone");
});

await check("the retired effect is gone from the app and its docs", async () => {
  for (const path of [
    "src/components/profile/WebSlingerEffect.tsx",
    "docs/web-slinger-effect.md",
    "tests/web-slinger-effect.test.mjs",
  ]) {
    assert.ok(!existsSync(new URL(`../${path}`, import.meta.url)), `${path} still exists`);
  }
  assert.ok(!layer.includes("WebSlinger"), "the renderer still imports the retired scene");
  assert.ok(!styles.includes(".wsx"), "the retired scene CSS is still in the global stylesheet");
  assert.ok(!effectsPage.includes("Web Slinger"), "the effects page still names the spider");
});

await check("the renderer only draws Puppy Love", async () => {
  assert.match(layer, /slug !== PUPPY_LOVE_SLUG/, "unknown slugs must render nothing");
  assert.match(layer, /<PuppyLoveEffect \/>/, "the layer must mount the scene");
  assert.ok(!layer.includes("CosmicNebula"), "a removed overlay survived in the renderer");
  assert.ok(!layer.includes("KawaiiHearts"), "a removed overlay survived in the renderer");
});

await check("the scene is genuinely transparent and vector-only", async () => {
  assert.ok(!/<image\b/.test(effect), "the scene must not use a raster image");
  assert.ok(!/data:image\//.test(effect), "no embedded bitmaps");
  assert.ok(!/lottie/i.test(effect), "the scene must not load a Lottie player");
  assert.ok(
    !/<rect[^>]*(width="(640|100%|1100)"|height="(360|100%)")/.test(effect),
    "there must be no full-canvas rect behind the character",
  );
  assert.ok(!/#0a0a0b|#0e0e10|#05060b|#111214/i.test(effect), "no stage background colours");
  assert.match(effect, /viewBox="0 0 1100 360"/);
  assert.match(effect, /preserveAspectRatio="xMidYMid slice"/);
});

await check("Biscuit is an original, complete dog — not a recoloured hero", async () => {
  for (const part of [
    "plx-ear plx-ear--left",
    "plx-ear plx-ear--right",
    "plx-head",
    "plx-tail",
    "plx-paw",
    "plx-tongue",
    "plx-shades",
    "plx-heart",
    "plx-spark",
  ]) {
    assert.ok(effect.includes(part), `missing character part: ${part}`);
  }
  // The brand reads as a lime-hooded pup with heart shades and a heart nose.
  assert.match(effect, /id="plx-hood"/);
  assert.match(effect, /id="plx-shade"/);
  assert.match(effect, /heartPath\(740, 216, 0\.92\)/, "the nose is a heart");
  assert.match(effect, /heartPath\(676, 184, 2\.15\)/);
  assert.match(effect, /heartPath\(804, 184, 2\.15\)/);
  assert.ok(!/mask|lens|boot|crouch|web/i.test(effect), "spider parts must not survive in the new scene");
});

await check("the profile mounts the effect above the banner gradient, pointer-free", async () => {
  const gradient = route.indexOf("bg-gradient-to-t from-background");
  const visual = route.indexOf("<ProfileEffectVisual");
  assert.ok(gradient > -1, "the banner gradient must still exist");
  assert.ok(visual > -1, "the profile must mount the effect");
  assert.ok(visual > gradient, "the effect must render after the gradient so it is not dimmed");
  assert.match(route, /<ProfileEffectVisual slug=\{shownEffect\.slug\} \/>/);
  assert.match(css, /\.plx \{[\s\S]*?pointer-events: none;[\s\S]*?\}/, "the scene must never capture pointers");
  assert.match(effect, /aria-hidden="true"/);
});

await check("motion pauses off screen and degrades to a still", async () => {
  assert.match(effect, /IntersectionObserver/);
  assert.match(effect, /prefers-reduced-motion: reduce/);
  assert.match(effect, /prefersStillFrame/);
  assert.match(effect, /data-calm=/);
  assert.match(effect, /data-visible=/);
  for (const keyframes of ["plx-bob", "plx-flop-left", "plx-wag", "plx-wave", "plx-heart", "plx-spark"]) {
    assert.match(css, new RegExp(`@keyframes ${keyframes}`), `missing ${keyframes}`);
  }
  assert.match(css, /\.plx\[data-visible="false"\] \* \{[\s\S]*?animation-play-state: paused/);
  assert.match(css, /\.plx\[data-calm="true"\]/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.plx \* \{ animation: none !important; \}/);
});

await check("the removed decoration and nameplate surfaces are plain", async () => {
  for (const source of [avatarDeco, nameplate]) {
    assert.ok(!source.includes("COSMETICS_ENABLED"), "a removed surface still consults the cosmetics flag");
    for (const retired of ["fx-ring", "deco-", "np-", "discord-", "WebSlingerEffect"]) {
      assert.ok(!source.includes(retired), `removed effect markup survived: ${retired}`);
    }
  }
});

await check("the single effect can be equipped from the effects page", async () => {
  assert.match(effectsPage, /<PuppyLoveEffect \/>/, "the page must show the real scene");
  assert.match(effectsPage, /equipEffect\(user\.id, PUPPY_LOVE_EFFECT\.slug, "profile_effect"\)/);
  assert.match(effectsPage, /Remove from profile/);
  assert.match(effectsPage, /queryKey: \["equipped", user\?\.id\]/);
});

await check("the migration renames the owned row and retires everything else", async () => {
  const migration = await read("supabase/migrations/20261030000000_puppy_love_effect.sql");
  assert.match(migration, /SET slug = 'fx-puppy-love'/, "owners keep their effect row");
  assert.match(migration, /WHERE slug = 'fx-web-slinger'/, "the old slug is the rename source");
  assert.match(migration, /'Puppy Love'/);
  assert.match(migration, /'#c9ff3d'/);
  assert.match(migration, /rights_review/);
  assert.match(migration, /DELETE FROM public\.profile_effects\s+WHERE slug <> 'fx-puppy-love';/);
  assert.match(migration, /ON CONFLICT \(slug\) DO UPDATE/);
});

await check("the welcome tour still talks about the live cosmetics", async () => {
  assert.ok(tour.includes("Puppy Love"));
  assert.ok(tour.includes("Biscuit"));
  assert.ok(!tour.includes("Web Slinger"));
  assert.ok(!tour.includes("avatar decorations"), "removed decoration shelf must not be advertised");
});

await check("an equipped effect follows the member onto every profile surface", async () => {
  const surfaces = await Promise.all([
    read("src/routes/_app/u.$username.tsx"),
    read("src/components/account/AccountMenu.tsx"),
    read("src/components/profile/ProfileCard.tsx"),
    read("src/components/ProfilePreview.tsx"),
  ]);
  for (const source of surfaces) {
    assert.match(source, /useEquipped\(/);
    assert.match(source, /<ProfileEffectVisual slug=\{/, "a profile surface forgot the effect layer");
  }
});

console.log(`\n${passed} checks passed.`);
