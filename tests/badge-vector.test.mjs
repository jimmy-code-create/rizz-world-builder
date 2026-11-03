/**
 * The redrawn profile badges, applied.
 *
 * The set is now one flat sticker printed in two inks. Three things a later
 * edit can quietly undo:
 *
 *  1. `src/components/Badge.tsx` is the single choke point every surface goes
 *     through — profile card, full profile, feed, forum, preview sheet and
 *     /badges. It draws the sticker for every slug the family covers and keeps
 *     the sprite for everything else. If that branch moves or shrinks, half the
 *     screens silently revert to the old art while the preview still looks new.
 *  2. The family is flat: one shared shape, one solid body, one solid shade, an
 *     ink outline and a cream paper edge. A gradient, a blur or a glow creeping
 *     back in means a second visual language has started.
 *  3. The arcade ranks are earned from recorded playtime (1h / 10h / 50h), so
 *     the meter, the hook and the session recorder have to stay wired.
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
const games = read("src/routes/_app/games.tsx");
const stage = read("src/components/games/GameStage.tsx");
const arcade = read("src/lib/games/arcade-record.ts");

await check("every surface draws the mark through the one Badge component", () => {
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
  // All five profile marks are defined in the record.
  for (const type of ["verified", "premium", "creator", "top_paws", "early_member"]) {
    assert.ok(vector.includes(`  ${type}: {`), `${type} is missing from the sticker record`);
  }
  assert.match(vector, /export function badgeTypeForSlug/);
  assert.match(vector, /replace\(\/_\/g, "-"\)/, "underscores and hyphens are both accepted");
  // Unmapped slugs return null so the sprite path keeps them.
  assert.match(vector, /if \(!slug\) return null;/);
});

await check("all eight marks share one die-cut sticker", () => {
  // One shape: the paper and body rects are constants, never per badge.
  assert.match(vector, /const PAPER = \{ x: [\d.]+, y: [\d.]+, width: [\d.]+, height: [\d.]+, rx: [\d.]+ \}/);
  assert.match(vector, /const BODY = \{ x: [\d.]+, y: [\d.]+, width: [\d.]+, height: [\d.]+, rx: [\d.]+ \}/);
  assert.match(vector, /<rect \{\.\.\.PAPER\} fill="#F4F1E7" \/>/, "the cream die-cut edge");
  assert.match(vector, /<rect \{\.\.\.BODY\} fill=\{def\.color\} \/>/, "the flat body");
  assert.match(vector, /fill=\{def\.shade\}/, "the flat lower shade");
  assert.match(vector, /const LIFT = "M/, "the lifted corner is part of the shape");
  assert.match(vector, /<path d=\{LIFT\}/, "the lifted corner is drawn on every mark");
  assert.match(vector, /stroke="#0B0B0B" strokeWidth=\{1\.9\}/, "one ink outline");
  // No per-badge silhouette: the shape is shared, the glyph is the difference.
  assert.ok(!/shape:\s*</.test(vector), "a badge still carries its own silhouette");
  assert.ok(!vector.includes("def.shape"), "a silhouette is drawn from the definition");

  // Flat means flat: no gradients, no filters, no blur, no glow.
  for (const banned of ["linearGradient", "radialGradient", "drop-shadow", "blur(", "def.glow"]) {
    assert.ok(!vector.includes(banned), `${banned} is back in the sticker set`);
  }

  // Every mark defines the same three flat inks.
  for (const type of [
    "verified",
    "premium",
    "early_member",
    "top_paws",
    "creator",
    "game_rookie",
    "game_fiend",
    "game_legend",
  ]) {
    const block = vector.slice(vector.indexOf(`  ${type}: {`), vector.indexOf(`  ${type}: {`) + 700);
    assert.match(block, /color: "#[0-9A-F]{6}"/, `${type} has no flat body`);
    assert.match(block, /shade: "#[0-9A-F]{6}"/, `${type} has no flat shade`);
    assert.match(block, /ink: "#[0-9A-F]{6}"/, `${type} has no ink`);
  }

  assert.match(vector, /const px = Math\.max\(16, Math\.round\(size\)\)/, "16px is the floor");
});

await check("arcade ranks are earned from recorded playtime", () => {
  assert.match(vector, /export type GameBadgeType = "game_rookie" \| "game_fiend" \| "game_legend"/);
  assert.match(vector, /export const GAME_BADGE_TYPES/);
  assert.match(vector, /useArcadePlayMs/, "the rank badge does not read the record");
  assert.match(vector, /hours >= 50 \? "game_legend" : hours >= 10 \? "game_fiend" : hours >= 1 \? "game_rookie"/);
  assert.match(vector, /formatPlaytime\(ms\)/, "the hint does not say how long was played");
  assert.match(vector, /next rank at/, "the hint does not name the next rung");
  assert.match(vector, /progress=\{progress\}/, "the meter is not driven by the playtime");
  assert.match(vector, /METER/, "there is no meter on the sticker");
  assert.match(vector, /export function GameRankBadge/);

  // The recorder and the session hook.
  assert.match(arcade, /export function recordArcadePlay/);
  assert.match(arcade, /export function arcadePlayMs/);
  assert.match(arcade, /export function useArcadeSession/);
  assert.match(arcade, /export function formatPlaytime/);
  assert.match(arcade, /MAX_SESSION_MS/, "an idle tab can credit unlimited hours");
  assert.match(arcade, /visibilityState === "hidden"/, "backgrounded time is still counted");
  assert.match(stage, /useArcadeSession\(entry\?\.id \?\? null, Boolean\(entry\)\)/, "games do not record time");
});

await check("the rank is visible on the games hub and the spec sheet", () => {
  assert.match(games, /ArcadeRankStrip/);
  assert.match(games, /GameRankBadge/);
  assert.match(games, /formatPlaytime\(ms\)/, "the hub does not show the hours");
  assert.match(preview, /ArcadeRanks/);
  assert.match(preview, /GAME_BADGE_TYPES\.map/);
  assert.match(preview, /DEMO_PROGRESS/);
  assert.match(preview, /1h \/ 10h \/ 50h/, "the spec sheet does not state the rungs");
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
  assert.match(chip, /tray\s*\? "w-max flex-nowrap whitespace-nowrap rounded-full border[^"]*gap-1|gap-1[\s\S]{0,120}?rounded-full/);
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
