/**
 * Voice room layout tiers. Pure math, so it is testable without a browser.
 *
 * Run: node tests/voice-layout.test.mjs
 */
import assert from "node:assert/strict";
import { computeVoiceLayout, voiceParticipantLabel } from "../src/lib/voice-layout.ts";

const COUNTS = [1, 2, 4, 5, 9, 10, 24, 25, 60];
const WIDTHS = [320, 390, 1280];
const TIERS = {
  1: "solo",
  2: "pair",
  4: "quad",
  5: "grid",
  9: "grid",
  10: "stage",
  24: "stage",
  25: "stage",
  60: "stage",
};

let checked = 0;
for (const width of WIDTHS) {
  for (const count of COUNTS) {
    for (const hasVideo of [false, true]) {
      const layout = computeVoiceLayout({ count, width, hasVideo });
      const label = `${count} people @ ${width}px video=${hasVideo}`;

      assert.equal(layout.tier, TIERS[count], `${label}: tier`);
      assert.ok(layout.columns >= 1 && layout.columns <= 3, `${label}: columns`);
      assert.ok(layout.tileMaxHeight > 0 && layout.tileMaxHeight <= 220, `${label}: height`);
      assert.ok(layout.avatarSize >= 64 && layout.avatarSize <= 96, `${label}: avatar`);
      assert.equal(layout.audience, count >= 10, `${label}: audience`);
      assert.equal(layout.virtualize, count >= 25, `${label}: virtualization`);
      assert.equal(layout.showAudienceNames, count < 20, `${label}: names`);
      assert.equal(layout.aspect, hasVideo ? "16 / 9" : "4 / 3", `${label}: aspect`);
      if (layout.audience) {
        assert.ok(layout.audienceColumns >= 4, `${label}: audience columns`);
        assert.ok(layout.audienceColumns <= 10, `${label}: audience columns cap`);
      }
      checked += 1;
    }
  }
}
console.log(`ok - ${checked} layout combinations`);

// A lone participant must never fill the room.
const solo = computeVoiceLayout({ count: 1, width: 1280 });
assert.equal(solo.columns, 1);
assert.ok(solo.tileMaxHeight <= 220);
console.log("ok - one person stays a compact tile");

// Two people are stacked, not squeezed side by side.
const pair = computeVoiceLayout({ count: 2, width: 1280 });
assert.equal(pair.columns, 1);
assert.ok(pair.tileMaxHeight <= 180);
console.log("ok - two people stack");

// Crowds gain an audience strip and virtualize from 25.
const crowd = computeVoiceLayout({ count: 24, width: 390 });
assert.equal(crowd.audience, true);
assert.equal(crowd.virtualize, false);
const huge = computeVoiceLayout({ count: 60, width: 390 });
assert.equal(huge.virtualize, true);
assert.ok(huge.audienceColumns >= 4);
console.log("ok - 24 vs 60 people");

// Narrow phones use tighter gaps, never negative sizes.
for (const width of [0, 200, 320]) {
  const layout = computeVoiceLayout({ count: 9, width });
  assert.ok(layout.gap >= 8);
  assert.ok(layout.avatarSize > 0);
}
console.log("ok - degenerate widths stay sane");

assert.equal(computeVoiceLayout({ count: Number.NaN, width: 390 }).tier, "solo");
assert.equal(computeVoiceLayout({ count: -4, width: 390 }).tier, "solo");
console.log("ok - invalid counts fall back to one person");

assert.equal(voiceParticipantLabel({ name: "Ana" }), "Ana");
assert.equal(voiceParticipantLabel({ name: "Ana", speaking: true }), "Ana, speaking");
assert.equal(
  voiceParticipantLabel({ name: "Ana", speaking: true, muted: true, video: true }),
  "Ana, speaking, muted, camera on",
);
console.log("ok - tile aria labels");

console.log("\nAll voice layout checks passed.");
