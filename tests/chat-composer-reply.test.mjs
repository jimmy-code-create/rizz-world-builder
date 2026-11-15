/**
 * Chat composer reply strip.
 *
 * When a reply is armed (swipe-to-reply or the message menu), the composer
 * shows a strip with the person's name and a preview of the message being
 * replied to. That strip must stay on screen while the reader scrolls the
 * transcript — scrolling must never silently drop a pending reply.
 *
 * Run: node tests/chat-composer-reply.test.mjs
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

const composer = read("../src/components/chat/MessageComposer.tsx");
const dm = read("../src/routes/_app/dm.$userId.tsx");

// The reply strip prints who is being replied to and a preview of their message.
await check("the reply strip prints the person and the message preview", () => {
  assert.ok(composer.includes("reply.label"), "the strip shows the person's name");
  assert.ok(composer.includes("reply.preview"), "the strip shows the message preview");
  assert.ok(dm.includes("Replying to"), "the DM route labels the reply with the peer");
});

// The composer only renders the strip when a reply is armed.
await check("the composer hides the strip when there is no reply", () => {
  assert.ok(composer.includes("reply?: ComposerReply | null"), "the prop is nullable");
  assert.ok(composer.includes("{reply ?"), "the strip is conditional on a reply");
  assert.ok(composer.includes(": null}"), "no reply means no strip");
});

// Scrolling the transcript must not drop a pending reply. The scroll listener
// only tracks jump-button visibility; it never resets replyTo.
await check("scrolling the transcript does not clear replyTo", () => {
  const start = dm.indexOf("addEventListener(\"scroll\"");
  assert.ok(start !== -1, "the transcript has a scroll listener");
  const end = dm.indexOf("}, []);", start);
  assert.ok(end !== -1, "the scroll useEffect closes");
  const scrollHandler = dm.slice(Math.max(0, start - 220), end + 7);
  assert.ok(!scrollHandler.includes("setReplyTo"), "scroll does not touch replyTo");
  assert.ok(scrollHandler.includes("setShowJump"), "scroll only toggles the jump button");
});

// replyTo is only cleared by deliberate actions, never by the scroll listener.
await check("replyTo is cleared only by send, cancel, edit or peer switch", () => {
  const clears = (dm.match(/setReplyTo\(null\)/g) ?? []).length;
  assert.ok(clears >= 4, "replyTo has deliberate clear sites");
  assert.ok(dm.includes("deliverPendingMessage"), "cleared after a message is delivered");
  assert.ok(dm.includes("onCancel: () => setReplyTo(null)"), "cleared by cancelling the reply");
  assert.ok(dm.includes("beginEdit"), "cleared when starting an edit");
  assert.ok(dm.includes("[userId]"), "cleared when switching peers");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
