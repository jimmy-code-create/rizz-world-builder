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
  assert.match(page, /POST|fetch\("\/api\/purify\/checkout"/);
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

await check("Settings links to the one billing page", () => {
  assert.match(settingsHub, /to: "\/purify"/);
  assert.match(settingsHub, /Purify/);
  assert.ok(exists("supabase/migrations/20261102000000_purify.sql"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
