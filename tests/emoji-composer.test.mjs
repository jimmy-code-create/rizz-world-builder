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
const stylesCss = read("src/styles.css");
const fieldCss = read("src/components/chat/composer-input.css");
const migration = read("supabase/migrations/20261119000000_emoji_available_and_index.sql");

await check("the token regex is the documented one, in both directions", () => {
  assert.match(token, /EMOJI_TOKEN_SOURCE = "<\(a\?\):\(\[A-Za-z0-9_\]\+\):\(\[0-9a-fA-F-\]\{36\}\)>"/);
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

await check("an emoji in the field is an img[data-token] at 1.4em", () => {
  assert.match(input, /image\.dataset\.token = parts\.token/);
  assert.match(input, /image\.contentEditable = "false"/);
  assert.match(input, /image\.draggable = false/);
  assert.match(input, /className = "inline-emoji"/);
  assert.match(fieldCss, /\.inline-emoji \{[\s\S]*?height: 1\.4em/);
  assert.match(fieldCss, /vertical-align: -0\.3em/);
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

await check("the picker never depends on the route or a realm id", () => {
  assert.match(panel, /useAvailableEmojis\(\)/);
  assert.ok(
    !/useJoinedEmoji|useJoinedRealms|joined_realm_emoji/.test(panel),
    "the panel still reads a realm-scoped list",
  );
  assert.match(panel, /const payload = available\.data;/);
  assert.match(panel, /for \(const realm of payload\.realms\)/);
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

await check("one sticky header per section; empty realms are hidden", () => {
  const headers = panel.match(/emoji-section-head/g) ?? [];
  assert.ok(headers.length >= 2, "the section header exists");
  assert.ok(!panel.includes("emoji-section-head--sticky"), "no second overlay header");
  assert.match(panel, /className="emoji-section-head sticky top-0/);
  assert.match(panel, /filter\(\s*\n?\s*\(section\) => section\.emoji\.length > 0,?\s*\n?\s*\)/);
  assert.match(panel, /label: "Private"/);
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

await check("the field draws no inner box of its own (feed + DM)", () => {
  // The rounded composer owns the border and the focus ring.
  assert.match(fieldCss, /\[data-composer-input\]\.composer-input:focus-visible[\s\S]*?outline: none/);
  assert.match(fieldCss, /\[data-composer-input\]\.composer-input:focus-visible[\s\S]*?box-shadow: none/);
  assert.match(fieldCss, /\[data-composer-input\]\.composer-input:focus-visible[\s\S]*?background: transparent/);
  // The old rule painted a lime ring on the field itself; it must stay neutral.
  assert.match(
    stylesCss,
    /\[data-composer-input\]\.composer-input:focus-visible \{\s*\n\s*outline: none;\s*\n\s*border: 0;\s*\n\s*box-shadow: none;\s*\n\s*background: transparent;/,
  );
  assert.ok(!/composer-input:focus-visible \{[^}]*brand-signal/.test(stylesCss), "the lime ring is gone");
});

await check("the placeholder reads the text attribute, gated by the empty state", () => {
  // data-empty is the state, data-placeholder is the text: never the same attr.
  assert.match(fieldCss, /\[data-empty="true"\]::before/);
  assert.match(fieldCss, /content: attr\(data-placeholder\)/);
  assert.ok(!/attr\(data-empty\)/.test(fieldCss), "the placeholder must not print the state");
  assert.match(input, /const EMPTY_ATTR = "data-empty"/);
  assert.match(input, /setAttribute\(EMPTY_ATTR, isComposerEmpty\(node\) \? "true" : "false"\)/);
  assert.ok(!/setAttribute\("data-placeholder"/.test(input), "the text attribute is never overwritten");
});

await check("the suite runs this file", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.test, /node tests\/emoji-composer\.test\.mjs/);
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
