/**
 * Swipe-to-reply is one gesture shared by DMs, groups and realm channels.
 *
 * It lives inside a vertical chat scroller, so it must own the touch stream:
 * delegated pointer events get cancelled by the browser the moment a diagonal
 * drag is mistaken for a scroll. These guards keep the native non-passive
 * `touchmove` path (which can call `preventDefault`) wired into every surface,
 * and keep each surface's reply state connected to its composer.
 *
 * Run: node tests/swipe-reply.test.mjs
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

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const swipe = read("../src/components/chat/SwipeToReply.tsx");
const row = read("../src/components/chat/MessageRow.tsx");
const dm = read("../src/routes/_app/dm.$userId.tsx");
const group = read("../src/routes/_app/g.$id.tsx");
const realm = read("../src/routes/_app/r.$slug.tsx");

await check("touch owns the drag through a non-passive native listener", () => {
  assert.match(
    swipe,
    /addEventListener\(\s*"touchmove",\s*onTouchMove,\s*\{\s*passive:\s*false\s*\}\s*\)/,
    "touchmove must be non-passive so it can stop the transcript scrolling",
  );
  assert.match(swipe, /horizontal && event\.cancelable[\s\S]*?event\.preventDefault\(\)/);
});

await check("pointer handlers stay for mouse/pen and ignore touch", () => {
  assert.match(swipe, /if \(event\.pointerType === "touch"\) return;/);
  assert.match(swipe, /setPointerCapture/);
  assert.match(swipe, /releasePointerCapture/);
});

await check("the gesture commits on a deliberate horizontal drag", () => {
  assert.match(swipe, /axisLock:\s*7/);
  assert.match(swipe, /axisLean:\s*1\.15/);
  assert.match(swipe, /threshold:\s*62/);
  // A vertical drag is a scroll; it can never become a reply later.
  assert.match(swipe, /state\.axis = "y";/);
  // Both directions arm the reply, like the mirrored rail.
  assert.match(swipe, /const offset = dx < 0 \? -eased : eased;/);
});

await check("swipe ignores controls that own their own gestures", () => {
  assert.match(
    swipe,
    /a, button, input, textarea, select, \[data-interactive\], \[data-swipe-ignore\], \[contenteditable='true'\]/,
  );
});

await check("DM and group rows pass onSwipeReply into the shared row", () => {
  assert.match(
    row,
    /<SwipeableMessage\s+onReply=\{onSwipeReply \?\? \(\(\) => \{\}\)\}\s+disabled=\{!onSwipeReply\}/,
  );
  assert.match(dm, /onSwipeReply=\{[\s\S]*?setReplyTo\(\{/);
  assert.match(group, /onSwipeReply=\{[\s\S]*?setReplyTo\(\{/);
});

await check("realm rows use the same swipe component and set reply state", () => {
  assert.match(realm, /<SwipeableMessage[\s\S]*?onReply=\{\(\) => \{[\s\S]*?setReplyTo\(\{/);
  assert.match(realm, /disabled=\{!canReply\}/);
});

await check("every surface feeds the reply into its composer", () => {
  assert.match(dm, /reply=\{\s*editing[\s\S]*?replyTo[\s\S]*?Replying to/);
  assert.match(group, /reply=\{replyTo \? \{[\s\S]*?Replying to/);
  assert.match(realm, /reply=\{\s*replyTo\s*\?\s*\{[\s\S]*?Replying to/);
});

console.log(`\n${passed} checks passed.`);
