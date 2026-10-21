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
  assert.match(card, /className="relative h-32 w-full touch-none sm:touch-auto"/, "banner");
  assert.match(card, /h-\[88px\] w-\[88px\] rounded-full ring-\[6px\] ring-\[#111214\]/, "ringed avatar");
  assert.match(card, /ring-\[3px\] ring-\[#111214\]/, "presence dot ring");
  assert.ok(card.includes("About Me"));
  assert.ok(card.includes("Member Since"));
  assert.ok(card.includes("profile-sheet"), "phones use the swipe-down sheet");
  assert.ok(card.includes("dragTransition"), "the sheet springs back instead of snapping");
  assert.ok(card.includes("bg-[#111214]"), "the card uses Discord's popout colour");
});

await check("actions: Message with follow, own profile gets a single button", async () => {
  assert.match(card, /<MessageCircle className="h-4 w-4" \/>\s*Message/);
  assert.ok(card.includes("toggleFollow.mutate"));
  assert.ok(card.includes("isOwnProfile"));
  assert.ok(card.includes("View Full Profile"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
