/**
 * Profile preview card (the Discord-style popout opened from an avatar).
 *
 * These guards cover the two things that went wrong on the live card: a bio
 * full of markdown rendered as literal `**asterisks**`, and a name row with no
 * badges on it. They also lock the Discord anatomy in place — banner, ringed
 * avatar with a presence dot, ABOUT ME, MEMBER SINCE and the action row.
 *
 * Run: node tests/profile-preview.test.mjs
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

const card = readFileSync(new URL("../src/components/ProfilePreview.tsx", import.meta.url), "utf8");
const profileCard = readFileSync(
  new URL("../src/components/profile/ProfileCard.tsx", import.meta.url),
  "utf8",
);
const profilePage = readFileSync(
  new URL("../src/routes/_app/u.$username.tsx", import.meta.url),
  "utf8",
);
const profileHeader = readFileSync(
  new URL("../src/components/profile/ProfileHeader.tsx", import.meta.url),
  "utf8",
);

await check("the bio renders markdown instead of raw asterisks", async () => {
  assert.ok(card.includes('from "@/components/MarkdownText"'));
  assert.match(card, /<MarkdownText\s+text=\{p\.bio\}/);
  assert.ok(
    !/\{p\.bio\}/.test(card.replace(/<MarkdownText[\s\S]*?\/>/, "")),
    "the bio must not also be printed as plain text",
  );
});

await check("distinct earned badges sit on the name row and are tappable", async () => {
  assert.ok(card.includes("fetchUserBadges"));
  assert.ok(card.includes("distinctBadges(canonBadges(earned))"));
  assert.match(card, /withPurifyBadge\(distinctBadges\(canonBadges\(earned\)\), purify\.active\)\.slice\(\s*0,\s*5,?\s*\)/);
  assert.match(
    card,
    /<BadgeChip[\s\S]{0,180}?onSelect=\{\(\) => nav\(\{ to: "\/badges" \}\)\}/,
    "a tapped badge links to the badge gallery",
  );
  assert.ok(!card.includes("BadgeDetailDialog"), "the cut-off popout is gone; badges navigate");
  assert.ok(card.includes("AnimatedBadge"), "the subscriber mark carries particles");
});

await check("Discord anatomy: shared banner, avatar, presence dot, sections", async () => {
  assert.ok(card.includes("<ProfileHeader"), "the preview renders the shared header");
  assert.ok(card.includes("bannerMode: p.banner_mode"), "the preview honours banner_mode");
  assert.ok(card.includes("bannerGradient: p.banner_gradient"), "the preview honours the gradient");
  assert.ok(!card.includes("effects="), "the effects shelf is retired, so the header carries none");
  assert.ok(!card.includes("useEquipped"), "the preview no longer queries equipped cosmetics");
  assert.ok(card.includes("Close profile preview"), "the preview has a visible close control");
  assert.ok(card.includes("About Me"));
  assert.ok(card.includes("Member Since"));
  assert.ok(card.includes("profile-sheet"), "phones use the swipe-down sheet");
  assert.ok(card.includes("dragTransition"), "the sheet springs back instead of snapping");
  assert.ok(card.includes("bg-[#111214]"), "the card uses Discord's popout colour");

  assert.ok(profileHeader.includes('aspectRatio: "3 / 1"'), "the banner is always 3:1");
  assert.ok(profileHeader.includes("overflow-hidden"), "banner art is clipped");
  assert.ok(profileHeader.includes("<AvatarImage src={avatarSrc}"), "the header owns the avatar");
  assert.ok(profileHeader.includes("<VerifiedSeal"), "the header uses the verified seal");
  assert.ok(profileHeader.includes("<StatusDotButton"), "the header owns the presence dot");
  assert.ok(
    profileHeader.includes("onPointerDown={onBannerPointerDown}"),
    "the sheet can drag from the banner",
  );
});

await check("one avatar treatment across card, preview and full profile", async () => {
  assert.ok(profileCard.includes("<ProfileHeader"), "profile card uses the shared header");
  assert.ok(profilePage.includes("<ProfileHeader"), "full profile uses the shared header");
  assert.ok(profileCard.includes("avatarRing={ringColor}"), "profile card passes its accent");
  assert.ok(
    profilePage.includes("avatarRing={profileSurface}"),
    "full profile rings against its theme",
  );
  assert.ok(
    profilePage.includes("background: pageBanner.profileBackground"),
    "full profile paints the gradient",
  );
  assert.ok(profileHeader.includes("boxShadow: `0 0 0 2px ${avatarRing}`"), "one accent ring");
  assert.ok(profileHeader.includes('"--avatar-size"'), "the avatar scales from the container");
  assert.ok(card.includes("Profile activity"), "the preview lists the same activity numbers");
  assert.ok(card.includes("/brand/rizz-cat-logo.svg"), "joined date carries the Rizz mark");
});

await check("actions: Message with follow, own profile gets a single button", async () => {
  assert.match(card, /<MessageCircle className="h-4 w-4" \/>\s*Message/);
  assert.ok(card.includes("toggleFollow.mutate"));
  assert.ok(card.includes("isOwnProfile"));
  assert.ok(card.includes("View Full Profile"));
  // Discord puts Message/Call above the bio tabs; ours keeps that order so
  // nobody scrolls past a long bio to send a message.
  assert.ok(
    card.indexOf("Primary actions sit directly under the identity") < card.indexOf("About Me"),
    "primary actions must precede the bio",
  );
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
