/**
 * Chat polish guards: reaction pills, desktop hover actions, honest media.
 *
 * These are the regressions this pass fixed, and all of them live in class
 * names or in a single shared component — the exact kind of thing a later edit
 * can undo without noticing.
 *
 *  - The reaction row must keep `flex`. It carried `flex-wrap` alone before, so
 *    every chip became a block and the pills stacked vertically in DMs, groups
 *    and realms.
 *  - An image-only DM must not store the words “📷 Image” as its body, and the
 *    three chats must strip that legacy placeholder on read.
 *  - A failed image must say so and offer Retry instead of collapsing.
 *  - Desktop must offer Discord's hover toolbar on every chat surface.
 *  - Jumping to a message must be the fading wash, not a hard ring.
 *
 * Run: node tests/chat-polish.test.mjs
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

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

const chips = read("components/chat/ReactionChips.tsx");
const row = read("components/chat/MessageRow.tsx");
const menu = read("components/chat/MessageActionMenu.tsx");
const media = read("components/chat/ChatMessageMedia.tsx");
const gif = read("lib/gif-content.ts");
const dm = read("routes/_app/dm.$userId.tsx");
const group = read("routes/_app/g.$id.tsx");
const realm = read("routes/_app/r.$slug.tsx");
const styles = read("styles.css");

await check("reaction chips are one flex row of pills", async () => {
  assert.match(
    chips,
    /w-full max-w-full flex-wrap items-center gap-1/,
    "the row still lets chips wrap",
  );
  assert.match(
    chips,
    /hasChips \? "mt-1 flex min-h-\[18px\]" : "hidden"/,
    "the row must declare flex when it has chips",
  );
  assert.ok(
    chips.includes('h-[26px] max-w-full shrink-0 select-none items-center gap-1 rounded-full'),
    "chips are 26px full-round pills",
  );
  assert.ok(chips.includes("after:-inset-y-[7px]"), "pills keep a 40px tap target");
  assert.ok(!chips.includes("h-8 max-w-full"), "the old 32px boxed tile is gone");
});

await check("image-only messages never say “📷 Image”", async () => {
  assert.ok(
    !dm.includes('"📷 Image"'),
    "the DM composer must not write the placeholder body",
  );
  assert.match(dm, /const text = \(quoted \+ body\.trim\(\)\)\.trim\(\);/, "empty body for a captionless photo");
  assert.ok(gif.includes("isMediaPlaceholderText"), "the legacy placeholder has one reader");
  for (const [name, source] of [["dm", dm], ["group", group], ["realm", realm]]) {
    assert.ok(
      source.includes("isMediaPlaceholderText("),
      `${name} must strip the legacy placeholder`,
    );
  }
});

await check("a failed photo is visible and retryable", async () => {
  assert.ok(media.includes("Image didn’t load"), "the failure is named, not blank");
  assert.ok(media.includes("Retry"), "there is a retry control");
  assert.match(media, /key=\{attempt\}/, "retry remounts the img so the request is fresh");
  assert.match(styles, /\.chat-media-failed \{/, "the fallback has a real frame");
});

await check("desktop hover actions exist on every chat surface", async () => {
  assert.match(
    styles,
    /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.realm-message:hover > \.chat-hover-actions/,
    "the toolbar is mouse-only",
  );
  assert.ok(row.includes('className="chat-hover-actions"'), "shared rows draw it");
  assert.ok(realm.includes('className="chat-hover-actions"'), "realm rows draw it");
  assert.ok(dm.includes("onQuickReact="), "DMs wire quick react");
  assert.ok(group.includes("onQuickReact="), "groups wire quick react");
  assert.match(
    realm,
    /setOpenMessageView\("reactions"\)/,
    "the realm smiley opens the picker, not the action list",
  );
  assert.match(menu, /setView\(open \? initialView : "actions"\)/, "the menu honours the initial pane");
});

await check("jump-to-message is a fading wash, not a ring", async () => {
  assert.match(styles, /@keyframes chat-jump-wash/, "the wash animates");
  assert.match(styles, /\.chat-jump-highlight \{[\s\S]*?chat-jump-wash 2\.2s/);
  assert.ok(!row.includes("ring-2 ring-primary/50"), "the shared row dropped the hard ring");
  assert.ok(!realm.includes("ring-2 ring-primary/50"), "the realm row dropped it too");
  assert.ok(row.includes("chat-jump-highlight"), "shared rows use the wash");
  assert.ok(realm.includes("chat-jump-highlight"), "realm rows use the wash");
});

await check("sending keeps the phone keyboard open and typing follows", async () => {
  const shared = read("components/chat/MessageComposer.tsx");
  // The send control is a plain button inside the shared composer: it never has
  // a mousedown that steals focus, and the composer refocuses the field after a
  // send for the browsers that blur it anyway.
  assert.ok(!shared.includes("onMouseDown"), "the send control takes focus on mousedown");
  assert.match(shared, /field\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(realm, /<MessageComposer/, "the realm does not use the shared composer");
  assert.match(realm, /textareaRef=\{inputRef\}/, "the realm does not hand over its field");
  for (const [name, source] of [["dm", dm], ["group", group]]) {
    assert.match(source, /<MessageComposer/, `${name} does not use the shared composer`);
    assert.match(source, /textareaRef=\{composerRef\}/, `${name} does not hand over its field`);
    assert.match(
      source,
      /const keepComposerFocused = \(\) => \{\s*composerRef\.current\?\.focus\(\{ preventScroll: true \}\);/,
      `${name} restores focus after sending`,
    );
    assert.match(
      source,
      /document\.activeElement === composer[\s\S]{0,160}?scrollTop = (?:list|messagesListRef\.current)\.scrollHeight/,
      `${name} keeps the newest message in view as the box grows`,
    );
  }
});

await check("clicking a composer lands on the newest message", async () => {
  for (const [name, source] of [["dm", dm], ["group", group], ["realm", realm]]) {
    assert.ok(source.includes("scrollChatToLatest("), `${name} uses the shared jump`);
    assert.match(
      source,
      /onTextareaClick=\{\(e\) => \{[\s\S]{0,200}?scrollChatToLatest\(/,
      `${name} jumps on click`,
    );
  }
  const helper = read("lib/chat-scroll.ts");
  assert.match(helper, /scroller\.scrollTop = scroller\.scrollHeight/, "it scrolls to the bottom");
  assert.match(helper, /requestAnimationFrame/, "and settles over the next frames");
  assert.match(helper, /visualViewport/, "following the on-screen keyboard's resize");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
