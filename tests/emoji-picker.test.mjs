/**
 * The emoji picker, held to the shape the redesign promised.
 *
 * These are source-level checks on purpose: the project's other UI tests work
 * the same way (no DOM harness), and what matters here is structural — the
 * section order, the rail contract, the things that must never be animated with
 * layout, and the storage keys old messages still depend on.
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

const data = read("src/lib/emoji-data.ts");
const prefs = read("src/lib/emoji-recents.ts");
const realms = read("src/lib/emoji-realms.ts");
const panel = read("src/components/emoji/RizzEmojiPanel.tsx");
const picker = read("src/components/GifPicker.tsx");
const css = read("src/components/emoji/picker.css");
const realm = read("src/routes/_app/r.$slug.tsx");
const composer = read("src/components/chat/RealmComposer.tsx");

await check("the dataset covers all nine unicode categories", () => {
  for (const label of [
    "Smileys",
    "People",
    "Animals",
    "Food",
    "Activities",
    "Travel",
    "Objects",
    "Symbols",
    "Flags",
  ]) {
    assert.match(data, new RegExp(`label: "${label}"`), `${label} exists`);
  }
  assert.match(data, /export const EMOJI_CATEGORIES/);
  assert.match(data, /export function searchUnicodeEmoji/);
  assert.match(data, /export function withSkinTone/);
  assert.match(data, /export const SKIN_TONES/);
});

await check("skin tones only apply where the glyph supports a modifier", () => {
  assert.match(data, /tone\?: boolean/);
  assert.match(data, /export function supportsSkinTone/);
  assert.match(data, /const TONED = \/\[\\u\{1F3FB\}-\\u\{1F3FF\}\]\/u/);
  assert.match(panel, /supportsSkinTone\(preview\.item\.char\)/);
});

await check("recents, favorites and per-realm counts live in one external store", () => {
  assert.match(prefs, /useSyncExternalStore/);
  assert.match(prefs, /const STORAGE_KEY = "rizz:emoji-prefs:v1"/);
  assert.match(prefs, /export function recordEmojiUse/);
  assert.match(prefs, /export function toggleEmojiFavorite/);
  assert.match(prefs, /export function topEmojiForRealm/);
  assert.match(prefs, /realmId -> emojiKey -> times used/);
  // The picker must survive a blocked or full localStorage.
  assert.match(prefs, /catch \{\s*\n\s*\/\/ A corrupted or blocked store/);
});

await check("realm sections are current-realm-first and know about locks", () => {
  assert.match(realms, /export type EmojiRealmSection/);
  assert.match(realms, /isMember: boolean/);
  assert.match(realms, /allowExternal: boolean/);
  assert.match(realms, /if \(a\.id === current\.id\) return -1;/);
  assert.match(realms, /emoji_external_allowed\?: boolean \| null/);
});

await check("the section order is Top, Recent, Favorites, realms, unicode", () => {
  const order = [
    "header(\n              `Top emoji in",
    'header("Recently used"',
    'header("Favorites"',
    "decoratedSections.map(({ section, items }) => (",
    "EMOJI_CATEGORIES.map((category) => (",
  ].map((needle) => panel.indexOf(needle));
  assert.ok(order.every((index) => index >= 0), "every section is rendered");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "sections keep their order");
  assert.match(panel, /`Top emoji in \$\{realmName \?\? "this realm"\}`/);
});

await check("the rail scrolls to a section and follows the scroll", () => {
  assert.match(panel, /role="tablist"/);
  assert.match(panel, /aria-selected=\{active\}/);
  assert.match(panel, /scrollIntoView\(\{/);
  assert.match(panel, /const onScroll = \(\) => \{/);
  assert.match(panel, /window\.requestAnimationFrame\(measure\)/, "the spy is frame-throttled");
  assert.match(panel, /emoji-rail__btn--active/);
  assert.match(panel, /emoji-rail__lock/);
});

await check("the grid is nine columns of 40px targets with text glyphs", () => {
  assert.match(css, /grid-template-columns: repeat\(9, minmax\(0, 1fr\)\)/);
  assert.match(css, /min-height: 40px/);
  assert.match(css, /\.emoji-cell__glyph \{\s*\n\s*font-size: 32px/);
  assert.match(panel, /item\.url \? \(/);
  assert.match(panel, /<span aria-hidden="true" className="emoji-cell__glyph">/);
});

await check("custom emoji are fixed-size, lazy and only play when near the viewport", () => {
  assert.match(panel, /width=\{32\}/);
  assert.match(panel, /height=\{32\}/);
  assert.match(panel, /loading="lazy"/);
  assert.match(panel, /decoding="async"/);
  assert.match(panel, /if \(!visible\) return null;/);
  assert.match(panel, /new IntersectionObserver/);
});

await check("locked emoji are dimmed with a badge and explain themselves", () => {
  assert.match(panel, /emoji-cell--locked/);
  assert.match(panel, /emoji-cell__lock/);
  assert.match(panel, /Join this realm to use its emoji in chat\./);
  assert.match(panel, /toast\.info\(`\$\{item\.realmName \?\? "That realm"\} emoji are locked here`/);
});

await check("long-press opens a preview with a favorite toggle and tones", () => {
  assert.match(panel, /`\$\{preview\.item\.name\} preview`/);
  assert.match(panel, /data-emoji-preview/);
  assert.match(panel, /toggleEmojiFavorite\(preview\.item\.key\)/);
  assert.match(panel, /aria-pressed=\{prefs\.favoriteKeys\.has\(preview\.item\.key\)\}/);
  assert.match(panel, /emoji-preview__tones/);
  assert.match(panel, /onPointerDown=\{\(event\) => \{/);
});

await check("search is debounced and grouped, with an empty state", () => {
  assert.match(panel, /useDebouncedValue\(query, 120\)/);
  assert.match(panel, /searchUnicodeEmoji\(term, 120\)/);
  assert.match(panel, /searchResults\.realms\.map/);
  assert.match(panel, /No emoji match/);
});

await check("the sheet has pill tabs, a sliding indicator and one search field", () => {
  assert.match(picker, /const TABS: Array<\{ id: PickerTab; label: string; icon: typeof Smile \}>/);
  assert.match(picker, /{ id: "emoji", label: "Emoji", icon: Smile }/);
  assert.match(picker, /{ id: "gifs", label: "GIFs", icon: Image }/);
  assert.match(picker, /{ id: "stickers", label: "Stickers", icon: Sparkles }/);
  assert.match(picker, /rizz-seg__indicator/);
  assert.match(picker, /transform: `translateX\(\$\{indicatorIndex \* 100\}%\)`/);
  assert.match(picker, /emoji: "Find the perfect emoji"/);
  assert.match(picker, /aria-label="Clear search"/);
  assert.match(picker, /<RizzEmojiPanel/);
});

await check("the picker stays open for multiple emoji, and the trigger is unchanged", () => {
  assert.match(picker, /const pickEmoji = \(token: string, emoji: Parameters<typeof rememberEmojiPick>\[0\]\) => \{/);
  assert.match(picker, /onSelect\(token\);\s*\n\s*rememberEmojiPick\(emoji, realmId\);/);
  assert.match(picker, /className=\{`shrink-0 text-primary \$\{triggerClassName \?\? ""\}`\}/);
});

await check("picking writes through the same storage format messages already use", () => {
  // `:name:` custom tokens and raw unicode chars: unchanged from the old picker.
  assert.match(panel, /token: `:\$\{name\}:`/);
  assert.match(panel, /return \{ key, token: char, name: meta\?\.name \?\? char, char \};/);
  assert.match(data, /export const realmEmojiKeyFor = \(realmId: string, name: string\) => `r:\$\{realmId\}:\$\{name\}`/);
});

await check("custom emoji use the shared size variable and jumbo when alone", () => {
  assert.ok(realm.includes("chat-inline-emoji"));
  assert.match(realm, /const isJumboji = !hasText && emojiCount > 0;/);
  assert.match(realm, /inline-block h-12 w-12 align-middle/);
  assert.match(realm, /emojiTextClass\(bodyText, "chat"\)/);
});

await check("the picker CSS is transform-only, contained and motion-safe", () => {
  assert.match(css, /contain: layout paint/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /content-visibility: auto/);
  assert.match(css, /transition: transform 80ms ease-out/);
  assert.match(css, /\.emoji-cell:active \{\s*\n\s*transform: scale\(0\.92\)/);
  assert.match(css, /\.rizz-picker\[data-state="open"\] \{\s*\n\s*animation-duration: 240ms/);
  assert.ok(!/backdrop-filter\s*:/.test(css), "no backdrop-filter in the picker");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\[data-reduced-motion="true"\] \.emoji-cell/);
});

await check("the composer never re-renders the picker or the list", () => {
  // The picker gets no composer text at all — only its own query.
  assert.ok(!/RizzEmojiPanel[\s\S]{0,400}?value=\{text\}/.test(picker), "no composer value is passed down");
  assert.ok(!panel.includes("const [text, setText]"), "the panel owns no composer text");
  assert.match(composer, /const \[text, setText\] = useState\(""\)/);
  assert.ok(!realm.includes("setBody"), "the route no longer owns composer text");
  assert.match(realm, /<RealmComposer/);
});

await check("the suite runs this file", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.test, /node tests\/emoji-picker\.test\.mjs/);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
