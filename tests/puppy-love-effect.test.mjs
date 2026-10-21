/**
 * Puppy Love, plus the two newer slots.
 *
 * These checks guard the things that break silently:
 *   - the retired Web Slinger creeping back in,
 *   - a background sneaking into a "transparent" cosmetic,
 *   - the profile mounting effects under the banner gradient, or without the
 *     pointer-events/aria safeguards,
 *   - the motion fallbacks disappearing,
 *   - the migration deleting the row owners are still using.
 *
 * Run: bun tests/puppy-love-effect.test.mjs
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  catalog,
  effect,
  css,
  layer,
  route,
  styles,
  avatarDeco,
  bloodweb,
  bloodwebCss,
  darkMoon,
  darkMoonCss,
  effectsPage,
  tour,
] = await Promise.all([
  read("src/lib/effects.ts"),
  read("src/components/profile/PuppyLoveEffect.tsx"),
  read("src/components/profile/puppy-love.css"),
  read("src/components/profile/ProfileEffect.tsx"),
  read("src/routes/_app/u.$username.tsx"),
  read("src/styles.css"),
  read("src/components/profile/AvatarDecoration.tsx"),
  read("src/components/profile/BloodwebDecoration.tsx"),
  read("src/components/profile/bloodweb.css"),
  read("src/components/profile/DarkMoonFrame.tsx"),
  read("src/components/profile/dark-moon.css"),
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

await check("the catalogue still ships Puppy Love in the banner slot", async () => {
  assert.match(catalog, /const PUPPY_LOVE_SLUG = "fx-puppy-love"/);
  assert.match(catalog, /name: "Puppy Love"/);
  assert.match(catalog, /preview_color: "#c9ff3d"/);
  assert.match(catalog, /type: "profile_effect"/);
  assert.match(catalog, /export const COSMETICS_ENABLED = true;/);
  assert.ok(catalog.includes("BLOODWEB_EFFECT"), "the avatar slot must ship");
  assert.ok(catalog.includes("DARK_MOON_EFFECT"), "the frame slot must ship");
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
  assert.match(layer, /<PuppyLoveEffect className=\{className\} \/>/, "the layer must mount the scene");
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
  assert.match(effect, /preserveAspectRatio="xMidYMin slice"/);
  assert.ok(effect.includes("DOG_WIDE"), "wide banners use the bust composition");
  assert.ok(effect.includes("ResizeObserver"), "the pup composition follows the banner shape");
  assert.ok(effect.includes("DOG_COMPACT"), "short previews need their own crop");
});

await check("each scene namespaces its SVG paint servers", async () => {
  // Two Puppy Love instances (a feed card plus the opened preview) must not
  // share gradient/filter ids, or the browser paints from the wrong SVG.
  assert.match(effect, /useId\(\)/, "the scene must scope its defs per instance");
  assert.match(effect, /const fx = \(name: string\) => `plx-\$\{name\}-\$\{uid\}`/);
  assert.ok(!/id="plx-/.test(effect), "a static paint-server id survived");
  assert.ok(!/url\(#plx-/.test(effect), "a static paint-server reference survived");
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
  assert.match(effect, /id=\{fx\("hood"\)\}/);
  assert.match(effect, /id=\{fx\("shade"\)\}/);
  assert.match(effect, /heartPath\(740, 216, 0\.92\)/, "the nose is a heart");
  assert.match(effect, /heartPath\(676, 184, 2\.15\)/);
  assert.match(effect, /heartPath\(804, 184, 2\.15\)/);
  assert.ok(!/mask|lens|boot|crouch|web/i.test(effect), "spider parts must not survive in the new scene");
});

await check("the profile mounts the effect above the banner gradient, pointer-free", async () => {
  const header = await read("src/components/profile/ProfileHeader.tsx");
  assert.match(route, /<ProfileHeader/, "the profile must use the shared header");
  assert.match(header, /getBanner\(user\)/, "the banner source comes from the shared helper");
  const banner = header.indexOf("background: banner.background");
  const visual = header.indexOf("<ProfileEffect slug=");
  assert.ok(banner > -1, "the banner must still paint");
  assert.ok(visual > banner, "the effect must render after the banner so it is not dimmed");
  assert.match(header, /className="pointer-events-none absolute inset-0 z-\[22\] overflow-hidden"/);
  assert.match(header, /aria-hidden/);
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

await check("Bloodweb is transparent vector art, not a masked ring", async () => {
  assert.match(bloodweb, /BLOODWEB_SLUG/);
  assert.match(bloodweb, /pointer-events-none/);
  assert.match(bloodweb, /aria-hidden="true"/);
  assert.ok(!/<image\b/.test(bloodweb), "no raster decoration");
  assert.ok(!/<rect[^>]*(width="120"|width="100%")/.test(bloodweb), "no disc behind the avatar");
  assert.match(bloodwebCss, /@keyframes pl-bw-pulse/);
  assert.match(bloodwebCss, /prefers-reduced-motion: reduce/);
  assert.match(avatarDeco, /BloodwebDecoration/);
  assert.match(avatarDeco, /decorationSlug/);
});

await check("Dark Moon is a transparent frame with its own slot", async () => {
  assert.match(darkMoon, /DARK_MOON_SLUG/);
  assert.match(darkMoon, /pointer-events-none/);
  assert.match(darkMoon, /aria-hidden="true"/);
  assert.ok(!/<image\b/.test(darkMoon), "no raster frame");
  for (const part of ["dmf-ravens", "dmf-eye", "dmf-rays"]) {
    assert.ok(darkMoon.includes(part), `missing frame part: ${part}`);
  }
  assert.match(darkMoonCss, /@keyframes dmf-bob/);
  assert.match(darkMoonCss, /prefers-reduced-motion: reduce/);
  assert.match(catalog, /type: "profile_frame"/);
});

await check("the gallery previews all three slots and goes through the RPCs", async () => {
  assert.match(effectsPage, /PROFILE_EFFECTS\.map/);
  assert.match(effectsPage, /<PuppyLoveEffect \/>/);
  assert.match(effectsPage, /<BloodwebDecoration /);
  assert.match(effectsPage, /<DarkMoonFrame /);
  assert.match(effectsPage, /purchase_profile_effect/);
  assert.match(effectsPage, /equipEffect/);
  assert.match(effectsPage, /unequipEffect/);
  assert.match(catalog, /supabase\.rpc\("equip_profile_effect"/);
  assert.match(catalog, /supabase\.rpc\("unequip_profile_effect"/);
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

await check("equipped looks follow the member onto every profile surface", async () => {
  const [header, accountMenu, profilePage, profileCard, profilePreview] = await Promise.all([
    read("src/components/profile/ProfileHeader.tsx"),
    read("src/components/account/AccountMenu.tsx"),
    read("src/routes/_app/u.$username.tsx"),
    read("src/components/profile/ProfileCard.tsx"),
    read("src/components/ProfilePreview.tsx"),
  ]);

  // The shared header renders every slot once, clipped inside the banner box.
  assert.match(header, /<ProfileEffect slug=/, "the header forgot the banner effect");
  assert.match(header, /<ProfileFrame slug=/, "the header forgot the frame");
  assert.match(header, /<AvatarDecoration/, "the header forgot the avatar");
  assert.match(header, /decorationSlug=\{avatarDecoration\?\.slug\}/, "the header forgot the decoration slot");

  for (const source of [profilePage, profileCard, profilePreview]) {
    assert.match(source, /useEquipped\(/);
    assert.match(source, /<ProfileHeader/, "a profile surface must use the shared header");
  }
  for (const source of [profileCard, profilePreview]) {
    assert.match(source, /effects=\{equipped\.data\}/, "a profile surface forgot the equipped looks");
  }
  for (const slot of ["profile_effect: shownEffect", "avatar_decoration: shownDecoration", "profile_frame: shownFrame"]) {
    assert.ok(profilePage.includes(slot), `the full profile forgot ${slot}`);
  }

  // The account menu keeps its compact header, so it mounts the three slots directly.
  assert.match(accountMenu, /useEquipped\(/);
  assert.match(accountMenu, /<ProfileEffectVisual slug=\{/, "the account menu forgot the banner effect");
  assert.match(accountMenu, /<ProfileFrame slug=\{/, "the account menu forgot the frame");
  assert.match(
    accountMenu,
    /<BloodwebDecoration slug=\{|decorationSlug=/,
    "the account menu forgot the avatar decoration",
  );
});

console.log(`\n${passed} checks passed.`);
