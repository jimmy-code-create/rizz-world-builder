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
const profilePage = readFileSync(new URL("../src/routes/_app/u.$username.tsx", import.meta.url), "utf8");

await check("the bio renders markdown instead of raw asterisks", async () => {
  assert.ok(card.includes('from "@/components/MarkdownText"'));
  assert.match(card, /<MarkdownText\s+text=\{p\.bio\}/);
  assert.ok(
    !/\{p\.bio\}/.test(card.replace(/<MarkdownText[\s\S]*?\/>/, "")),
    "the bio must not also be printed as plain text",
  );
});

await check("distinct earned badges sit on the name row", async () => {
  assert.ok(card.includes("fetchUserBadges"));
  assert.ok(card.includes("distinctBadges(canonBadges(earned))"));
  assert.match(card, /markBadges\.slice\(0, 6\)\.map/);
  assert.match(card, /<Badge slug=\{badge\.slug\} size=\{17\} title=\{badge\.name\} \/>/);
});

await check("Discord anatomy: banner, ringed avatar, presence dot, sections", async () => {
  assert.match(
    card,
    /className="relative h-40 w-full touch-none overflow-hidden sm:h-44 sm:touch-auto"/,
    "banner matches the profile card and clips the effect",
  );
  assert.match(
    card,
    /h-24 w-24 rounded-full ring-\[6px\] ring-\[#111214\]/,
    "same 96px avatar as the profile card",
  );
  assert.ok(card.includes("<VerifiedSeal"), "the name row uses the verified seal");
  assert.ok(!card.includes("BadgeCheck"), "no leftover stock tick icon");
  assert.ok(card.includes("StatusIcon status={status}"), "presence dot uses the DND/Idle icons");
  assert.ok(card.includes("z-[3]"), "presence dot paints above the avatar");
  assert.ok(card.includes("Close profile preview"), "the preview has a visible close control");
  assert.match(card, /h-\[22px\] w-\[22px\]/, "presence dot fits the 96px avatar");
  assert.ok(card.includes("About Me"));
  assert.ok(card.includes("Member Since"));
  assert.ok(card.includes("profile-sheet"), "phones use the swipe-down sheet");
  assert.ok(card.includes("dragTransition"), "the sheet springs back instead of snapping");
  assert.ok(card.includes("bg-[#111214]"), "the card uses Discord's popout colour");
});

await check("the accent is a glow around the avatar, never a solid colour hoop", async () => {
  assert.ok(profileCard.includes("Accent glow, not an accent ring"));
  assert.match(profileCard, /0 0 24px 5px \$\{ringColor\}59/, "close accent bloom");
  assert.match(profileCard, /0 0 56px 16px \$\{ringColor\}29/, "wide accent bloom");
  assert.ok(
    !/0 0 0 6px \$\{ringColor\}/.test(profileCard),
    "the old saturated ring must not come back",
  );
  assert.ok(profileCard.includes("<VerifiedSeal"), "profile card uses the verified seal");
  assert.match(profileCard, /h-24 w-24 rounded-full/, "profile card uses the same 96px avatar");
  assert.match(profileCard, /relative h-40 w-full overflow-hidden sm:h-44/, "profile card banner matches the preview");
  assert.ok(profilePage.includes("<VerifiedSeal"), "the full profile uses the verified seal");
});

await check("actions: Message with follow, own profile gets a single button", async () => {
  assert.match(card, /<MessageCircle className="h-4 w-4" \/>\s*Message/);
  assert.ok(card.includes("toggleFollow.mutate"));
  assert.ok(card.includes("isOwnProfile"));
  assert.ok(card.includes("View Full Profile"));
  // Discord puts Message/Call above the bio tabs; ours keeps that order so
  // nobody scrolls past a long bio to send a message.
  assert.ok(
    card.indexOf("Primary actions sit directly under the identity") <
      card.indexOf("{/* ABOUT ME */}"),
    "primary actions must precede the bio",
  );
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
