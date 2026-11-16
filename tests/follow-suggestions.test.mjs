/**
 * Suggested-for-you people card.
 *
 * The reference is a single dark panel with a people glyph, circular faces and
 * one solid lime Follow control per row. These checks keep the card from
 * drifting back to a divided utility list while leaving the follow mutation and
 * the shared-interest explanation in place.
 *
 * Run: node tests/follow-suggestions.test.mjs
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

const source = readFileSync(
  new URL("../src/components/FollowSuggestions.tsx", import.meta.url),
  "utf8",
);

await check("the suggestions are one small bordered rectangle", () => {
  assert.match(
    source,
    /rounded-xl border border-white\/\[0\.09\] bg-\[#111113\]/,
    "the panel is a compact rounded rectangle with a hairline border",
  );
  assert.ok(source.includes("<Users"), "the header carries the people mark");
  assert.ok(source.includes('t("suggested_for_you")'), "the heading stays translated");
  assert.ok(source.includes("text-[10.5px] font-bold uppercase"), "the heading is a small quiet label");
  assert.ok(!source.includes("divide-y"), "rows are spaced, not split by rules");
  assert.ok(!source.includes("padStart(2"), "the count chip is gone");
  // The sweeping gradient was the loudest thing in the feed; a side note has no
  // business animating its own border.
  assert.ok(!source.includes("suggest-frame"), "no gradient frame class");
  assert.ok(!source.includes("linear-gradient"), "no gradient of any kind");
});

await check("faces are circular and the handle line prints rizz", () => {
  assert.ok(source.includes("rounded-full ring-1 ring-white/[0.08]"), "the avatar is a circle");
  assert.ok(source.includes("formatNumber(p.rizz_score)"), "the score is the shared formatter");
  assert.ok(source.includes(" rizz"), "the handle line names the score");
  assert.ok(source.includes("shared.join(\" / \")"), "shared interests still explain the pick");
});

await check("Follow is a small solid lime control with the add-person glyph", () => {
  assert.ok(source.includes("<UserPlus"), "the row uses the reference's add-person icon");
  assert.ok(source.includes("bg-[#c9ff3d]"), "the control is filled lime");
  assert.ok(source.includes("text-[#0b0b0c]"), "ink sits on the lime, not white");
  assert.ok(source.includes("h-6 min-w-[58px]"), "the control is compact but still fits Following");
  assert.ok(source.includes("h-7 w-7 shrink-0"), "the avatar is a 28px circle");
  assert.ok(source.includes("text-[12px] font-semibold"), "the name line is the row's anchor");
});

await check("a slow follow shows progress instead of a dead button", () => {
  assert.ok(source.includes("<Loader2"), "the pending row swaps in a spinner");
  assert.ok(source.includes("animate-spin"), "the spinner turns");
  assert.ok(source.includes("aria-busy={pending || undefined}"), "the control reports it is busy");
  assert.ok(source.includes("followMut.variables === p.id"), "pending is per row, not for every row");
});

await check("the follow mutation is untouched", () => {
  assert.match(
    source,
    /\.insert\(\{ follower_id: user!\.id, following_id: id \}\)/,
    "following still writes the real row",
  );
  assert.ok(source.includes("setFollowed((current) => [...current, p.id])"), "the optimistic state remains");
  assert.ok(source.includes("toast.success(\"Following ✨\")"), "the success toast remains");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
