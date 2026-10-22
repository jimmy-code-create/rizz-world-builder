/**
 * Profile Activity tab and downloadable profile card.
 *
 * The games rail left the profile: the tab now reports what the member did
 * (posts, likes, comments, reactions, follows, badges, Paws) and the newest
 * posts, reels, realms and communities. The downloaded card carries one date —
 * the month they joined — and nothing else.
 *
 * Run: node tests/profile-activity.test.mjs
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

const page = readFileSync(new URL("../src/routes/_app/u.$username.tsx", import.meta.url), "utf8");

await check("profile tabs are Main, Activity and Paws", async () => {
  assert.ok(page.includes('{ value: "activity", label: "Activity" }'));
  assert.ok(!page.includes('label: "Games"'), "the games tab is gone");
  assert.ok(!page.includes("BUILTIN_GAMES"), "the arcade shelf no longer renders on the profile");
  assert.ok(page.includes('<TabsContent value="activity"'));
});

await check("lifetime activity reports the eight counters", async () => {
  assert.ok(page.includes("Lifetime activity"), "the section is titled");
  for (const label of [
    "Posts",
    "Likes",
    "Comments",
    "Reactions",
    "Followers",
    "Following",
    "Badges",
    "Paws",
  ]) {
    assert.ok(page.includes(`label: "${label}"`), `missing the ${label} counter`);
  }
  assert.ok(page.includes('sum("like_count")'), "likes come from the post rows");
  assert.ok(page.includes('sum("comment_count")'), "comments come from the post rows");
  assert.ok(page.includes('sum("reaction_count")'), "reactions come from the post rows");
});

await check("recent activity lists posts, reels, realms and communities", async () => {
  assert.ok(page.includes("Recent activity"));
  assert.ok(page.includes("Shared a post"));
  assert.ok(page.includes("Posted a reel"));
  assert.ok(page.includes("Created a realm"));
  assert.ok(page.includes("Joined a community"));
  assert.ok(page.includes(".slice(0, 8)"), "the list stays short");
  assert.ok(page.includes("relativeTime(item.at)"), "each row carries a relative time");
});

await check("there is no profile-card download anywhere", async () => {
  assert.ok(!page.includes("Download profile card"), "the header must not offer a card download");
  assert.ok(!page.includes("Download card"), "profile menus must not offer a card download");
  assert.ok(!page.includes("downloadProfileCard"), "the renderer import must be gone");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
