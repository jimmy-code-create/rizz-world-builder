/**
 * The emoji picker, held to the shape the redesign promised.
 *
 * These are source-level checks on purpose: the project's other UI tests work
 * the same way (no DOM harness), and what matters here is structural — every
 * sheet opens from code that is already loaded, the grid mounts only the rows
 * near the viewport, and Microsoft Fluent artwork is layered over the system
 * glyph so a cell is never blank while an SVG decodes.
 *
 * Run: node tests/emoji-picker.test.mjs
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

const smileys = read("src/lib/smiley-data.ts");
const panel = read("src/components/emoji/RizzEmojiPanel.tsx");
const emojiPicker = read("src/components/emoji/EmojiPicker.tsx");
const gifPicker = read("src/components/GifPicker.tsx");
const realmPicker = read("src/components/chat/RealmEmojiPicker.tsx");
const fluent = read("src/components/emoji/FluentEmoji.tsx");
const unicode = read("src/lib/unicode-emoji.ts");
const css = read("src/components/emoji/picker.css");

await check("one smiley table is searchable by name and tags", () => {
  assert.match(smileys, /export const SMILEY_EMOJI/);
  assert.match(smileys, /export const SMILEY_CHARS[\s\S]{0,80}new Set\(/);
  assert.match(smileys, /export function searchSmileys/);
  assert.match(smileys, /name/);
  assert.match(smileys, /tags/);
  assert.match(panel, /searchSmileys\(term\)/);
  assert.match(panel, /No smiley matches/);
});

await check("the grid mounts only the rows near the viewport", () => {
  assert.match(panel, /const CELL_H = 48;/);
  assert.match(panel, /const OVERSCAN = 160;/);
  assert.match(panel, /const windowStart = viewport\.top - OVERSCAN;/);
  assert.match(panel, /const windowEnd = viewport\.top \+ viewport\.height \+ OVERSCAN;/);
  assert.match(panel, /top \+ height < windowStart \|\| top > windowEnd/);
  assert.match(panel, /className="rizz-emoji-grid absolute inset-x-0"/);
  assert.ok(!/emoji-rail/.test(panel), "the old category rail is gone");
  assert.ok(!/emoji-section-head/.test(panel), "sections are not measured or stickied");
});

await check("a cell paints its glyph, then Fluent art covers it", () => {
  assert.match(panel, /<FluentEmoji glyph=\{cell\.char\} size=\{28\} \/>/);
  assert.match(panel, /className="emoji-cell__char"/);
  assert.match(
    css,
    /\.emoji-cell__glyph > \.fluent-emoji\[data-loaded="true"\] \+ \.emoji-cell__char/,
    "the system glyph hides only after the artwork decodes",
  );
  assert.match(fluent, /export function fluentEmojiUrl/);
  assert.match(fluent, /URL_CACHE/);
  assert.match(fluent, /onLoad=\{\(event\) => \{\s*event\.currentTarget\.dataset\.loaded = "true";/);
  assert.match(fluent, /onError=\{\(\) => setFailed\(true\)\}/);
});

await check("glyphs with no Fluent asset keep the system character", () => {
  // Country flags are not in the Fluent set: the fallback must print the glyph
  // inside text runs instead of leaving an empty box.
  assert.match(fluent, /fallbackGlyph\?: boolean/);
  assert.match(fluent, /fallbackGlyph \? glyph : null/);
});

await check("the composer panel and the post sheet share the smiley table", () => {
  assert.match(emojiPicker, /@\/lib\/smiley-data/);
  assert.match(gifPicker, /<RizzEmojiPanel/);
  // The realm sheet delegates instead of mounting its own unicode list.
  assert.match(realmPicker, /<RizzEmojiPanel/);
  assert.match(realmPicker, /tab === "custom"/);
  assert.match(realmPicker, /useUploadEmoji/);
});

await check("every picker is loaded with its screen, not fetched on first tap", () => {
  assert.match(gifPicker, /import \{ RizzEmojiPanel \} from "@\/components\/emoji\/RizzEmojiPanel";/);
  assert.ok(!/lazy\(|Suspense|EmojiPanelSkeleton/.test(gifPicker), "no lazy chunk or skeleton");
  assert.match(emojiPicker, /import \{ FluentEmoji \}/);
  assert.match(emojiPicker, /import "\.\/picker\.css"/);
});

await check("the post sheet's default tab is virtualised as well", () => {
  assert.match(emojiPicker, /function VirtualSmileyGrid/);
  assert.match(emojiPicker, /const SMILEY_ROW_H = 40;/);
  assert.match(emojiPicker, /rows\.slice\(start, end\)/);
  assert.match(emojiPicker, /<VirtualSmileyGrid onPick=\{chooseUnicode\} \/>/);
  assert.ok(
    !/SMILEY_EMOJI\.map\(\(\{ char, name \}\) => \(/.test(emojiPicker),
    "the default tab no longer mounts all ~750 cells at once",
  );
});

await check("the sheet picks once, and chat can keep it open", () => {
  assert.match(gifPicker, /keepOpenOnPick = false/);
  assert.match(gifPicker, /if \(!keepOpenOnPick\) setOpen\(false\)/);
  assert.match(gifPicker, /const handleEmojiPick = useCallback\(\(token: string\) => closeAnd\(token\)/);
  // The panel records the recency itself, then calls exactly one callback.
  assert.match(panel, /recordEmojiUse\(cell\.token, realmId\)/);
  assert.match(
    panel,
    /if \(onPick\) onPick\(cell\.token, cell\.token\);\s*\n\s*else onEmoji\?\.\(cell\.token\);/,
  );
});

await check("tab switching is transform-only and the picker is contained", () => {
  assert.match(css, /contain: layout paint/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /transition: transform 200ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.match(css, /\.rizz-seg__indicator/);
  assert.ok(!/backdrop-filter\s*:/.test(css), "no backdrop-filter in the picker");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.emoji-cell,/);
});

await check("unicode is split once, by grapheme, and a single glyph is recognised", () => {
  assert.match(unicode, /new Intl\.Segmenter/);
  assert.match(unicode, /export function splitUnicodeEmoji/);
  assert.match(unicode, /export function isSingleEmoji/);
  assert.match(unicode, /\\p\{Extended_Pictographic\}/);
  assert.match(unicode, /\\p\{Regional_Indicator\}/);
});

await check("the suite runs this file", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.test, /node tests\/emoji-picker\.test\.mjs/);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
