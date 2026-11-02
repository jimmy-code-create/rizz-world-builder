/**
 * Phase 0 — the shared emoji system.
 *
 * Static guards (no DOM, no bundler) per the repo convention: the migration
 * must make the data model possible, the client must parse both token forms,
 * and the picker must be the one shared component rather than a fourth copy.
 *
 * Run: node tests/shared-emoji.test.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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

const sql = read("supabase/migrations/20261111000000_shared_realm_emoji.sql");
const lib = read("src/lib/emoji-shared.ts");
const picker = read("src/components/emoji/EmojiPicker.tsx");
const glyph = read("src/components/emoji/EmojiGlyph.tsx");
const text = read("src/components/emoji/EmojiText.tsx");
const pills = read("src/components/reactions/ReactionPills.tsx");
const composer = read("src/components/PostComposer.tsx");
const commentBody = read("src/components/comments/CommentBody.tsx");

await check("a reaction key can be unicode or a custom emoji id", () => {
  assert.ok(sql.includes("length(emoji) BETWEEN 1 AND 64"), "the 16-char check still blocks custom keys");
  assert.ok(lib.includes('EMOJI_KEY_PREFIX = "ce:"'), "no shared reaction key prefix");
  assert.ok(lib.includes("customReactionId"), "a key cannot be parsed back to an id");
  assert.ok(lib.includes("emojiReactionKey"), "no way to build a custom reaction key");
});

await check("a realm owns its emoji and can turn off external use", () => {
  assert.ok(sql.includes("allow_external_emoji boolean NOT NULL DEFAULT true"), "no realm-level switch");
  assert.ok(sql.includes("realm_custom_emoji_status_check"), "removed emoji cannot be marked");
  assert.ok(sql.includes("idx_realm_emoji_active"), "the active lookup is unindexed");
});

await check("uploads are capped per realm", () => {
  assert.ok(sql.includes("v_cap constant integer := 50"), "the 50 emoji cap is missing");
  assert.ok(sql.includes("trg_realm_emoji_cap"), "the cap is not enforced");
  assert.ok(sql.includes("BEFORE INSERT"), "the cap does not run before an insert");
});

await check("one query returns every emoji the viewer may use", () => {
  assert.ok(sql.includes("FUNCTION public.joined_realm_emoji"), "no cross-realm picker query");
  assert.ok(sql.includes("JOIN public.realm_members"), "the query does not scope to joined realms");
  assert.ok(sql.includes("e.status = 'active'"), "removed emoji are still offered");
  assert.ok(sql.includes("OR r.id = _realm_id"), "a realm's own emoji are hidden inside it");
});

await check("removed emoji still resolve for old messages", () => {
  assert.ok(sql.includes("FUNCTION public.emoji_lookup"), "no lookup by id for old text");
  assert.ok(sql.includes("WHERE e.id = ANY(_ids)"), "lookup does not match the ids it is given");
  assert.ok(!sql.includes("DELETE FROM public.realm_custom_emoji"), "removal deletes the row");
});

await check("report and remove are server-checked", () => {
  assert.ok(sql.includes("FUNCTION public.report_realm_emoji"), "emoji cannot be reported");
  assert.ok(sql.includes("FUNCTION public.remove_realm_emoji"), "emoji cannot be removed");
  assert.ok(sql.includes("NOT IN ('owner', 'admin')"), "any member could remove an emoji");
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.realm_emoji_reports"), "no reports table");
});

await check("text stores <:shortcode:id> and degrades to :shortcode:", () => {
  assert.ok(lib.includes("emojiToken"), "no stored-token helper");
  assert.ok(lib.includes("<:${emoji.shortcode}:${emoji.id}>"), "the token format changed");
  assert.ok(lib.includes("splitEmojiText"), "no token parser");
  assert.ok(
    lib.includes("else pieces.push({ kind: \"text\", text: match[0] });"),
    "an unknown shortcode is dropped instead of printed",
  );
  assert.ok(glyph.includes(":{shortcode ?? \"emoji\"}:"), "the fallback is not the shortcode");
  assert.ok(text.includes("useEmojiLookup"), "the renderer never resolves ids");
});

await check("the picker has recents, defaults, per-realm tabs and search", () => {
  assert.ok(picker.includes("Recent"), "no recents tab");
  assert.ok(picker.includes("Default"), "no default tab");
  assert.ok(picker.includes("groupByRealm"), "no per-realm tabs");
  assert.ok(picker.includes("Search shortcodes"), "no shortcode search");
  assert.ok(picker.includes("readRecentEmoji"), "recents are not read");
  assert.ok(picker.includes("rememberEmoji"), "picks are not remembered");
  assert.ok(composer.includes("<GifPicker"), "the composer does not use the shared emoji/GIF picker");
});

await check("one reaction component draws both kinds", () => {
  assert.ok(pills.includes("ce:"), "custom reactions are not understood");
  assert.ok(pills.includes("<EmojiGlyph"), "a custom reaction has no image path");
  assert.ok(pills.includes("<UnicodeGlyph"), "a unicode reaction has no glyph path");
  assert.ok(pills.includes("groupReactions"), "rows cannot be grouped into pills");
  assert.ok(pills.includes("onShowReactors"), "long-press has nowhere to go");
});

await check("a post reacts with the shared picker and shows custom pills", () => {
  const card = read("src/components/PostCard.tsx");
  assert.ok(card.includes("<EmojiPicker"), "the post card never opens the shared picker");
  assert.ok(
    card.includes("emojiReactionKey(pick.emoji.id)"),
    "a custom pick does not become a ce: reaction key",
  );
  assert.ok(card.includes("<ReactionPills"), "posts still hand-roll reaction chips");
  assert.ok(card.includes("groupReactions"), "post reactions are not grouped into pills");
  assert.ok(!card.includes("QUICK_EMOJIS"), "the fixed eight-emoji tray is back");
  assert.ok(!card.includes("PostCommentsButton"), "the expand button returned to the action row");
  const sheet = read("src/components/reactions/PostReactionsSheet.tsx");
  assert.ok(sheet.includes("<ReactionKeyGlyph"), "reactor lists print the raw ce: key");
});

await check("comments render custom emoji", () => {
  assert.ok(commentBody.includes("<EmojiText"), "comment bodies still print the raw token");
});

await check("reels double tap likes without a reaction stream", () => {
  const reels = read("src/routes/_app/reels.tsx");
  assert.ok(!reels.includes("<ReactionTray"), "the react tray is still in reels");
  assert.ok(!reels.includes('label="React"'), "the react action button is still in reels");
  assert.ok(!reels.includes("STREAM_GLYPHS"), "the emoji stream is still in reels");
  assert.ok(!reels.includes("reel-stream-up"), "the stream animation is still in reels");
  assert.ok(reels.includes("hapticReaction()"), "the double tap has no feedback pulse");
  assert.ok(reels.includes("void doLike(true)"), "the double tap no longer likes the reel");
  assert.ok(reels.includes("reel-sticker-pop"), "the double-tap sticker was removed too");
});

await check("the composer stays inline and the separate create page is gone", () => {
  assert.ok(!existsSync(new URL("../src/routes/_app/create.tsx", import.meta.url)), "the /create page is back");
  assert.ok(!composer.includes('to="/create"'), "the composer still links to /create");
  assert.ok(!composer.includes("fullPage"), "the composer still carries the page-only shell");
  assert.ok(composer.includes("<GifPicker"), "the composer does not use the shared emoji/GIF picker");
});

await check("the post footer keeps pills and drops the extra entry points", () => {
  const card = read("src/components/PostCard.tsx");
  assert.ok(!card.includes("PostCommentsButton"), "the expand button is back");
  assert.ok(!card.includes("View all reactions"), "the extra reactors button is back");
  assert.ok(card.includes("<ReactionPills"), "the pill row was removed too");
  assert.ok(card.includes("<EmojiPicker"), "the react picker is gone as well");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
