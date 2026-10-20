/**
 * Paws economy + cinematic effect shop static guards.
 * Run: node tests/paws-effects.test.mjs
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

const effectsLib = readFileSync(new URL("../src/lib/effects.ts", import.meta.url), "utf8");
const effectsPage = readFileSync(
  new URL("../src/routes/_app/effects.tsx", import.meta.url),
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
const migration = readFileSync(
  new URL("../supabase/migrations/20261027000000_paws_effects_shop.sql", import.meta.url),
  "utf8",
);
const tour = readFileSync(
  new URL("../src/components/onboarding/RizzyTour.tsx", import.meta.url),
  "utf8",
);

await check(
  "cosmetics are live and the catalogue has one profile effect + three avatar decorations",
  async () => {
    assert.ok(effectsLib.includes("export const COSMETICS_ENABLED = true"));
    assert.ok(effectsLib.includes('id: "fx-web-slinger"'));
    assert.ok(effectsLib.includes('type: "profile_effect"'));
    for (const slug of ["fx-sakura-bloom", "fx-arcane-nexus", "fx-sakura-storm"]) {
      assert.ok(effectsLib.includes(`id: "${slug}"`), `missing ${slug}`);
    }
    assert.equal((effectsLib.match(/type: "avatar_decoration"/g) ?? []).length, 3);
  },
);

await check(
  "shop buys with Paws through the server RPC and offers card checkout honestly",
  async () => {
    assert.ok(effectsLib.includes('supabase.rpc("purchase_profile_effect"'));
    assert.ok(effectsPage.includes("Unlock for {formatNumber(pawPrice)} Paws"));
    assert.ok(effectsPage.includes("Card checkout not connected"));
    assert.ok(effectsPage.includes("Buy with card"));
    assert.ok(
      effectsPage.includes('rpc("equip_profile_effect"') ||
        effectsLib.includes('rpc("equip_profile_effect"'),
    );
    assert.ok(effectsPage.includes("Apply to profile"));
  },
);

await check(
  "Web Slinger is a full-profile layer; other clips render around the avatar",
  async () => {
    assert.ok(profilePage.includes("full-profile effect"));
    assert.ok(profilePage.includes("previewProfileEffect"));
    assert.ok(profilePage.includes("previewAvatarEffect"));
    assert.ok(profilePage.includes('fit="cover"'));
    assert.ok(avatarDeco.includes("CINEMATIC_DECO"));
    assert.ok(avatarDeco.includes("CinematicAvatarDecoration"));
  },
);

await check("migration protects the wallet and rewards bounty claims", async () => {
  assert.ok(migration.includes("paw_balance"));
  assert.ok(migration.includes("protect_paw_balance"));
  assert.ok(migration.includes("BEFORE INSERT OR UPDATE ON public.profiles"));
  assert.ok(migration.includes("purchase_profile_effect"));
  assert.ok(migration.includes("grant_profile_effect"));
  assert.ok(migration.includes("claim_bounty"));
  assert.ok(migration.includes("reward_bounty_claim"));
  assert.ok(migration.includes("SELECT 25::integer"));
  assert.ok(migration.includes("rights_review"));
  assert.ok(migration.includes('DROP POLICY IF EXISTS "users acquire own effects"'));
  assert.ok(migration.includes('DROP POLICY IF EXISTS "users drop own effects"'));
});

await check("tour describes live Paws instead of a preview", async () => {
  assert.ok(tour.includes("Earned in bounties."));
  assert.ok(tour.includes("Claim bounties"));
  assert.ok(tour.includes("Paws are live."));
  assert.ok(!tour.includes("Paws preview · cosmetics not live yet"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
