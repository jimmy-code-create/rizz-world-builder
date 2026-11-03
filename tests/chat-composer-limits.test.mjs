/**
 * Chat composer, picker split and reaction limits.
 *
 * Static guards for the pass that:
 *  - collapsed the doubled chat-bar wrapper into one compact row,
 *  - made the smiley the emoji/server-emoji/GIF/sticker picker and the cat the
 *    cat-only picker,
 *  - capped reactions at 8 per person and supers at 1 per person per post,
 *  - let a super reaction be any emoji, not only a RIZZ cat,
 *  - replaced the red Radio glyph on the live launch control.
 *
 * Run: node tests/chat-composer-limits.test.mjs
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

const composer = read("src/components/chat/MessageComposer.tsx");
const realm = read("src/routes/_app/r.$slug.tsx");
const dm = read("src/routes/_app/dm.$userId.tsx");
const group = read("src/routes/_app/g.$id.tsx");
const gif = read("src/components/GifPicker.tsx");
const catSheet = read("src/components/chat/CatStickerSheet.tsx");
const reactions = read("src/lib/reactions.ts");
const chatReactions = read("src/lib/useChatReactions.ts");
const chips = read("src/components/chat/ReactionChips.tsx");
const postCard = read("src/components/PostCard.tsx");
const reactionPicker = read("src/components/chat/ReactionPicker.tsx");
const emojiPicker = read("src/components/emoji/EmojiPicker.tsx");
const burst = read("src/components/reactions/SuperReactionBurst.tsx");
const migration = read("supabase/migrations/20261118000000_reaction_limits.sql");
const live = read("src/components/live/LiveLaunchButton.tsx");
const liveIcon = read("src/components/live/RizzLiveIcon.tsx");

await check("one compact composer bar, not a stack of bars", () => {
  assert.ok(!composer.includes("chat-bar relative"), "the composer owns a second chat-bar");
  for (const [name, source] of [["realm", realm], ["dm", dm], ["group", group]]) {
    assert.ok(
      !source.includes('chat-bar relative z-20 shrink-0 border-t'),
      `${name} stacks a bar behind the composer`,
    );
  }
  assert.ok(composer.includes("minHeight: 40"), "the composer is not compact");
  assert.ok(composer.includes("bg-[#0a0a0a]"), "the composer is not a solid bar");
});

await check("smiley opens the full picker and cat opens only cats", () => {
  assert.ok(realm.includes("onEmoji={() => setGifOpen(true)}"), "smiley does not open the hub");
  assert.ok(realm.includes("onStickers={() => setCatOpen(true)}"), "cat does not open the cat sheet");
  assert.equal((realm.match(/<GifPicker/g) ?? []).length, 1, "duplicate emoji picker");
  assert.ok(!realm.includes("RealmEmojiPicker"), "the old emoji sheet is back");
  assert.ok(realm.includes("<CatStickerSheet"), "the realm has no cat-only picker");
  assert.ok(catSheet.includes("CAT_EMOJI_MANIFEST"), "the cat sheet is not the cat pack");
  assert.ok(!catSheet.includes("GifPicker"), "the cat sheet opens GIFs again");
});

await check("the emoji hub carries server categories, GIFs, stickers and settings", () => {
  assert.ok(gif.includes('["emoji", "Emoji", Smile]'), "no emoji tab");
  assert.ok(gif.includes('["gifs", "GIFs", Image]'), "no GIF tab");
  assert.ok(gif.includes('["stickers", "Stickers", Sparkles]'), "no sticker tab");
  assert.ok(gif.includes("This server"), "server emoji have no category");
  assert.ok(gif.includes("serverSectionRef"), "server category cannot be navigated");
  assert.ok(gif.includes("Manage server emoji in settings"), "no way to manage from settings");
  assert.ok(
    realm.includes('to: "/r/$slug/settings"') && realm.includes('section: "emoji"'),
    "Manage does not land on the settings emoji section",
  );
  assert.ok(realm.includes('initialTab="emoji"'), "the hub does not open on emoji");
});

await check("reactions stop at 8 and supers at 1 per person", () => {
  assert.ok(reactions.includes("MAX_REACTIONS_PER_MESSAGE = 8"), "no 8-reaction cap");
  assert.ok(reactions.includes("MAX_SUPER_REACTIONS = 1"), "no single-super cap");
  assert.ok(chatReactions.includes("mineOnMessage.size >= MAX_REACTIONS_PER_MESSAGE"), "chat add bypasses the cap");
  assert.ok(chips.includes("MAX_VISIBLE_CHIPS = 8"), "the chip row still stops at six");
  assert.ok(postCard.includes("mineCount >= MAX_REACTIONS_PER_MESSAGE"), "post add bypasses the cap");
  assert.ok(postCard.includes("withoutMySuper"), "a second super can stack");
  assert.ok(postCard.includes("fresh: !wasSuper"), "moving a super does not refresh it");
  assert.ok(reactionPicker.includes("MAX_REACTIONS_PER_MESSAGE"), "the picker hides the cap");
  assert.ok(migration.includes("enforce_message_reaction_limit"), "chat cap is not in the database");
  assert.ok(migration.includes("enforce_dm_reaction_limit"), "DM cap is not in the database");
  assert.ok(migration.includes("enforce_post_reaction_limit"), "post cap is not in the database");
  assert.ok(migration.includes("post_reactions_one_super_per_user"), "supers are not unique per person");
  assert.ok(migration.includes("kind = 'super'"), "the super RPC does not clear an older super");
});

await check("a super reaction can be any emoji, not only the RIZZ cat", () => {
  assert.ok(!emojiPicker.includes("{!accent && ("), "super mode still hides the other tabs");
  assert.ok(emojiPicker.includes("every tab stays"), "the picker still claims cats only");
  assert.ok(burst.includes("ReactionKeyGlyph"), "non-cat supers have no glyph");
  assert.ok(!burst.includes("burst.key.slice(0, 2)"), "non-cat supers print raw key text");
  assert.ok(burst.includes("cat.src"), "the cat sticker path is gone");
});

await check("the live launch mark is a RIZZ signal, not a red icon", () => {
  assert.ok(live.includes("RizzLiveIcon"), "the launch control still uses the old icon");
  assert.ok(!live.includes("Radio"), "the lucide radio icon is still imported");
  assert.ok(live.includes("live-signal-dot"), "the launch control has no lime signal dot");
  assert.ok(liveIcon.includes("<circle") && liveIcon.includes("strokeLinecap"), "the mark is not drawn");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
