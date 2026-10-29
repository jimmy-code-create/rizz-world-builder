/**
 * The redrawn profile badges, applied.
 *
 * Three things a future edit can quietly undo:
 *
 *  1. `src/components/Badge.tsx` is the single choke point every surface goes
 *     through — profile card, full profile, feed, forum, preview sheet and
 *     /badges. It now draws the new inline vector for every slug the family has
 *     a mark for, and keeps the sprite for everything else. If that branch
 *     moves or shrinks, the app silently reverts to the old art on half its
 *     screens while looking fine in the preview.
 *  2. The name row's four slugs (verified, streamer, bounty-hunter, purify)
 *     must map to four *different* new marks, or one pill mixes old and new art.
 *  3. The shared style is what makes five silhouettes look like one set: one
 *     user-space gradient, a 1u rim, a clipped top highlight, a glow that scales
 *     with the px, and no heavy shadow or flat fill.
 *
 * Run: node tests/badge-vector.test.mjs
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

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const sprite = read("src/components/Badge.tsx");
const vector = read("src/components/badges/Badge.tsx");
const preview = read("src/routes/badge-preview.tsx");
const postCard = read("src/components/PostCard.tsx");
const forum = read("src/components/forum/ForumBits.tsx");
const chip = read("src/components/BadgeChip.tsx");

await check("every surface draws the new mark through the one Badge component", () => {
  assert.match(sprite, /import \{ Badge as VectorBadge, badgeTypeForSlug \} from "@\/components\/badges\/Badge"/);
  assert.match(sprite, /const vector = badgeTypeForSlug\(slug\) \?\? badgeTypeForSlug\(symbol\)/);
  assert.match(sprite, /<VectorBadge type=\{vector\} size=\{px\} label=\{title\} noTooltip \/>/);
  // Props must survive the swap: same box, same locked treatment, same names.
  assert.match(sprite, /className=\{cn\("badge", locked && "badge--locked", className\)\}/);
  assert.match(sprite, /aria-label=\{title\}/);
  // Anything the family has no mark for still falls through to the sprite.
  assert.match(sprite, /spriteReady \? <use href=\{`#\$\{symbol\}`\} \/> : null/);
  assert.ok(!/if \(vector\) \{[\s\S]{0,400}use href/.test(sprite), "the vector branch must not render a sprite symbol");
});

await check("the name row's four slugs land on four different new marks", () => {
  const map = vector.slice(vector.indexOf("const SLUG_TO_TYPE"), vector.indexOf("export function badgeTypeForSlug"));
  assert.match(map, /verified: "verified"/);
  assert.match(map, /"no-cap": "verified"/);
  assert.match(map, /purify: "premium"/);
  assert.match(map, /streamer: "creator"/);
  assert.match(map, /"bounty-hunter": "top_paws"/);
  assert.match(map, /og: "early_member"/);
  assert.match(map, /"verified-creator": "creator"/);
  const marks = ["verified", "premium", "creator", "top_paws"].map((type) =>
    new RegExp(`^  ${type}: \\{`, "m").test(vector),
  );
  assert.ok(marks.every(Boolean), "all five badge types are defined");
  assert.match(vector, /export function badgeTypeForSlug/);
  assert.match(vector, /replace\(\/_\/g, "-"\)/, "underscores and hyphens are both accepted");
  // Unmapped slugs return null so the sprite path keeps them.
  assert.match(vector, /if \(!slug\) return null;/);
});

await check("the five marks share one construction rule", () => {
  // One light source, in user space, so a multi-part silhouette lights once.
  assert.match(vector, /gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="21"/);
  assert.match(vector, /gradientUnits="userSpaceOnUse" x1="0" y1="2\.5" x2="0" y2="13"/);
  assert.match(vector, /stroke="rgba\(255,255,255,0\.55\)"[\s\S]{0,40}strokeWidth=\{1\}/, "the hairline rim");
  assert.match(vector, /strokeLinejoin="round"/);
  assert.match(vector, /clipPath=\{clip\}/, "the top highlight is clipped to the silhouette");
  assert.match(vector, /drop-shadow\(0 0 /);
  assert.match(vector, /px \* 0\.11/, "the glow scales with the rendered size");
  assert.ok(!vector.includes("box-shadow"), "no heavy shadows");
  // Depth comes from the two tones, never a flat single-colour fill.
  const defs = vector.slice(vector.indexOf("const BADGES"), vector.indexOf("export type BadgeProps"));
  for (const type of ["verified", "premium", "early_member", "top_paws", "creator"]) {
    assert.ok(new RegExp(`  ${type}: \\{[\\s\\S]{0,400}?from: "#`).test(vector), `${type} has a two-tone`);
  }
  assert.ok(defs.includes("to: \"#"), "every type has a bottom tone too");
  assert.match(vector, /const px = Math\.max\(16, Math\.round\(size\)\)/, "16px is the floor");
});

await check("a badge explains itself, on hover and on long-press", () => {
  assert.match(vector, /title=\{`\$\{name\} — \$\{sub\}`\}/);
  assert.match(vector, /role="img"/);
  assert.match(vector, /aria-label=\{`\$\{name\} badge`\}/);
  assert.match(vector, /TooltipContent/);
  // The surface may own the tooltip instead — BadgeChip draws its own.
  assert.match(vector, /noTooltip\?: boolean/);
  assert.match(chip, /TooltipContent/);
});

await check("name rows carry the marks in one pill, 4px apart", () => {
  assert.match(postCard, /<BadgeRow badges=\{post\.author\.badges\} max=\{4\} size="sm" tray \/>/);
  assert.match(forum, /<BadgeRow badges=\{badges\} max=\{4\} size="sm" tray \/>/);
  // The capsule itself: rounded, one container, gap-1 = 4px (the 4–6px range).
  assert.match(chip, /tray\s*\? "w-max flex-nowrap whitespace-nowrap rounded-full border[^\"]*gap-1|gap-1[\s\S]{0,120}?rounded-full/);
  assert.match(chip, /inline-flex max-w-full shrink-0 items-center gap-1/);
});

await check("the preview still shows every mark at 16, 20 and 28 on both surfaces", () => {
  assert.match(preview, /const SIZES = \[16, 20, 28\] as const/);
  assert.match(preview, /BADGE_TYPES\.map/);
  assert.match(preview, /On the profile card/);
  assert.match(preview, /On a light surface/);
  assert.match(preview, /gap=\{4\}/, "the crowded five-mark case");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
