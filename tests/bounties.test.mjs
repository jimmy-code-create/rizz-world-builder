/**
 * Bounties rename tests: visible name is "Bounties" everywhere, old voice
 * aliases still work, /drops route and reward mechanics untouched.
 * Static guards (no DOM) per repo test convention.
 * Run: node tests/bounties.test.mjs
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

const drops = readFileSync(new URL("../src/routes/_app/drops.tsx", import.meta.url), "utf8");
const board = readFileSync(new URL("../src/routes/_app/leaderboard.tsx", import.meta.url), "utf8");
const palette = readFileSync(
  new URL("../src/components/CommandPalette.tsx", import.meta.url),
  "utf8",
);
const i18n = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");
const commands = readFileSync(new URL("../src/lib/rizz-commands.ts", import.meta.url), "utf8");

await check("visible name is Bounties (page, title, nav strings)", async () => {
  assert.ok(drops.includes("Bounties · RIZZ"));
  assert.ok(drops.includes("/> Bounties"));
  assert.ok(drops.includes("No active bounties"));
  assert.ok(palette.includes('{ to: "/drops", label: "Bounties"'));
  assert.ok(i18n.includes('bounties: "Bounties"'));
  assert.ok(i18n.includes('bounties: "Missions"'));
  assert.ok(!drops.includes("Giveaways") && !drops.includes("No active drops"));
});

await check("old voice aliases kept, speak wording updated", async () => {
  for (const word of ["drop", "drops", "giveaway", "giveaways", "bounty", "bounties"]) {
    assert.ok(commands.includes(`"${word}"`), `missing alias ${word}`);
  }
  assert.ok(commands.includes('speak: "Bounties khol raha hu"'));
  assert.ok(commands.includes('id: "open:drops", path: "/drops"'));
});

await check("route, tables, and claim mechanics still present", async () => {
  assert.ok(drops.includes('createFileRoute("/_app/drops")'));
  assert.ok(drops.includes('from("drops")') && drops.includes('from("drop_claims")'));
  assert.ok(drops.includes('storage.from("drops")'));
  assert.ok(drops.includes("claim_limit") && drops.includes("Claim · +"));
  assert.ok(drops.includes('rpc("claim_bounty"'));
  assert.ok(drops.includes("BOUNTY_PAW_REWARD"));
  assert.ok(drops.includes("Paws balance"));
  assert.ok(drops.includes("Every successful bounty claim pays"));
});

await check("quests drive promotion with existing flows only", async () => {
  assert.ok(drops.includes('aria-label="Bounty quests"'));
  assert.ok(drops.includes('role="progressbar"'));
  for (const title of [
    "Claim your first bounty",
    "Post a bounty for the crew",
    "Bring 3 friends to your group",
    "Share RIZZ outside the app",
    "Hype a win on the feed",
  ]) {
    assert.ok(drops.includes(title), `missing quest ${title}`);
  }
  assert.ok(drops.includes('to: "/groups"') && drops.includes('to: "/feed"'));
  assert.ok(drops.includes("nav?.share") && drops.includes("rizz.quests.shared"));
  assert.ok(!drops.includes("quest_completions") && !drops.includes("awardQuest"));
});

await check("Paws can be spent on effects and the Paws guide stays reachable", async () => {
  assert.ok(drops.includes("Spend your Paws"));
  assert.ok(drops.includes("Open Effects"));
  assert.ok(drops.includes('to="/effects"'));
  assert.ok(drops.includes("Top Paws"));
  assert.ok(drops.includes("search={{ earn: true }}"));
  assert.ok(board.includes("validateSearch"));
  assert.ok(board.includes("useState(search.earn ?? false)"));
  assert.ok(board.includes("How to earn Paws"), "guide stays on the leaderboard");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
