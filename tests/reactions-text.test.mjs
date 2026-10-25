/**
 * Reaction text helpers: the hover tooltip sentence and the chip order.
 *
 * Run: node tests/reactions-text.test.mjs
 */
import assert from "node:assert/strict";
import { describeReactors, sortReactionGroups } from "../src/lib/reaction-text.ts";

assert.equal(describeReactors([], 0), "No reactions yet");
assert.equal(describeReactors(["jimmy"], 0), "No reactions yet");
console.log("ok - no reactions");

assert.equal(describeReactors(["jimmy"], 1), "jimmy reacted");
console.log("ok - one name");

assert.equal(describeReactors(["jimmy", "ana"], 2), "jimmy and ana reacted");
console.log("ok - two names");

// The exact sentence from the design: three names available, five reactions.
assert.equal(describeReactors(["jimmy", "ana", "kai"], 5), "jimmy, ana, kai and 2 others reacted");
assert.equal(describeReactors(["jimmy", "ana"], 5), "jimmy, ana and 3 others reacted");
assert.equal(describeReactors(["jimmy", "ana"], 3), "jimmy, ana and 1 other reacted");
console.log("ok - tail counts");

assert.equal(describeReactors(["You", "jimmy"], 2), "You and jimmy reacted");
console.log("ok - You stays first when the caller puts it first");

assert.equal(describeReactors(["jimmy", "jimmy", "  ", "ana"], 2), "jimmy and ana reacted");
console.log("ok - duplicates and blanks do not create phantom names");

assert.equal(describeReactors(["a", "b", "c", "d"], 2), "a and b reacted");
console.log("ok - never lists more names than reactions");

assert.equal(describeReactors([], 7), "7 reactions");
assert.equal(describeReactors([], 1), "1 reaction");
console.log("ok - count only fallback");

const order = (groups) => groups.map((group) => group.emoji);
const sorted = sortReactionGroups([
  { emoji: "😂", count: 2, firstAt: "2026-01-02T00:00:00Z" },
  { emoji: "🔥", count: 5, firstAt: "2026-01-03T00:00:00Z" },
  { emoji: "❤️", count: 2, firstAt: "2026-01-01T00:00:00Z" },
]);
assert.deepEqual(order(sorted), ["🔥", "❤️", "😂"]);
console.log("ok - count first, then the oldest reaction");

const tie = sortReactionGroups([
  { emoji: ":cat_sad:", count: 1 },
  { emoji: ":cat_love:", count: 1 },
]);
assert.deepEqual(order(tie), [":cat_love:", ":cat_sad:"]);
console.log("ok - ties fall back to a stable emoji order");

console.log("\nAll reaction text checks passed.");
