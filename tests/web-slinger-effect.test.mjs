/**
 * Web Slinger — the only profile effect.
 *
 * These checks guard the things that break silently:
 *   - another effect creeping back into the catalogue or the renderer,
 *   - a background sneaking into the "transparent" scene,
 *   - the profile mounting the effect under the banner gradient, or without
 *     the pointer-events/aria safeguards,
 *   - the motion fallbacks disappearing,
 *   - the equip path going back to non-uuid effect ids.
 *
 * Run: bun tests/web-slinger-effect.test.mjs
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [catalog, effect, layer, route, styles, avatarDeco, nameplate, effectsPage, pkg] =
  await Promise.all([
    read("src/lib/effects.ts"),
    read("src/components/profile/WebSlingerEffect.tsx"),
    read("src/components/profile/ProfileEffect.tsx"),
    read("src/routes/_app/u.$username.tsx"),
    read("src/styles.css"),
    read("src/components/profile/AvatarDecoration.tsx"),
    read("src/components/profile/Nameplate.tsx"),
    read("src/routes/_app/effects.tsx"),
    read("package.json"),
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

await check("the catalogue contains exactly one effect: the Web Slinger", async () => {
  assert.match(catalog, /const WEB_SLINGER_SLUG = "fx-web-slinger"/);
  assert.match(catalog, /export const PROFILE_EFFECTS: ProfileEffect\[\] = \[WEB_SLINGER_EFFECT\];/);
  assert.match(catalog, /export const COSMETICS_ENABLED = true;/);
  for (const retired of [
    "deco-web-slinger",
    "fx-cosmic-nebula",
    "fx-cyber-matrix",
    "fx-cherry-petals",
    "np-cyberpunk",
    "np-royal-gold",
    'type: "avatar_decoration"',
    'type: "nameplate"',
  ]) {
    assert.ok(!catalog.includes(retired), `retired cosmetic survived in the catalogue: ${retired}`);
  }
});

await check("stale database rows cannot resurrect a removed effect", async () => {
  assert.match(catalog, /isAvailableEffect\(effect\.slug\)/, "equipped rows must be slug-filtered");
  assert.match(catalog, /isAvailableEffect\(effId\)/, "the local fallback must be slug-filtered");
  assert.match(catalog, /if \(!isAvailableEffect\(effectId\)\)/, "equip must reject unknown slugs");
});

await check("equipping resolves the database uuid instead of writing a slug", async () => {
  assert.match(catalog, /resolveEffectRowId\(effectId\)/, "equip must look the effect row up");
  assert.match(catalog, /\.eq\("slug", slug\)/, "the lookup must use profile_effects.slug");
  assert.match(catalog, /onConflict: "user_id,effect_id"/, "the equip write must upsert the pair");
  assert.match(catalog, /persisted: !error/, "equip must report whether the row was written");
});

await check("the renderer only draws the Web Slinger", async () => {
  assert.match(layer, /slug !== WEB_SLINGER_SLUG/, "unknown slugs must render nothing");
  assert.match(layer, /<WebSlingerEffect \/>/, "the layer must mount the scene");
  assert.ok(!layer.includes("CosmicNebula"), "a removed overlay survived in the renderer");
  assert.ok(!layer.includes("KawaiiHearts"), "a removed overlay survived in the renderer");
});

await check("the scene is genuinely transparent", async () => {
  assert.ok(!/<image\b/.test(effect), "the scene must not use a raster image");
  assert.ok(!/lottie/i.test(effect), "the scene must not load a Lottie player");
  assert.ok(
    !/<rect[^>]*(width="(640|100%)"|height="(360|100%)")/.test(effect),
    "there must be no full-canvas rect behind the character",
  );
  assert.ok(!/#0a0a0b|#0e0e10|#05060b/i.test(effect), "no stage background colours belong in the scene");
  assert.ok(!/backlight|haze|vignette|grade/i.test(effect), "removed stage layers must stay removed");
  // A wide stage that fills the banner (Discord profile effects are full-bleed),
  // not a 16:9 picture letterboxed in the middle of it.
  assert.match(effect, /viewBox="0 0 1100 360"/);
  assert.match(effect, /preserveAspectRatio="xMidYMid slice"/);
});

await check("the character is complete and centred", async () => {
  for (const part of [
    "const HEAD",
    "const LENS_LEFT",
    "const LENS_RIGHT",
    "const TORSO",
    "const ARM_RIGHT",
    "const ARM_LEFT",
    "const HAND_RIGHT",
    "const HAND_LEFT",
    "const THIGH_LEFT",
    "const THIGH_RIGHT",
    "const SHIN_LEFT",
    "const SHIN_RIGHT",
    "const BOOT_LEFT",
    "const BOOT_RIGHT",
  ]) {
    assert.ok(effect.includes(part), `missing character part: ${part}`);
  }
  assert.match(effect, /#wsx-head-shape/, "rim light must reference the mask silhouette");
  assert.match(effect, /#wsx-boot-left-shape/, "rim light must reference the boots");
  assert.match(effect, /<g className="wsx-scene" transform="translate\(230,0\)">/, "the hero sits inside the wide stage");
});

await check("webs leave both hands and the figure crouches on a strand", async () => {
  assert.match(effect, /const STRANDS_RIGHT = \[[\s\S]*?\];/);
  assert.match(effect, /const STRANDS_LEFT = \[[\s\S]*?\];/);
  assert.equal((effect.match(/M 468 64 C/g) ?? []).length, 3, "three strands must leave the right hand");
  assert.equal((effect.match(/M 184 214 C/g) ?? []).length, 3, "three strands must leave the left hand");
  assert.match(effect, /const WEB_LINE =/, "the crouch needs its strand");
  assert.match(effect, /className="wsx-strand"/);
});

await check("a symbiote answers the hero, and the webs burst on it", async () => {
  assert.match(effect, /className="wsx-foe"/, "the antagonist must be part of the scene");
  assert.match(effect, /className="wsx-foe-eye"/, "its eyes must be able to flare");
  assert.ok((effect.match(/className="wsx-tendril"/g) ?? []).length >= 4, "tendrils");
  assert.match(effect, /className="wsx-impact"/, "the web burst");
  assert.match(effect, /fill="url\(#wsx-symbiote\)"/, "the antagonist must share the vector style");
  assert.match(effect, /M 832 200 L 844 214/, "the open maw needs teeth");
  assert.match(styles, /@keyframes wsx-lunge/);
  assert.match(styles, /@keyframes wsx-tendril/);
  assert.match(styles, /@keyframes wsx-impact/);
  assert.match(styles, /\.wsx\[data-calm="true"\] \.wsx-impact \{ opacity: 0\.55; transform: none; \}/);
  assert.match(styles, /\.wsx \.wsx-impact \{ opacity: 0\.55; transform: none; \}/, "reduced motion keeps a burst");
});

await check("the profile mounts the effect above the banner gradient, pointer-free", async () => {
  const gradient = route.indexOf("bg-gradient-to-t from-background");
  const visual = route.indexOf("<ProfileEffectVisual");
  assert.ok(gradient > -1, "the banner gradient must still exist");
  assert.ok(visual > -1, "the profile must mount the effect");
  assert.ok(visual > gradient, "the effect must render after the gradient so it is not dimmed");
  assert.match(route, /<ProfileEffectVisual slug=\{shownEffect\.slug\} \/>/);
  assert.ok(
    !route.includes("effectSlug=") && !route.includes("eq?.avatar_decoration") && !route.includes("eq?.nameplate"),
    "removed decoration/nameplate wiring must be gone from the profile",
  );
  assert.match(styles, /\.wsx \{[\s\S]*?pointer-events: none;[\s\S]*?\}/, ".wsx must never capture pointer events");
  assert.match(effect, /aria-hidden="true"/);
});

await check("motion pauses off screen and degrades to a still", async () => {
  assert.match(effect, /IntersectionObserver/);
  assert.match(effect, /prefers-reduced-motion: reduce/);
  assert.match(effect, /prefersStillFrame/);
  assert.match(effect, /data-calm=/);
  assert.match(styles, /@keyframes wsx-breathe/);
  assert.match(styles, /@keyframes wsx-strand-draw/);
  assert.match(styles, /@keyframes wsx-mote/);
  assert.match(styles, /\.wsx\[data-visible="false"\] \* \{[\s\S]*?animation-play-state: paused/);
  assert.match(styles, /\.wsx\[data-calm="true"\]/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.wsx \* \{ animation: none !important; \}/);
});

await check("the removed decoration and nameplate surfaces are plain", async () => {
  for (const source of [avatarDeco, nameplate]) {
    assert.ok(!source.includes("COSMETICS_ENABLED"), "a removed surface still consults the cosmetics flag");
    for (const retired of ["fx-ring", "deco-", "np-", "discord-", "WebSlingerEffect"]) {
      assert.ok(!source.includes(retired), `removed effect markup survived: ${retired}`);
    }
  }
});

await check("the old Lottie pipeline and its assets are gone", async () => {
  assert.ok(!existsSync(new URL("../public/effects", import.meta.url)), "public/effects should be deleted");
  assert.ok(!existsSync(new URL("../scripts/effects", import.meta.url)), "scripts/effects should be deleted");
  assert.ok(
    !existsSync(new URL("../scripts/build-web-slinger-effect.mjs", import.meta.url)),
    "the Lottie builder should be deleted",
  );
  assert.ok(!pkg.includes("effects:build") && !pkg.includes("effects:check"), "the Lottie scripts should be gone");
});

await check("the single effect can be equipped from the effects page", async () => {
  assert.match(effectsPage, /<WebSlingerEffect \/>/, "the page must show the real scene");
  assert.match(effectsPage, /equipEffect\(user\.id, WEB_SLINGER_EFFECT\.slug, "profile_effect"\)/);
  assert.match(effectsPage, /Remove from profile/);
  assert.match(effectsPage, /queryKey: \["equipped", user\?\.id\]/);
});

await check("the migration seeds the spider and retires the rest", async () => {
  const migration = await read("supabase/migrations/20261029000000_web_slinger_only.sql");
  assert.match(migration, /'fx-web-slinger'/);
  assert.match(migration, /'profile_effect'/);
  assert.match(migration, /DELETE FROM public\.profile_effects\s+WHERE slug <> 'fx-web-slinger';/);
  assert.match(migration, /ON CONFLICT \(slug\) DO UPDATE/);
});

console.log(`\n${passed} checks passed.`);
