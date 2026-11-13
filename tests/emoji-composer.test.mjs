/**
 * Custom emoji: the token format, the inline composer, and the one endpoint.
 *
 * Source-level checks, like the rest of the suite (no DOM harness). They pin
 * the four contracts that broke in the field:
 *
 *  1. The stored form is `<:name:uuid>` (`<a:…>` animated) and nothing else.
 *  2. The composer draws an emoji as a picture and rebuilds the token on read.
 *  3. The picker asks the same question in every context — never a realm id.
 *  4. An emoji that cannot be drawn falls back to `:name:`, never a uuid.
 *
 * Run: node tests/emoji-composer.test.mjs
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

const token = read("src/lib/emoji-token.ts");
const input = read("src/components/chat/ComposerInput.tsx");
const composer = read("src/components/chat/MessageComposer.tsx");
const realmComposer = read("src/components/chat/RealmComposer.tsx");
const panel = read("src/components/emoji/RizzEmojiPanel.tsx");
const available = read("src/lib/emoji-available.ts");
const endpoint = read("src/routes/api.emojis.available.ts");
const imageEndpoint = read("src/routes/api.emojis.$id.image.ts");
const glyph = read("src/components/emoji/EmojiGlyph.tsx");
const realmImage = read("src/components/emoji/RealmEmojiImage.tsx");
const realmRoute = read("src/routes/_app/r.$slug.tsx");
const postComposer = read("src/components/PostComposer.tsx");
const dm = read("src/routes/_app/dm.$userId.tsx");
const group = read("src/routes/_app/g.$id.tsx");
const css = read("src/components/emoji/picker.css");
const migration = read("supabase/migrations/20261119000000_emoji_available_and_index.sql");
const unicode = read("src/lib/unicode-emoji.ts");
const fluent = read("src/components/emoji/FluentEmoji.tsx");
const textRenderer = read("src/lib/cat-emoji-text.tsx");

await check("the token regex is the documented one, in both directions", () => {
  assert.match(
    token,
    /EMOJI_TOKEN_SOURCE = "<\(a\?\):\(\[A-Za-z0-9_\]\+\):\(\[0-9a-fA-F-\]\{36\}\)>"/,
  );
  assert.match(token, /export function parseEmojiToken/);
  assert.match(token, /export function buildEmojiToken/);
  assert.match(token, /`<\$\{input\.animated \? "a" : ""\}:\$\{input\.name\}:\$\{input\.id\}>`/);
});

await check("ComposerInput is the field, and it is contenteditable", () => {
  assert.match(input, /contentEditable=\{!disabled\}/);
  assert.match(input, /whitespace-pre-wrap/);
  assert.match(input, /data-placeholder=\{placeholder\}/);
  assert.match(input, /export type ComposerInputHandle/);
  for (const method of ["getValue", "insertEmoji", "insertText", "clear", "focus"]) {
    assert.match(input, new RegExp(`${method}:`), `${method} is exposed`);
  }
});

await check("an emoji in the field is an img[data-token] at the shared size", () => {
  assert.match(input, /image\.dataset\.token = parts\.token/);
  assert.match(input, /image\.contentEditable = "false"/);
  assert.match(input, /image\.draggable = false/);
  assert.match(input, /className = "inline-emoji"/);
  assert.match(css, /\.inline-emoji \{[\s\S]*?height: var\(--emoji-size/);
  assert.match(css, /vertical-align: -0\.2em/);
});

await check("a picked unicode emoji draws Fluent in the field and after sending", () => {
  assert.match(unicode, /export function splitUnicodeEmoji/);
  assert.match(unicode, /new Intl\.Segmenter/);
  assert.match(input, /for \(const run of splitUnicodeEmoji\(piece\.text\)\)/);
  assert.match(input, /nodes\.push\(createUnicodeEmojiImage\(run\.emoji\)\)/);
  assert.match(input, /!parsed && isSingleEmoji\(token\)/);
  assert.match(input, /fluentEmojiUrl\(char\)/);
  assert.match(fluent, /export function fluentEmojiUrl/);
  assert.match(fluent, /fallbackGlyph/);
  assert.match(textRenderer, /splitUnicodeEmoji\(seg\.text\)/);
  assert.match(textRenderer, /className="inline-fluent-emoji"/);
  assert.match(textRenderer, /inline-fluent-emoji__glyph/);
});

await check("getValue walks text, IMG, BR and Android's DIVs", () => {
  assert.match(input, /if \(isEmojiNode\(element\)\) \{\s*\n\s*out \+= element\.dataset\.token/);
  assert.match(input, /if \(tag === "BR"\)/);
  assert.match(input, /tag === "DIV" \|\| tag === "P"/);
  assert.match(input, /replace\(\/\\u200b\/g, ""\)\.trim\(\)/);
});

await check("the caret is saved on blur so the picker can insert", () => {
  assert.match(input, /document\.addEventListener\("selectionchange"/);
  assert.match(input, /onBlur=\{/);
  assert.match(input, /savedRange\.current = range\.cloneRange\(\)/);
});

await check("paste turns tokens into pictures and leaves files alone", () => {
  assert.match(input, /data\.getData\("text\/plain"\)/);
  assert.match(input, /onPasteFiles\?\.\(files\)/);
  assert.match(input, /nodesForText\(text\)/);
});

await check("Enter sends, Shift+Enter breaks, IME is ignored", () => {
  assert.match(input, /composing\.current \|\| native\.isComposing/);
  assert.match(input, /event\.key === "Enter" && !event\.shiftKey/);
  assert.match(input, /onEnter\?\.\(\)/);
});

await check("MessageComposer uses ComposerInput, not a textarea", () => {
  assert.match(composer, /<ComposerInput/);
  assert.ok(!composer.includes("<textarea"), "no textarea left in the composer");
  assert.match(composer, /inputRef\?: RefObject<ComposerInputHandle \| null>/);
  assert.match(composer, /resolveEmoji/);
});

await check("all three composers share the field", () => {
  assert.match(realmComposer, /<MessageComposer/);
  assert.match(realmComposer, /inputRef=\{inputRef\}/);
  assert.match(dm, /inputRef=\{composerRef\}/);
  assert.match(group, /inputRef=\{composerRef\}/);
  assert.match(postComposer, /<ComposerInput/);
});

await check("the picker is smileys only, with no realm lookup", () => {
  // The composer sheet used to mount a 750-glyph catalogue plus every joined
  // realm's pack; it now ships one flat table of faces and asks for nothing.
  const smileys = read("src/lib/smiley-data.ts");
  assert.match(smileys, /export const SMILEY_EMOJI/);
  assert.match(smileys, /export const SMILEY_CHARS[\s\S]{0,60}new Set\(/);
  assert.match(smileys, /export function searchSmileys/);
  // One table for every surface: composer sheet, realm sheet and post sheet.
  for (const file of [
    "src/components/emoji/RizzEmojiPanel.tsx",
    "src/components/emoji/EmojiPicker.tsx",
  ]) {
    assert.match(read(file), /@\/lib\/smiley-data/, `${file} reads the shared table`);
  }
  // The realm sheet delegates to the same panel, so it cannot drift or mount
  // its own 750-glyph list before the sheet paints.
  assert.match(
    read("src/components/chat/RealmEmojiPicker.tsx"),
    /<RizzEmojiPanel/,
    "the realm sheet uses the shared Fluent panel",
  );
  assert.match(panel, /searchSmileys\(term\)/);
  // One surface for every composer, with the realm pack inside it.
  assert.match(panel, /useAvailableEmojis\(source === "realms"\)/);
  assert.match(panel, /<FluentEmoji glyph=\{cell\.char\}/, "Microsoft Fluent artwork");
  assert.ok(!/useJoinedEmoji|joined_realm_emoji/.test(panel), "no realm-scoped query");
  assert.match(panel, /No smiley matches/);
  assert.match(available, /AVAILABLE_EMOJIS_PATH/);
});

await check("the endpoint answers for every joined realm, with no parameters", () => {
  assert.match(endpoint, /createFileRoute\("\/api\/emojis\/available"\)/);
  assert.match(endpoint, /auth\.client\s*\n?\s*\.from\("realm_members"\)/);
  assert.match(endpoint, /\.in\("realm_id", realmIds\)/);
  assert.match(endpoint, /\{ private: \[\], realms \}/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_realm_custom_emoji_realm_id/);
});

await check("the image endpoint resolves a uuid without a realm check", () => {
  assert.match(imageEndpoint, /createFileRoute\("\/api\/emojis\/\$id\/image"\)/);
  assert.match(imageEndpoint, /max-age=31536000, immutable/);
  assert.match(imageEndpoint, /\.eq\("id", id\)/);
  assert.ok(!/can_read_realm|realm_members/.test(imageEndpoint), "no membership check");
  assert.match(imageEndpoint, /status: 404/);
});

await check("a failed image is a muted chip, never the raw uuid", () => {
  assert.match(glyph, /if \(!emoji \|\| failed\)/);
  assert.match(glyph, /:\{shortcode \?\? "emoji"\}:/);
  assert.match(realmImage, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(realmImage, /:\{shortcode \?\? "emoji"\}:/);
  assert.match(realmRoute, /part\.name \? `:\$\{part\.name\}:` : ":emoji:"/);
  assert.ok(
    !/<span key=\{`\$\{si\}-\$\{xi\}`\} className="font-mono text-\[0\.85em\] text-muted-foreground">\s*\{part\.text\}/.test(
      realmRoute,
    ),
    "the realm renderer still prints the token",
  );
});

await check("one smiley table, one header row, one callback per tap", () => {
  assert.match(panel, /className="emoji-smiley-head absolute inset-x-0"/);
  assert.match(panel, /className="rizz-emoji-grid absolute inset-x-0"/);
  assert.ok(!/emoji-rail/.test(panel), "the category rail is gone");
  assert.ok(!/emoji-section-head/.test(panel), "sections are no longer measured or stickied");
  // Only the rows on screen are mounted: the lag fix that matters.
  assert.match(panel, /top \+ height < windowStart \|\| top > windowEnd/);
  assert.match(panel, /const OVERSCAN = 160/);
  // A tap must emit exactly one emoji: calling both callbacks inserted it twice.
  assert.match(
    panel,
    /if \(onPick\) onPick\(cell\.token, cell\.token\);\s*\n\s*else onEmoji\?\.\(cell\.token\);/,
  );
});

await check("custom emoji cells are square and contain the image", () => {
  assert.match(css, /object-fit: contain/);
  assert.match(css, /\.emoji-cell--realm \.emoji-media/);
  assert.match(realmImage, /width=\{32\}/);
  assert.match(realmImage, /height=\{32\}/);
  assert.match(realmImage, /loading="lazy"/);
  assert.match(realmImage, /decoding="async"/);
});

await check("an upload shows locally, then is replaced by the server row", () => {
  assert.match(available, /URL\.createObjectURL\(variables\.file\)/);
  assert.match(available, /onMutate:/);
  assert.match(available, /removeOptimisticEmoji\(qc, context\.pendingId\)/);
  assert.match(available, /invalidateAvailableEmojis/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.save_private_emoji/);
});

await check("every posted-text surface renders Fluent unicode", () => {
  // Fluent artwork is only guaranteed if every surface that prints a stored
  // body goes through EmojiText (or renderTextWithCatEmoji). A raw `{caption}`
  // or `{body}` would silently show the phone's own emoji set again.
  const surfaces = [
    "src/components/PostCard.tsx",
    "src/components/comments/CommentBody.tsx",
    "src/components/StoriesStrip.tsx",
    "src/components/forum/ForumEmbeds.tsx",
    "src/components/post/QuoteEmbed.tsx",
    "src/components/chat/SharedPostCards.tsx",
    "src/components/chat/ThreadSheet.tsx",
    "src/components/chat/ReplyQuote.tsx",
    "src/components/chat/MessageSearchSheet.tsx",
    "src/components/live/LiveAudienceDock.tsx",
    "src/components/live/LiveHostStage.tsx",
    "src/components/live/LiveViewerStage.tsx",
    "src/components/voice/VoiceCallView.tsx",
    "src/components/notifications/NotificationRow.tsx",
    "src/components/ProfilePreview.tsx",
    "src/components/FeedSideDiscussion.tsx",
    "src/routes/_app/dm.$userId.tsx",
    "src/routes/_app/g.$id.tsx",
    "src/routes/_app/r.$slug.tsx",
    "src/routes/_app/reels.tsx",
    "src/routes/_app/u.$username.tsx",
    "src/routes/_app/p.$postId.tsx",
  ];
  for (const file of surfaces) {
    assert.match(read(file), /EmojiText|renderTextWithCatEmoji/, `${file} draws Fluent text`);
  }
});

await check("the suite runs this file", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.test, /node tests\/emoji-composer\.test\.mjs/);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
