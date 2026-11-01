// Trust, fee and rule parity for bounties. These run against the pure module
// the UI imports, plus a source check that the SQL migration still mirrors it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AUTO_BLOCK_WARNINGS,
  CANCEL_FEE,
  FEE_RECIPIENT,
  MIN_TRUST_LABEL,
  TRUST_LEVEL_LABEL,
  TRUST_LEVEL_ORDER,
  TRUST_THRESHOLDS,
  canAffordTakerCancelFee,
  feeRecipientLabel,
  feeRecipientSentence,
  isAutoBlocked,
  meetsMinTrust,
  takerCancelFee,
  trustLevel,
  trustLine,
  trustStats,
  warningWord,
  warningsUntilBlock,
} from "../src/lib/bounty-trust.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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

await check("levels follow approved work and active warnings", () => {
  assert.equal(trustLevel(0, 0), "new");
  assert.equal(trustLevel(2, 0), "new");
  assert.equal(trustLevel(3, 0), "trusted");
  assert.equal(trustLevel(3, 1), "trusted");
  assert.equal(trustLevel(3, 2), "new", "two warnings should drop a taker to New");
  assert.equal(trustLevel(9, 0), "trusted");
  assert.equal(trustLevel(10, 0), "top");
  assert.equal(trustLevel(10, 1), "trusted", "one warning should keep a taker out of Top");
  assert.equal(trustLevel(12, 0), "top");
});

await check("thresholds are the ones we agreed", () => {
  assert.equal(TRUST_THRESHOLDS.trustedCompleted, 3);
  assert.equal(TRUST_THRESHOLDS.trustedMaxWarnings, 1);
  assert.equal(TRUST_THRESHOLDS.topCompleted, 10);
  assert.equal(TRUST_THRESHOLDS.topMaxWarnings, 0);
  assert.equal(AUTO_BLOCK_WARNINGS, 3);
});

await check("stats clamp junk instead of producing NaN", () => {
  assert.deepEqual(trustStats(null, undefined), { completed: 0, warnings: 0, level: "new" });
  assert.deepEqual(trustStats(-4, "3"), { completed: 0, warnings: 3, level: "new" });
  assert.deepEqual(trustStats(7.9, 0.4), { completed: 7, warnings: 0, level: "trusted" });
});

await check("the count line reads correctly for one and many", () => {
  assert.equal(trustLine(0, 0), "0 completed · 0 warnings");
  assert.equal(trustLine(1, 1), "1 completed · 1 warning");
  assert.equal(trustLine(trustStats(12, 2)), "12 completed · 2 warnings");
  assert.equal(warningWord(1), "warning");
  assert.equal(warningWord(0), "warnings");
});

await check("minimum trust filters the right takers", () => {
  assert.equal(meetsMinTrust("new", "any"), true);
  assert.equal(meetsMinTrust("new", "trusted"), false);
  assert.equal(meetsMinTrust("trusted", "trusted"), true);
  assert.equal(meetsMinTrust("trusted", "top"), false);
  assert.equal(meetsMinTrust("top", "top"), true);
  assert.ok(TRUST_LEVEL_ORDER.top > TRUST_LEVEL_ORDER.trusted);
  assert.equal(TRUST_LEVEL_LABEL.top, "Top");
  assert.equal(MIN_TRUST_LABEL.any, "Anyone can take it");
});

await check("three warnings close taking, pending appeals included", () => {
  assert.equal(isAutoBlocked(0), false);
  assert.equal(isAutoBlocked(2), false);
  assert.equal(isAutoBlocked(3), true);
  assert.equal(isAutoBlocked(4), true);
  assert.equal(warningsUntilBlock(0), 3);
  assert.equal(warningsUntilBlock(2), 1);
  assert.equal(warningsUntilBlock(3), 0);
});

await check("the cancellation fee is 1000 Paws and defaults to the creator", () => {
  assert.equal(CANCEL_FEE, 1000);
  assert.equal(FEE_RECIPIENT, "creator");
  assert.deepEqual(takerCancelFee(), { amount: 1000, recipient: "creator" });
  assert.deepEqual(takerCancelFee("platform"), { amount: 1000, recipient: "platform" });
  assert.equal(feeRecipientLabel("creator"), "the creator");
  assert.equal(feeRecipientLabel("platform"), "RIZZ");
  assert.match(feeRecipientSentence("creator"), /poster/);
  assert.match(feeRecipientSentence("platform"), /RIZZ/);
});

await check("taking is blocked below the fee", () => {
  assert.equal(canAffordTakerCancelFee(999), false);
  assert.equal(canAffordTakerCancelFee(1000), true);
  assert.equal(canAffordTakerCancelFee(undefined), false);
  assert.equal(canAffordTakerCancelFee("1200"), true);
});

await check("the migration mirrors the constants and keeps one payout path", () => {
  const sql = read("supabase/migrations/20261108000000_bounty_trust.sql");
  assert.match(sql, /'cancel_fee',\s*1000/, "SQL cancel fee drifted from CANCEL_FEE");
  assert.match(sql, /'fee_recipient',\s*'creator'/, "SQL recipient drifted from FEE_RECIPIENT");
  assert.match(sql, /'auto_block_warnings',\s*3/, "SQL auto-block threshold drifted");
  assert.match(sql, /'trusted_completed',\s*3/);
  assert.match(sql, /'top_completed',\s*10/);
  assert.match(sql, /purify_until/, "taking is not gated on Purify in SQL");
  assert.match(sql, /bounty_blocks/, "creator blocks are not checked in SQL");
  assert.match(sql, /bounty_cancel_log/, "cancellations are not logged");
  assert.match(sql, /'platform'/, "the platform fee recipient is not supported");
  assert.match(sql, /release_overdue_bounty_payout/, "the auto-pay path was touched");
});

await check("the browser module re-exports the shared constants", () => {
  const lib = read("src/lib/bounties.ts");
  assert.ok(
    lib.includes('from "./bounty-trust"'),
    "bounties.ts should re-export the tested constants",
  );
  assert.ok(!lib.includes("export const CANCEL_FEE"), "the fee is defined twice");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
