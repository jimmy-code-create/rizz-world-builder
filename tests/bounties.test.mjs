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
const postDialog = readFileSync(
  new URL("../src/components/bounties/PostBountyDialog.tsx", import.meta.url),
  "utf8",
);
const card = readFileSync(new URL("../src/components/bounties/BountyCard.tsx", import.meta.url), "utf8");
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
  // Both tables are read on the board; `drops` carries the escrow columns and
  // `drop_claims` keeps the legacy open-call history.
  assert.ok(drops.includes('("drops")') && drops.includes('from("drop_claims")'));
  // The free open call survived the escrow board: same claim RPC, same flat
  // reward, same "+25 Paws" promise on the button that pays it.
  assert.ok(drops.includes('rpc("claim_bounty"'));
  assert.ok(drops.includes("BOUNTY_PAW_REWARD"));
  assert.ok(card.includes("Claim and earn 25 Paws"));
  assert.ok(card.includes("claim_limit"));
  assert.ok(postDialog.includes('storage.from("drops")'));
  assert.ok(postDialog.includes("claim_limit"));
  assert.ok(drops.includes("Paws balance"));
  assert.ok(drops.includes("Open calls still pay 25 Paws per claim"));
});

await check("quests drive promotion with existing flows only", async () => {
  assert.ok(drops.includes('aria-label="Bounty quests"'));
  assert.ok(drops.includes('role="progressbar"'));
  assert.ok(drops.includes("Quest progress is tracked on this device"));
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

await check("the retired effects shelf is gone and the Paws guide stays reachable", async () => {
  assert.ok(!drops.includes("Open Effects"), "no effects shelf link survives");
  assert.ok(!drops.includes('to="/effects"'), "no route to the retired shelf");
  assert.ok(drops.includes("Top Paws"));
  assert.ok(drops.includes("search={{ earn: true }}"));
  assert.ok(board.includes("validateSearch"));
  assert.ok(board.includes("useState(search.earn ?? false)"));
  assert.ok(board.includes("How to earn Paws"), "guide stays on the leaderboard");
});

await check("finished bounties leave the board", async () => {
  const library = readFileSync(new URL("../src/lib/bounties.ts", import.meta.url), "utf8");
  // Paid, cancelled and expired are over; an open call is over once every
  // claim has been taken. Either way there is nothing left to do with it.
  assert.ok(library.includes("export function isBountyFinished"), "no finished-bounty rule");
  assert.ok(library.includes("export function activeBounties"), "no filtered board list");
  assert.ok(
    /FINISHED_STATES[^=]*=\s*\["paid", "cancelled", "expired"\]/.test(library),
    "paid, cancelled and expired must all count as finished",
  );
  assert.ok(
    library.includes("claim_count") && library.includes("claim_limit"),
    "a sold-out open call is finished too",
  );
  // The board lists only active work, in both tabs.
  assert.ok(drops.includes("activeBounties(rows)"), "the board must filter through activeBounties");
  assert.ok(drops.includes("onlyMine ? myBounties : active"), "both tabs read the active list");
  assert.ok(drops.includes("bountiesNeedingYou(active"), "the desk reads the active list");
  assert.ok(drops.includes("active.length > 0"), "the tab switch hides when nothing is left");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
