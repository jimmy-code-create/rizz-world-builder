/**
 * Paws economy + cosmetics catalogue static guards.
 *
 * The economy (wallet, bounty rewards, ledger) is unchanged. The catalogue now
 * ships three original looks, one per wearable slot: Bloodweb (avatar), Puppy
 * Love (banner) and Dark Moon (frame). These checks lock the slots, the secure
 * purchase/equip path and the retired catalogue down together.
 *
 * Run: node tests/paws-effects.test.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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

const effectsLib = readFileSync(new URL("../src/lib/effects.ts", import.meta.url), "utf8");
const effectsPage = readFileSync(
  new URL("../src/routes/_app/effects.tsx", import.meta.url),
  "utf8",
);
const effectsComponent = readFileSync(
  new URL("../src/components/profile/ProfileEffect.tsx", import.meta.url),
  "utf8",
);
const profilePage = readFileSync(
  new URL("../src/routes/_app/u.$username.tsx", import.meta.url),
  "utf8",
);
const avatarDeco = readFileSync(
  new URL("../src/components/profile/AvatarDecoration.tsx", import.meta.url),
  "utf8",
);
const showcaseMigration = readFileSync(
  new URL("../supabase/migrations/20261030000000_puppy_love_effect.sql", import.meta.url),
  "utf8",
);
const looksMigration = readFileSync(
  new URL("../supabase/migrations/20261031000100_bloodweb_dark_moon.sql", import.meta.url),
  "utf8",
);
const frameTypeMigration = readFileSync(
  new URL("../supabase/migrations/20261031000000_profile_frame_type.sql", import.meta.url),
  "utf8",
);
const walletMigration = readFileSync(
  new URL("../supabase/migrations/20261027000000_paws_effects_shop.sql", import.meta.url),
  "utf8",
);
const scoreMigration = readFileSync(
  new URL("../supabase/migrations/20261028000000_paws_score_and_web_slinger.sql", import.meta.url),
  "utf8",
);
const tour = readFileSync(
  new URL("../src/components/onboarding/WelcomeTourOverlay.tsx", import.meta.url),
  "utf8",
);
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

await check("the catalogue is three looks, one per wearable slot", async () => {
  assert.ok(effectsLib.includes("export const COSMETICS_ENABLED = true"));
  for (const slug of ["fx-puppy-love", "fx-bloodweb", "fx-dark-moon"]) {
    assert.ok(effectsLib.includes(slug), `${slug} missing from the catalogue`);
  }
  assert.match(effectsLib, /type: "avatar_decoration"/);
  assert.match(effectsLib, /type: "profile_effect"/);
  assert.match(effectsLib, /type: "profile_frame"/);
  assert.match(
    effectsLib,
    /export const PROFILE_EFFECTS: ProfileEffect\[\] = \[\n\s+BLOODWEB_EFFECT,\n\s+DARK_MOON_EFFECT,\n\s+PUPPY_LOVE_EFFECT,\n\];/,
    "the catalogue must list exactly the three live looks",
  );
  // The retired gallery must stay gone.
  for (const slug of ["fx-sakura-bloom", "fx-arcane-nexus", "fx-sakura-storm", "fx-web-slinger"]) {
    assert.ok(!effectsLib.includes(slug), `${slug} came back`);
    assert.ok(!effectsPage.includes(slug), `${slug} is still linked from the effects page`);
  }
  assert.ok(!effectsLib.includes("nameplate"));
});

await check("the effects page previews, unlocks and equips each slot", async () => {
  assert.ok(effectsPage.includes("PROFILE_EFFECTS.map"));
  assert.ok(effectsPage.includes("BloodwebDecoration"));
  assert.ok(effectsPage.includes("DarkMoonFrame"));
  assert.ok(effectsPage.includes("PuppyLoveEffect"));
  assert.ok(effectsPage.includes("Unlock ·"));
  assert.ok(effectsPage.includes("Remove from profile"));
  assert.ok(effectsPage.includes("purchase_profile_effect"));
  assert.ok(effectsPage.includes("equipEffect"));
  assert.ok(effectsPage.includes("unequipEffect"));
  assert.ok(effectsPage.includes("useOwnedEffectSlugs"));
  assert.ok(effectsComponent.includes("PUPPY_LOVE_SLUG"));
  assert.ok(
    effectsComponent.includes("slug !== PUPPY_LOVE_SLUG"),
    "a stale slug must render nothing",
  );
  // Direct table writes are revoked; the gallery must go through the RPCs.
  assert.ok(effectsLib.includes('supabase.rpc("equip_profile_effect"'));
  assert.ok(effectsLib.includes('supabase.rpc("unequip_profile_effect"'));
  assert.ok(!/from\("user_profile_effects"\)\s*\n?\s*\.upsert/.test(effectsLib));
});

await check("the profile wears the frame, decoration, effect and chosen badges", async () => {
  assert.ok(profilePage.includes("ProfileBadgesSection"));
  assert.ok(profilePage.includes("ProfileEffectVisual"));
  assert.ok(profilePage.includes("ProfileFrame"));
  assert.ok(profilePage.includes("decorationSlug"));
  assert.ok(profilePage.includes("PawsBreakdown"));
  assert.ok(profilePage.includes("Paws balance"));
  assert.ok(!profilePage.includes("Rizz Score"));
  assert.ok(avatarDeco.includes("BloodwebDecoration"));
  assert.ok(avatarDeco.includes("decorationSlug"));
  assert.ok(!avatarDeco.includes("CinematicAvatarDecoration"));
});

await check("the new looks have their own slots and seed migration", async () => {
  assert.match(frameTypeMigration, /ADD VALUE IF NOT EXISTS 'profile_frame'/);
  assert.match(looksMigration, /'fx-bloodweb'/);
  assert.match(looksMigration, /'fx-dark-moon'/);
  assert.match(looksMigration, /'avatar_decoration'/);
  assert.match(looksMigration, /'profile_frame'/);
  assert.match(looksMigration, /'fx-puppy-love'/);
  assert.ok(!/DELETE FROM public\.profile_effects/.test(looksMigration), "new looks must not delete Puppy Love");
});

await check("the retired cinematic pipeline is gone", async () => {
  for (const path of [
    "public/effects",
    "scripts/effects",
    "scripts/build-web-slinger-effect.mjs",
    "scripts/build-web-slinger-banner.mjs",
    "scripts/check-web-slinger-effect.mjs",
    "src/lib/cinematic-effects.ts",
    "src/components/profile/CinematicEffect.tsx",
    "src/components/profile/CinematicAvatarDecoration.tsx",
  ]) {
    assert.ok(!existsSync(new URL(`../${path}`, import.meta.url)), `${path} still exists`);
  }
  for (const script of Object.keys(pkg.scripts ?? {})) {
    assert.ok(!script.startsWith("effects:"), `${script} still points at a removed pipeline`);
  }
});

await check("the migration retires the old catalogue and keeps the effect", async () => {
  assert.ok(showcaseMigration.includes("'fx-puppy-love',"));
  assert.ok(showcaseMigration.includes("UPDATE public.profile_effects"));
  assert.ok(showcaseMigration.includes("DELETE FROM public.profile_effects"));
  assert.ok(showcaseMigration.includes("WHERE slug <> 'fx-puppy-love'"));
  assert.ok(showcaseMigration.includes("ON CONFLICT (slug) DO UPDATE"));
});

await check("migration protects the wallet and rewards bounty claims", async () => {
  assert.ok(walletMigration.includes("paw_balance"));
  assert.ok(walletMigration.includes("protect_paw_balance"));
  assert.ok(walletMigration.includes("BEFORE INSERT OR UPDATE ON public.profiles"));
  assert.ok(walletMigration.includes("claim_bounty"));
  assert.ok(walletMigration.includes("reward_bounty_claim"));
  assert.ok(walletMigration.includes("SELECT 25::integer"));
  assert.ok(walletMigration.includes('DROP POLICY IF EXISTS "users acquire own effects"'));
  assert.ok(walletMigration.includes('DROP POLICY IF EXISTS "users drop own effects"'));
});

await check("Paws replaces the visible Rizz score", async () => {
  assert.ok(scoreMigration.includes("get_leaderboard"));
  assert.ok(scoreMigration.includes("legacy_rizz_transfer"));
  assert.ok(scoreMigration.includes("paw_earned"));
  assert.ok(scoreMigration.includes("rights_review = false"));
});

await check("tour describes live Paws instead of a preview", async () => {
  assert.ok(tour.includes("Earned in bounties."));
  assert.ok(tour.includes("Claim bounties"));
  assert.match(tour, /title: "Paws are live"/);
  assert.match(tour, /\[\"\[data-tour='nav-drops'\]\"/, "the Paws step must point at the real Bounties nav");
  assert.ok(!tour.includes("Paws preview · cosmetics not live yet"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
