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
  assert.ok(composer.includes("<EmojiPicker"), "the composer does not use the shared picker");
});

await check("one reaction component draws both kinds", () => {
  assert.ok(pills.includes("ce:"), "custom reactions are not understood");
  assert.ok(pills.includes("<EmojiGlyph"), "a custom reaction has no image path");
  assert.ok(pills.includes("<UnicodeGlyph"), "a unicode reaction has no glyph path");
  assert.ok(pills.includes("groupReactions"), "rows cannot be grouped into pills");
  assert.ok(pills.includes("onShowReactors"), "long-press has nowhere to go");
});

await check("comments render custom emoji", () => {
  assert.ok(commentBody.includes("<EmojiText"), "comment bodies still print the raw token");
});

await check("reels react with the shared tray and float the reaction", () => {
  const reels = read("src/routes/_app/reels.tsx");
  assert.ok(reels.includes("<ReactionTray"), "reels do not use the shared tray");
  assert.ok(reels.includes("reel-float-up"), "a reaction does not travel up the screen");
  assert.ok(reels.includes("slice(-11)"), "floating reactions are unbounded");
  assert.ok(reels.includes("customReactionId(floater.key)"), "custom reactions cannot float as images");
});

await check("the composer has a page, and the feed links to it", () => {
  const create = read("src/routes/_app/create.tsx");
  assert.ok(create.includes('createFileRoute("/_app/create")'), "no deep-linkable create route");
  assert.ok(create.includes("fullPage"), "the create page reuses the inline composer shell");
  assert.ok(composer.includes('to="/create"'), "the inline composer never leads to the page");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
