/**
 * Super reactions — the Purify-gated second tier.
 *
 * Static guards, same convention as the other suites: the database must be
 * able to tell a normal row from a super one, the toggle must stay a toggle,
 * and a database without the migration must keep the normal feature working.
 *
 * Run: node tests/super-reactions.test.mjs
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

const sql = read("supabase/migrations/20261112000000_post_super_reactions.sql");
const posts = read("src/lib/posts.ts");
const card = read("src/components/PostCard.tsx");
const pills = read("src/components/reactions/ReactionPills.tsx");
const sheet = read("src/components/reactions/PostReactionsSheet.tsx");
const picker = read("src/components/emoji/EmojiPicker.tsx");
const reels = read("src/routes/_app/reels.tsx");
const styles = read("src/styles.css");
const lengthSql = read("supabase/migrations/20261113000000_post_reaction_key_length.sql");
const composer = read("src/components/PostComposer.tsx");
const burst = read("src/components/reactions/SuperReactionBurst.tsx");

await check("a reaction row can be normal or super", () => {
  assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'normal'"), "no kind column");
  assert.ok(sql.includes("post_reactions_kind_check"), "kind is unconstrained");
  assert.ok(sql.includes("CHECK (kind IN ('normal', 'super'))"), "an unknown kind can be stored");
  assert.ok(!sql.includes("DROP CONSTRAINT IF EXISTS post_reactions_pkey"), "the primary key was rewritten");
});

await check("the super toggle is a toggle, not a second row", () => {
  assert.ok(sql.includes("FUNCTION public.toggle_post_super_reaction"), "no super toggle RPC");
  assert.ok(sql.includes("IF _kind = 'super' THEN"), "a super row cannot be removed");
  assert.ok(sql.includes("IF _kind = 'normal' THEN"), "a normal row is not upgraded");
  assert.ok(sql.includes("VALUES (_post_id, _uid, _emoji, 'super')"), "the row is not stored as super");
  assert.ok(sql.includes("SECURITY INVOKER"), "RLS is bypassed");
});

await check("reading reactions survives a database without the migration", () => {
  assert.ok(posts.includes("isMissingKind"), "the missing-column case is not handled");
  assert.ok(posts.includes('select("emoji, user_id")'), "no fallback query without kind");
  assert.ok(posts.includes("kind: \"normal\" as const"), "fallback rows are not normal");
  assert.ok(posts.includes("useSuperReactionsSupport"), "the UI cannot detect support");
});

await check("the pill shows which reactions are super", () => {
  assert.ok(pills.includes("superCount"), "the pill has no super count");
  assert.ok(pills.includes("<Sparkles"), "a super pill has no mark");
  assert.ok(pills.includes("Number((b.superCount ?? 0) > 0)"), "super pills do not lead the row");
});

await check("only Purify members can send one", () => {
  assert.ok(card.includes("usePurify"), "the post card never checks the tier");
  assert.ok(card.includes("Super reactions are a Purify perk"), "locked members get no explanation");
  assert.ok(card.includes("toggleSuperReaction"), "the card cannot send a super reaction");
  assert.ok(card.includes("superSupport.data === true"), "the toggle ignores the database");
});

await check("a realm emoji key is not rejected by the toggle RPC", () => {
  assert.ok(lengthSql.includes("FUNCTION public.toggle_post_reaction"), "the toggle RPC is not replaced");
  assert.ok(lengthSql.includes("NOT BETWEEN 1 AND 64"), "the 16-character guard still rejects ce: keys");
  assert.ok(lengthSql.includes("CHECK (length(emoji) BETWEEN 1 AND 64)"), "the column is not widened");
});

await check("reacting gives a small vibration", () => {
  assert.ok(card.includes("hapticReaction()"), "post reactions do not vibrate");
  assert.ok(reels.includes("hapticReaction()"), "the reel double tap does not vibrate");
});

await check("the picker offers a super switch and the sheet marks supers", () => {
  assert.ok(picker.includes("footer"), "the picker has no slot for the switch");
  assert.ok(card.includes("footer={"), "the post card never passes the switch");
  assert.ok(sheet.includes('select("emoji, user_id, created_at, kind")'), "the sheet does not read kind");
  assert.ok(sheet.includes("item.kind === \"super\""), "supers are not marked in the reactor list");
});

await check("super mode is visible while picking", () => {
  assert.ok(picker.includes("accent?: boolean"), "the picker has no mode accent");
  assert.ok(picker.includes("<Sparkles"), "super mode leaves no mark on the sheet");
  assert.ok(card.includes("accent={superMode && canSendSuper}"), "the post card never passes the accent");
  assert.ok(card.includes("linear-gradient(120deg,rgba(180,124,255,0.3)"), "the switch is not the pill's gradient");
  assert.ok(pills.includes("super-reaction-in"), "a super pill does not pop in");
  assert.ok(styles.includes("super-reaction-in"), "the pop-in keyframes are missing");
  assert.ok(pills.includes('"h-7 gap-1 px-2 text-[12px]"'), "pills do not share one height");
  assert.ok(!pills.includes("h-8 gap-1"), "a super pill is still taller than a normal one");
  assert.ok(!pills.includes("text-[20px]"), "a super glyph is still larger than a normal one");
  assert.ok(pills.includes('className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}'), "glyphs are not one size");
});

await check("the super burst cat actually performs", () => {
  assert.ok(burst.includes('animate="loop"'), "the burst cat is still a frozen frame");
  assert.ok(burst.includes("super-burst-cat-body"), "the cat has no idle motion layer");
  assert.ok(styles.includes("super-burst-cat-bob"), "the idle layer has no keyframes");
  assert.ok(styles.includes("super-burst-streak"), "the launch has no speed streaks");
});

await check("the composer keeps one emoji control", () => {
  assert.ok(!composer.includes("Add a realm emoji"), "the duplicate smiley button is back");
  assert.ok(!composer.includes("setEmojiOpen"), "the old emoji sheet is still mounted");
  assert.equal(
    (composer.match(/<GifPicker/g) ?? []).length,
    1,
    "the shared emoji/GIF picker is not the one control",
  );
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
