/**
 * Paws economy + single-effect catalogue static guards.
 *
 * The economy (wallet, bounty rewards, ledger) is unchanged, but the cosmetics
 * catalogue is back to one entry: the Web Slinger profile effect. These checks
 * lock both halves down so a future gallery cannot quietly reintroduce removed
 * effects, and so the wallet rules cannot be dropped while the catalogue moves.
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
  new URL("../supabase/migrations/20261029000000_web_slinger_only.sql", import.meta.url),
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
  new URL("../src/components/onboarding/RizzyTour.tsx", import.meta.url),
  "utf8",
);
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

await check("the catalogue is one profile effect and nothing else", async () => {
  assert.ok(effectsLib.includes("export const COSMETICS_ENABLED = true"));
  assert.ok(effectsLib.includes('export const WEB_SLINGER_SLUG = "fx-web-slinger"'));
  assert.ok(effectsLib.includes("id: WEB_SLINGER_SLUG"));
  assert.ok(effectsLib.includes('type: "profile_effect"'));
  assert.equal(
    (effectsLib.match(/export const PROFILE_EFFECTS: ProfileEffect\[\] = \[WEB_SLINGER_EFFECT\]/g) ?? [])
      .length,
    1,
    "PROFILE_EFFECTS must still be the one-effect array",
  );
  // The retired gallery, its decorations and its paywall copy must stay gone.
  for (const slug of ["fx-sakura-bloom", "fx-arcane-nexus", "fx-sakura-storm"]) {
    assert.ok(!effectsLib.includes(slug), `${slug} came back`);
    assert.ok(!effectsPage.includes(slug), `${slug} is still linked from the effects page`);
  }
  assert.ok(!effectsLib.includes("avatar_decoration"));
  assert.ok(!effectsPage.includes("Buy with card"));
  assert.ok(!effectsPage.includes("Paws"));
});

await check("the effects page showcases and equips the one effect", async () => {
  assert.ok(effectsPage.includes("Equip on my profile"));
  assert.ok(effectsPage.includes("Remove from profile"));
  assert.ok(effectsPage.includes("WebSlingerEffect"));
  assert.ok(effectsLib.includes("equipEffect"));
  assert.ok(effectsComponent.includes("WEB_SLINGER_SLUG"));
  assert.ok(
    effectsComponent.includes("slug !== WEB_SLINGER_SLUG"),
    "a stale slug must render nothing",
  );
});

await check("the profile wears the effect and the chosen badges", async () => {
  assert.ok(profilePage.includes("ProfileBadgesSection"));
  assert.ok(profilePage.includes("ProfileEffectVisual"));
  assert.ok(profilePage.includes("PawsBreakdown"));
  assert.ok(profilePage.includes("Paws balance"));
  assert.ok(!profilePage.includes("Rizz Score"));
  assert.ok(!profilePage.includes("previewEffect"));
  assert.ok(!avatarDeco.includes("CinematicAvatarDecoration"));
  assert.ok(avatarDeco.includes("decorations were part of the cosmetics catalogue"));
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
  assert.ok(showcaseMigration.includes("'fx-web-slinger',"));
  assert.ok(showcaseMigration.includes("DELETE FROM public.profile_effects"));
  assert.ok(showcaseMigration.includes("WHERE slug <> 'fx-web-slinger'"));
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
  assert.ok(tour.includes("Paws are live."));
  assert.ok(!tour.includes("Paws preview · cosmetics not live yet"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
