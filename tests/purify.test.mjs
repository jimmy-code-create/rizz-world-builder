import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => {
  try {
    readFileSync(new URL(`../${path}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
};

let passed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

const migration = read("supabase/migrations/20261102000000_purify.sql");
const purify = read("src/lib/purify.ts");
const page = read("src/routes/_app/purify.tsx");
const checkoutHelper = read("src/lib/purify-checkout.ts");
const sheet = read("src/components/purify/PurifyPaywallSheet.tsx");
const paywall = read("src/lib/purify-paywall.ts");
const checkout = read("src/routes/api.purify.checkout.ts");
const webhook = read("src/routes/api.purify.webhook.ts");
const profileSettings = read("src/routes/_app/settings/profile.tsx");
const gifPicker = read("src/components/GifPicker.tsx");
const dm = read("src/routes/_app/dm.$userId.tsx");
const group = read("src/routes/_app/g.$id.tsx");
const settingsHub = read("src/routes/_app/settings/index.tsx");
const me = read("src/routes/api.me.ts");

await check("the migration adds Purify columns and blocks client writes", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS purify_until timestamptz/);
  assert.match(migration, /stripe_customer_id text/);
  assert.match(migration, /stripe_subscription_id text/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.protect_purify_entitlement/);
  assert.match(migration, /auth\.role\(\) IS DISTINCT FROM 'service_role'/);
  assert.match(migration, /BEFORE UPDATE ON public\.profiles/);
});

await check("the entitlement is one future timestamp, not a client flag", () => {
  assert.match(purify, /export function isPurifyActive/);
  assert.match(purify, /time > Date\.now\(\)/);
  assert.match(purify, /VITE_PURIFY_ENFORCED === "1"/);
  assert.match(purify, /export function canUsePurify/);
  assert.doesNotMatch(purify, /localStorage/);
});

await check("the profile the app reads carries purify_until", () => {
  assert.match(me, /select\("\*"\)/);
  const auth = read("src/lib/auth.tsx");
  assert.match(auth, /purify_until\?: string \| null/);
});

await check("$1/month is the one price the UI prints", () => {
  assert.match(purify, /PURIFY_PRICE_CENTS = 100/);
  assert.match(purify, /PURIFY_PRICE_LABEL = "\$1 \/ month"/);
  assert.match(page, /PURIFY_PRICE_LABEL/);
  assert.match(page, /PURIFY_PRICE_SHORT/);
  // The page and the sheet share one checkout starter.
  assert.match(checkoutHelper, /fetch\("\/api\/purify\/checkout"/);
  assert.match(page, /startPurifyCheckout/);
  assert.match(sheet, /startPurifyCheckout/);
});

await check("the pricing page lists what Purify unlocks", () => {
  for (const key of ["PURIFY_BENEFITS", "Gradient profiles", "Banner photos", "GIFs everywhere", "Bigger uploads"]) {
    if (key === "PURIFY_BENEFITS") assert.match(purify, /PURIFY_BENEFITS/);
    else assert.ok(purify.includes(key), `${key} missing from the benefit copy`);
  }
  assert.match(page, /Cancel anytime/);
  assert.match(page, /nothing you already set is taken away/i);
});

await check("checkout refuses cleanly until Stripe keys exist", () => {
  assert.match(checkout, /STRIPE_SECRET_KEY/);
  assert.match(checkout, /STRIPE_PRICE_ID/);
  assert.match(checkout, /status: 503/);
  assert.match(checkout, /mode: "subscription"/);
  assert.match(checkout, /client_reference_id: auth\.userId/);
  assert.match(checkout, /api\.stripe\.com\/v1\/checkout\/sessions/);
});

await check("the webhook verifies the signature over the raw body", () => {
  assert.match(webhook, /request\.text\(\)/);
  assert.match(webhook, /stripe-signature/);
  assert.match(webhook, /crypto\.subtle\.sign\("HMAC"/);
  assert.match(webhook, /TOLERANCE_SECONDS/);
  assert.match(webhook, /status: 400/);
  assert.match(webhook, /checkout\.session\.completed/);
  assert.match(webhook, /invoice\.paid/);
  assert.match(webhook, /customer\.subscription\.deleted/);
  assert.match(webhook, /SUPABASE_SERVICE_ROLE_KEY/);
});

await check("gradients and banner photos ask for Purify", () => {
  assert.match(profileSettings, /requirePurify\("Profile gradients"\)/);
  assert.match(profileSettings, /requirePurify\("Banner photos"\)/);
  assert.match(profileSettings, /const purify = usePurify\(\)/);
  assert.match(profileSettings, /to="\/purify"/);
  // Grandfathering: clearing a gradient or removing a banner stays free.
  assert.doesNotMatch(profileSettings, /clearBannerGradient[\s\S]{0,120}requirePurify/);
  assert.doesNotMatch(profileSettings, /removeBannerImage[\s\S]{0,120}requirePurify/);
});

await check("GIFs are gated without touching emoji or stickers", () => {
  assert.match(gifPicker, /usePurify\(\)/);
  assert.match(gifPicker, /tab === "gifs" && !allowed/);
  assert.match(gifPicker, /GIFs come with Purify/);
  assert.doesNotMatch(gifPicker, /tab === "emoji" && !allowed/);
  assert.doesNotMatch(gifPicker, /tab === "stickers" && !allowed/);
});

await check("chat uploads use 10 MB free and 50 MB with Purify", () => {
  assert.match(purify, /FREE_CHAT_UPLOAD_BYTES = 10 \* 1024 \* 1024/);
  assert.match(purify, /PURIFY_CHAT_UPLOAD_BYTES = 50 \* 1024 \* 1024/);
  assert.match(purify, /LEGACY_CHAT_UPLOAD_BYTES/);
  for (const file of [dm, group]) {
    assert.match(file, /chatUploadLimitBytes\(profile\)/);
    assert.match(file, /formatUploadLimit\(uploadLimit\)/);
  }
});

await check("the upsell is a page, not a video ad", () => {
  assert.ok(!exists("src/components/purify/PurifyIntro.tsx"), "the video overlay came back");
  assert.ok(!exists("public/purify/purify-intro.mp4"), "the 10MB advert ships again");
  assert.doesNotMatch(page, /<video/, "the page renders a video element");
  assert.doesNotMatch(page, /PurifyIntro|shouldAutoPlayPurifyIntro/);
  assert.doesNotMatch(page, /Skip|Tap anywhere to skip/);
  assert.doesNotMatch(page, /VolumeX|Volume2/, "the mute button is back");
});

await check("the hero is the shield, animated once and reduced under motion", () => {
  assert.match(page, /<PurifyShield size=\{84\}/);
  const shield = read("src/components/purify/PurifyShield.tsx");
  assert.match(shield, /purify-shimmer/);
  assert.match(shield, /aria-hidden/);
  // No remote art: the mark is inline SVG, so it cannot fail to load.
  assert.doesNotMatch(shield, /<img|src=/);
  const styles = read("src/styles.css");
  assert.match(styles, /@keyframes purify-shimmer/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*purify-shimmer/);
  assert.match(page, /useReducedMotion\(\)/);
});

await check("the perks come from one config and match real gates", () => {
  assert.match(purify, /export const PURIFY_PERKS/);
  for (const title of [
    "Take escrow bounties",
    "Super reactions",
    "Animated RIZZ emoji",
    "Purify profile badge",
    "Profile gradients",
    "Banner photos",
    "GIFs everywhere",
    "Bigger uploads",
    "Realm emoji perks",
  ]) {
    assert.ok(purify.includes(title), `${title} missing from the perk config`);
  }
  assert.match(page, /PURIFY_PERKS\.length > 0/);
  // Each perk has a gate in the code behind it.
  const bounty = read("src/components/bounties/BountyCard.tsx");
  const card = read("src/components/PostCard.tsx");
  const realmSettings = read("src/routes/_app/r.$slug_.settings.tsx");
  assert.match(bounty, /openPurifyPaywall\("Escrow bounties"\)/);
  assert.match(card, /openPurifyPaywall\("Super reactions"\)/);
  assert.match(realmSettings, /openPurifyPaywall\("Shared realm emoji"\)/);
  assert.match(purify, /withPurifyBadge/);
  // The profile-gradient and banner examples are the real presets, not art.
  assert.match(page, /BANNER_PRESETS/);
  assert.match(page, /gradientCss\(DEMO_GRADIENT\)/);
});

await check("animated RIZZ emoji are locked to a still pack without Purify", () => {
  const cat = read("src/components/emoji/CatEmoji.tsx");
  const picker = read("src/components/emoji/RizzEmojiPicker.tsx");
  const picker2 = read("src/components/emoji/CatEmojiPicker.tsx");
  assert.match(cat, /usePurify/);
  assert.match(cat, /const entitled = preview \|\| active/);
  assert.match(cat, /entitled \? requested : "static"/);
  for (const source of [picker, picker2]) {
    assert.match(source, /usePurify/);
    assert.match(source, /locked/);
    assert.match(source, /<Lock/);
    assert.match(source, /animate=\{locked \? "static" : "hover"\}/);
  }
  // A super-reaction celebration stays animated for every viewer.
  const burst = read("src/components/reactions/SuperReactionBurst.tsx");
  assert.match(burst, /<CatEmoji name=\{cat\} size=\{132\} animate="loop" label="Super reaction" preview \/>/);
});

await check("the preview strip is real components, not a video", () => {
  assert.match(page, /snap-x snap-mandatory/);
  assert.match(page, /<ReactionPills/);
  assert.match(page, /<Badge type="premium"/);
  assert.match(page, /<Avatar/);
  assert.match(page, /Take it/);
  assert.match(page, /<CatEmoji name="cat_music" size=\{32\} animate="loop" preview \/>/);
  // The page must not repeat the old horizontal-overflow bug.
  assert.match(page, /mx-auto w-full min-w-0 max-w-xl/);
});

await check("pricing is one number, a restore, and a soft way out", () => {
  assert.match(page, /Billed monthly\. Cancel anytime\./);
  assert.match(page, /Get Purify · \$\{PURIFY_PRICE_SHORT\}/);
  assert.match(page, /Restore purchase/);
  assert.match(page, /refreshProfile/);
  assert.match(page, /Maybe later/);
  // No invented social proof.
  assert.doesNotMatch(page, /members have joined|\d+ members/i);
});

await check("a gate opens a sheet, and nothing opens it unasked twice a week", () => {
  assert.match(paywall, /PURIFY_PAYWALL_COOLDOWN_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(paywall, /rizz:open-purify-paywall/);
  assert.match(paywall, /paywallCapAllows/);
  assert.match(sheet, /PURIFY_PAYWALL_EVENT/);
  assert.match(sheet, /markPaywallSeen/);
  assert.match(sheet, /PURIFY_PERKS\.slice\(0, 3\)/);
  assert.match(sheet, /Maybe later/);
  assert.match(sheet, /to="\/purify"/);
  // Mounted once, for the whole app.
  const shell = read("src/components/AppShell.tsx");
  assert.match(shell, /<PurifyPaywallSheet \/>/);
  // Deliberate taps beat the cap; there is no forced interstitial anywhere.
  assert.doesNotMatch(paywall, /setInterval/);
});

await check("Settings links to the one billing page", () => {
  assert.match(settingsHub, /to: "\/purify"/);
  assert.match(settingsHub, /Purify/);
  assert.ok(exists("supabase/migrations/20261102000000_purify.sql"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
