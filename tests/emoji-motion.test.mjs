/**
 * Animated emoji, one layer.
 *
 * Reactions are the app's smallest expressive gesture, so the motion has to be
 * cheap enough to sit in a thread of a hundred comments and quiet enough not to
 * flicker while you read. This holds that shape:
 *
 *  1. `AnimatedEmoji` is the only glyph renderer for reactions — unicode and the
 *     app's cat emoji both go through it, so they share one hover/pop contract.
 *  2. The motion is CSS keyframes, not a Lottie/animation runtime in the
 *     bundle, and every keyframe is switched off for reduced motion.
 *  3. A reaction pops when it is new, and only then; the rest of the thread
 *     stays still until hovered.
 *
 * Run: node tests/emoji-motion.test.mjs
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

const emoji = read("src/components/motion/AnimatedEmoji.tsx");
const css = read("src/styles.css");
const thread = read("src/components/comments/CommentThread.tsx");
const chip = read("src/components/reactions/ReactionChipButton.tsx");
const picker = read("src/components/chat/ReactionPicker.tsx");
const pkg = JSON.parse(read("package.json"));

await check("one primitive draws both unicode and cat emoji", () => {
  assert.match(emoji, /export function AnimatedEmoji\(/);
  assert.match(emoji, /emoji\.startsWith\(":"\) \? catNameForShortcode\(emoji\)/);
  assert.match(emoji, /<CatEmoji name=\{cat\} size=\{size\} animate=\{catMotion\} \/>/);
  assert.match(emoji, /className="motion-emoji__glyph"/);
  assert.match(emoji, /export type EmojiMotion = "none" \| "hover" \| "pop" \| "loop"/);
});

await check("a pop can be replayed by changing popKey", () => {
  assert.match(emoji, /popKey\?: string \| number/);
  assert.match(emoji, /<span key=\{popKey\} className="motion-emoji__body">/);
});

await check("the motion is CSS keyframes, with no new runtime on the hot path", () => {
  for (const keyframe of ["emoji-pop", "emoji-wobble", "emoji-bob", "emoji-burst"]) {
    assert.ok(css.includes(`@keyframes ${keyframe}`), `${keyframe} exists`);
  }
  assert.match(css, /\.motion-emoji--hover:hover \.motion-emoji__body,/);
  assert.match(css, /button:hover \.motion-emoji--hover \.motion-emoji__body,/);
  assert.match(css, /\.motion-emoji--pop \.motion-emoji__body \{[\s\S]{0,120}?animation: emoji-pop/);
  assert.match(css, /\.motion-emoji--loop \.motion-emoji__body \{[\s\S]{0,120}?animation: emoji-bob/);
  assert.ok(
    !/lottie|framer-motion|motion\/react/i.test(emoji),
    "a reaction glyph must not pull in an animation runtime",
  );
});

await check("the suite runs this file", () => {
  assert.match(pkg.scripts.test, /node tests\/emoji-motion\.test\.mjs/);
});

await check("reduced motion switches every new keyframe off", () => {
  const media = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .motion-emoji__body"));
  assert.ok(media.length > 0, "the reduced-motion block exists");
  assert.match(media, /\.motion-emoji__body,\s*\n\s*\.motion-emoji--pop::after \{ animation: none !important; \}/);
  assert.match(media, /\.motion-icon \{ transition: none !important; \}/);
  assert.match(
    css,
    /\[data-reduced-motion="true"\] \.motion-emoji__body,\s*\n\[data-reduced-motion="true"\] \.motion-emoji--pop::after \{ animation: none !important; \}/,
    "the app's own toggle is honoured too",
  );
});

await check("icons get a hover lift and a press that gives", () => {
  assert.match(css, /\.motion-icon \{[\s\S]{0,200}?transition: transform 200ms/);
  assert.match(css, /button:hover > \.motion-icon,[\s\S]{0,80}?transform: translateY\(-1px\) scale\(1\.1\)/);
  assert.match(css, /button:active > \.motion-icon \{[\s\S]{0,80}?transform: scale\(0\.9\)/);
});

await check("a comment reaction pops when it is new, not on every render", () => {
  assert.match(thread, /function useFreshEmoji\(emoji: string\[\]\): Set<string>/);
  assert.match(thread, /previous\.current = next;/, "the previous set advances after comparing");
  assert.match(
    thread,
    /window\.setTimeout\(\(\) => setHeld\(new Set\(\)\), 600\)/,
    "the pop is held long enough to finish",
  );
  assert.match(thread, /const freshEmoji = useFreshEmoji\(groups\.map\(\(group\) => group\.emoji\)\)/);
  assert.match(
    thread,
    /motion=\{freshEmoji\.has\(group\.emoji\) \? "pop" : "hover"\}/,
    "only the reaction that just landed pops",
  );
});

await check("the comment tray and its actions use the animated glyphs", () => {
  assert.match(thread, /<AnimatedEmoji emoji=\{emoji\} size=\{compact \? 19 : 22\} motion="hover" \/>/);
  assert.match(thread, /<AnimatedEmoji emoji=\{emoji\} size=\{17\} motion="hover" \/>/);
  assert.match(thread, /<CornerDownRight className="motion-icon h-3\.5 w-3\.5" \/>/);
  assert.match(thread, /<Trash2 className="motion-icon h-3\.5 w-3\.5" \/>/);
  assert.match(thread, /<SmilePlus className="motion-icon h-3\.5 w-3\.5" \/>/);
});

await check("a chip pops when its count grows", () => {
  assert.match(chip, /const previousCount = useRef\(count\);/);
  assert.match(chip, /const grew = count > previousCount\.current;/);
  assert.match(chip, /motion=\{grew \? "pop" : "hover"\}/);
  assert.ok(!chip.includes("<span aria-hidden className=\"leading-none\">"), "the raw glyph is gone");
});

await check("the chat reaction picker shares the same glyphs", () => {
  assert.match(picker, /<AnimatedEmoji emoji=\{emoji\} size=\{22\} motion="hover" \/>/);
  assert.match(picker, /<AnimatedEmoji emoji=\{emoji\} size=\{18\} motion="hover" \/>/);
  assert.ok(
    !picker.includes("hover:scale-110"),
    "the tile no longer zooms on hover — the glyph does",
  );
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
