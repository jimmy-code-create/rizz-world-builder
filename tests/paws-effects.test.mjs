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
import { untypedFrom, untypedRpc } from "../src/lib/untyped-db.ts";
import {
  BANNER_PRESETS,
  DEFAULT_BANNER_ANGLE,
  getBanner,
  normalizeBannerGradient,
  normalizeBannerMode,
} from "../src/lib/banner.ts";
import { buildReceiptHtml, buildReceiptText, newOrderId } from "../src/lib/effect-receipt.ts";

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
const profileHeader = readFileSync(
  new URL("../src/components/profile/ProfileHeader.tsx", import.meta.url),
  "utf8",
);
const profileCard = readFileSync(
  new URL("../src/components/profile/ProfileCard.tsx", import.meta.url),
  "utf8",
);
const profilePreview = readFileSync(
  new URL("../src/components/ProfilePreview.tsx", import.meta.url),
  "utf8",
);
const bannerPicker = readFileSync(
  new URL("../src/components/profile/BannerGradientPicker.tsx", import.meta.url),
  "utf8",
);
const bannerLib = readFileSync(
  new URL("../src/lib/banner.ts", import.meta.url),
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
const bloodweb = readFileSync(
  new URL("../src/components/profile/BloodwebDecoration.tsx", import.meta.url),
  "utf8",
);
const darkMoon = readFileSync(
  new URL("../src/components/profile/DarkMoonFrame.tsx", import.meta.url),
  "utf8",
);
const puppy = readFileSync(
  new URL("../src/components/profile/PuppyLoveEffect.tsx", import.meta.url),
  "utf8",
);
const profileSettings = readFileSync(
  new URL("../src/routes/_app/settings/profile.tsx", import.meta.url),
  "utf8",
);
const gradientMigration = readFileSync(
  new URL("../supabase/migrations/20261101000000_profile_banner_gradient.sql", import.meta.url),
  "utf8",
);
const jsonbMigration = readFileSync(
  new URL("../supabase/migrations/20261102000000_banner_gradient_jsonb.sql", import.meta.url),
  "utf8",
);
const effectCss = [
  "bloodweb.css",
  "dark-moon.css",
  "puppy-love.css",
]
  .map((file) => readFileSync(new URL(`../src/components/profile/${file}`, import.meta.url), "utf8"))
  .join("\n");
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

await check("each look carries layered detail, motion and a reduced-motion still", async () => {
  assert.ok(bloodweb.includes("pl-bw-rim"), "Bloodweb needs its fine inner web");
  assert.ok(bloodweb.includes("pl-bw-nodes"), "Bloodweb needs junction nodes");
  assert.ok(bloodweb.includes("pl-bw-drips"), "Bloodweb needs the hanging drops");
  assert.ok(darkMoon.includes("dmf-stars"), "Dark Moon needs the cold stars");
  assert.ok(darkMoon.includes("dmf-mist"), "Dark Moon needs ground mist");
  assert.ok(darkMoon.includes("dmf-ash"), "Dark Moon needs drifting ash");
  assert.ok(darkMoon.includes("animationDelay"), "ravens must not bob in lockstep");
  assert.ok(puppy.includes("plx-bokeh"), "Puppy Love needs background bokeh");
  assert.ok(puppy.includes("plx-strings"), "Puppy Love needs hoodie strings");
  assert.ok(puppy.includes('fx("cuff")'), "Puppy Love needs the ribbed cuff");
  assert.ok(puppy.includes("DOG_WIDE"), "Puppy Love needs a wide-banner composition");
  assert.ok(puppy.includes("DOG_COMPACT"), "Puppy Love needs a short-preview composition");
  assert.ok(puppy.includes("ResizeObserver"), "the composition follows the banner shape");
  assert.ok(puppy.includes('preserveAspectRatio="xMidYMin slice"'), "wide banners anchor the pup to the top");
  assert.ok(effectCss.includes("prefers-reduced-motion: reduce"), "every look needs a still frame");
  assert.ok(effectCss.includes("pl-bw-flow"), "Bloodweb pulses need CSS");
  assert.ok(effectCss.includes("dmf-ash"), "Dark Moon ash needs CSS");
  assert.ok(effectCss.includes("plx-bokeh"), "Puppy bokeh needs CSS");
});

await check("the shelf labels each preview and its detail chips", async () => {
  assert.ok(effectsPage.includes("Live preview"));
  assert.ok(effectsPage.includes("Animated"));
  assert.ok(effectsPage.includes("Transparent SVG"));
  assert.ok(effectsPage.includes("Owned"));
  assert.ok(effectsPage.includes("h-48"), "previews grow to show the extra detail");
});

await check("the profile wears the frame, decoration, effect and chosen badges", async () => {
  assert.ok(profilePage.includes("ProfileBadgesSection"));
  assert.ok(profilePage.includes("<ProfileHeader"));
  assert.ok(profilePage.includes("avatar_decoration: shownDecoration"));
  assert.ok(profilePage.includes("profile_frame: shownFrame"));
  assert.ok(profilePage.includes("profile_effect: shownEffect"));
  assert.ok(profilePage.includes("PawsBreakdown"));
  assert.ok(profilePage.includes("Paws balance"));
  assert.ok(!profilePage.includes("Rizz Score"));
  assert.ok(avatarDeco.includes("BloodwebDecoration"));
  assert.ok(avatarDeco.includes("decorationSlug"));
  assert.ok(!avatarDeco.includes("CinematicAvatarDecoration"));
});

await check("one shared header paints every profile surface", async () => {
  for (const [surface, source] of [
    ["settings preview", profileSettings],
    ["profile card", profileCard],
    ["profile popup", profilePreview],
    ["full profile", profilePage],
  ]) {
    assert.ok(source.includes("<ProfileHeader"), `${surface} must use the shared header`);
  }
  // 3:1 banner, clipped effects, and an avatar sized from the container.
  assert.ok(
    profileHeader.includes('aspectRatio: "3 / 1"'),
    "the banner must always be 3:1",
  );
  assert.ok(profileHeader.includes("overflow-hidden"), "banner art must stay clipped");
  assert.ok(profileHeader.includes('containerType: "inline-size"'));
  assert.ok(profileHeader.includes('"--avatar-size"'));
  assert.ok(profileHeader.includes("getBanner(user)"));
  assert.ok(profileHeader.includes("onPointerDown={onBannerPointerDown}"));
  // Every visual surface feeds the header the same banner source.
  for (const [surface, source] of [
    ["profile card", profileCard],
    ["profile popup", profilePreview],
    ["full profile", profilePage],
    ["settings", profileSettings],
  ]) {
    assert.ok(source.includes("bannerMode"), `${surface} must pass banner_mode`);
    assert.ok(source.includes("bannerGradient"), `${surface} must pass banner_gradient`);
  }
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

await check("untyped database calls keep the Supabase client receiver", async () => {
  // PostgrestClient stores its URL/auth on `this`. A detached `rpc` or `from`
  // made every unlock fail with "Cannot read properties of undefined
  // (reading 'rest')" before the request was even sent.
  const client = {
    rest: { url: "https://example.supabase.co/rest/v1" },
    rpc(fn, args) {
      return Promise.resolve({ data: { fn, args, url: this.rest.url }, error: null });
    },
    from(table) {
      return { table, url: this.rest.url };
    },
  };

  const rpc = await untypedRpc(client)("purchase_profile_effect", { _slug: "fx-bloodweb" });
  assert.equal(rpc.error, null);
  assert.equal(rpc.data.fn, "purchase_profile_effect");
  assert.equal(rpc.data.args._slug, "fx-bloodweb");
  assert.equal(rpc.data.url, "https://example.supabase.co/rest/v1");
  assert.equal(untypedFrom(client)("profile_effects").url, "https://example.supabase.co/rest/v1");
});

await check("banner gradients use one validated helper and 16 presets", async () => {
  assert.equal(BANNER_PRESETS.length, 16, "the picker offers sixteen presets");
  assert.equal(DEFAULT_BANNER_ANGLE, 160, "the default angle is 160deg");
  const aurora = normalizeBannerGradient("aurora");
  assert.deepEqual(aurora, { c1: "#38bdf8", c2: "#6366f1", angle: 160 }, "legacy preset ids migrate");
  assert.deepEqual(
    normalizeBannerGradient({ c1: "#ABCDEF", c2: "#123456", angle: 400 }),
    { c1: "#abcdef", c2: "#123456", angle: 360 },
    "hex is normalized and the angle clamped",
  );
  assert.equal(normalizeBannerGradient({ c1: "nope", c2: "#123456" }), null);
  assert.equal(normalizeBannerMode("image"), "image");
  assert.equal(normalizeBannerMode("uploaded"), null);

  const image = getBanner({
    banner_url: "https://cdn.example/banner.png",
    banner_mode: "image",
    updated_at: "2026-10-21T12:00:00Z",
  });
  assert.equal(image.mode, "image");
  assert.ok(image.background.includes("cover"), "an image is cropped to fill the banner");
  assert.ok(image.background.includes("center top"), "the crop is anchored to the top");
  assert.ok(image.background.includes("v=2026-10-21T12%3A00%3A00Z"), "cache-busting uses updated_at");

  const gradient = getBanner({
    banner_url: null,
    banner_mode: "gradient",
    banner_gradient: { c1: "#112233", c2: "#445566", angle: 160 },
  });
  assert.equal(gradient.mode, "gradient");
  assert.ok(gradient.background.startsWith("linear-gradient(160deg"), "the gradient honours its angle");

  const none = getBanner({ banner_url: null, banner_mode: "none" });
  assert.equal(none.mode, "none");

  // The picker wires all three modes, a custom sheet and the instant save path.
  for (const piece of ["Image", "Gradient", "None", "Swap primary and accent", "Custom colors", "BannerGradientPicker"]) {
    assert.ok(bannerPicker.includes(piece), `${piece} missing from the gradient picker`);
  }
  assert.ok(bannerPicker.includes("aria-checked"));
  assert.ok(bannerPicker.includes("h-14"), "swatches stay at least 56px tall");
  assert.ok(profileSettings.includes("BannerGradientPicker"));
  assert.ok(profileSettings.includes("persistBanner"));
  assert.ok(profileSettings.includes("banner_mode: nextMode"));
  assert.ok(bannerLib.includes("export function getBanner"));
  assert.ok(bannerLib.includes("LEGACY_PRESETS"), "old preset ids keep their look");
});

await check("the final migration stores jsonb and keeps the card RPC intact", async () => {
  assert.ok(gradientMigration.includes("banner_gradient"));
  assert.ok(gradientMigration.includes("get_profile_card"), "the card RPC carries the gradient");
  assert.ok(jsonbMigration.includes("ADD COLUMN IF NOT EXISTS banner_mode"));
  assert.match(jsonbMigration, /ALTER COLUMN banner_gradient TYPE jsonb/);
  assert.match(
    jsonbMigration,
    /USING public\._banner_gradient_json\(banner_gradient\)/,
    "the type change must not put a subquery in USING",
  );
  assert.ok(jsonbMigration.includes("'aurora'"), "legacy preset ids are converted");
  assert.ok(jsonbMigration.includes("profiles_banner_gradient_check"));
  assert.ok(
    jsonbMigration.includes("'banner_gradient', v_profile->'banner_gradient'"),
    "the RPC must return an object, not a stringified gradient",
  );
  assert.ok(!jsonbMigration.includes("v_profile->>'banner_gradient'"));
});

await check("an effects purchase produces a downloadable receipt", async () => {
  const order = {
    id: newOrderId(1_760_000_000_000),
    date: "2026-10-21T12:00:00.000Z",
    account: "@jimmy",
    effect: {
      name: "Dark Moon",
      slug: "fx-dark-moon",
      type: "profile_frame",
      rarity: "legendary",
      paw_price: 1600,
    },
    amount: 1600,
    balanceAfter: 594_400,
  };
  assert.match(order.id, /^RZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const html = buildReceiptHtml(order);
  const text = buildReceiptText(order);
  assert.ok(html.includes("Dark Moon"));
  assert.ok(html.includes(order.id));
  assert.ok(html.includes("1,600 Paws"));
  assert.ok(html.includes("594,400 Paws"));
  assert.ok(html.includes("@jimmy"));
  assert.ok(text.includes("RIZZ · COSMETICS RECEIPT"));
  assert.ok(text.includes("Total paid"));
  assert.ok(effectsPage.includes("downloadReceipt"), "the shop offers the download");
  assert.ok(effectsPage.includes("Recent orders"), "past receipts stay visible");
  assert.ok(effectsPage.includes("Order complete"), "buying opens the receipt");
});

await check("tour describes live Paws instead of a preview", async () => {
  assert.ok(tour.includes("Earned in bounties."));
  assert.ok(tour.includes("Claim bounties"));
  assert.match(tour, /title: "Paws are live"/);
  assert.match(tour, /\[\"\[data-tour='nav-drops'\]\"/, "the Paws step must point at the real Bounties nav");
  assert.ok(!tour.includes("Paws preview · cosmetics not live yet"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
