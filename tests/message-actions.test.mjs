/**
 * Long-press message actions (Discord-style) + the realm description strip.
 *
 * The menu is the app's most-tapped surface, and its look lives entirely in
 * class names: the popout colour, the 32px desktop / 44px phone rows, the red
 * Delete row and the hairline that keeps destructive actions away from the
 * rest. Reactions are no longer a permanently expanded tray; they open from a
 * smiley at the right edge of the message, so these guards lock that shape in.
 *
 * Run: node tests/message-actions.test.mjs
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

const menu = readFileSync(
  new URL("../src/components/chat/MessageActionMenu.tsx", import.meta.url),
  "utf8",
);
const picker = readFileSync(
  new URL("../src/components/chat/ReactionPicker.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const realm = readFileSync(new URL("../src/routes/_app/r.$slug.tsx", import.meta.url), "utf8");

await check("phone sheet and desktop popout use Discord's popout colour", async () => {
  assert.ok(menu.includes("bg-[#111214]"), "the menu surface must use Discord's #111214");
  assert.match(menu, /side="bottom"[\s\S]*?bg-\[#111214\]/, "the mobile sheet");
  assert.match(menu, /PopoverContent[\s\S]*?bg-\[#111214\]/, "the desktop popover");
  assert.ok(menu.includes("rounded-lg border border-black/50"), "desktop popout chrome");
});

await check("rows are compact on desktop and full-size on touch", async () => {
  assert.match(menu, /dense \? "min-h-8" : "min-h-11"/);
  assert.ok(menu.includes("renderActions(false)"), "the sheet keeps 44px rows");
  assert.ok(menu.includes("renderActions(true)"), "the popover uses 32px rows");
  assert.ok(menu.includes("text-[13px] font-medium leading-[18px]"), "Discord row type");
});

await check("Delete is red, fills on hover and sits behind a hairline", async () => {
  assert.ok(menu.includes("text-[#f23f43]"), "destructive text colour");
  assert.ok(menu.includes("hover:bg-[#da373c] hover:text-white"), "Discord's red hover");
  assert.match(menu, /const startsDanger = action\.destructive && !actions\.slice\(0, index\)\.some/);
  assert.match(menu, /startsDanger && index > 0[\s\S]*?bg-white\/\[0\.06\]/, "danger separator");
});

await check("the header reads like Discord's context menu", async () => {
  assert.match(menu, /text-\[13px\] font-semibold leading-\[18px\] text-white/);
  assert.ok(menu.includes("text-[#949ba4]"), "timestamp/empty colour");
  assert.ok(menu.includes("text-[#dbdee1]"), "message body colour");
});

await check("reactions are a smiley on the message, not an expanded tray", async () => {
  assert.ok(menu.includes("SmilePlus"), "the reaction control is a smiley icon");
  assert.ok(menu.includes('aria-label="Add reaction"'));
  assert.ok(!menu.includes("ReactionQuickBar"), "the old always-open tray is gone");
  assert.match(menu, /const showingReactions = view === "reactions" && !!reactionBar/);
  assert.match(menu, /onClick=\{\(\) => setView\("reactions"\)\}/);
  assert.ok(menu.includes("showingReactions ? ("), "the menu swaps views instead of stacking");
  assert.ok(menu.includes("action-sheet"), "the sheet gets its own fast animation class");
  assert.match(menu, /line-clamp-3/, "the message preview is capped, not printed in full");
});

await check("the reaction picker is compact but complete", async () => {
  assert.ok(picker.includes("QUICK_REACTIONS"));
  assert.ok(picker.includes("MORE_REACTIONS"));
  assert.ok(picker.includes("CAT_EMOJI_MANIFEST"), "custom cat emoji stay available");
  assert.ok(picker.includes("ArrowLeft"), "there is a way back to the actions");
  assert.ok(picker.includes('aria-label="Back to message actions"'));
  assert.ok(picker.includes("bg-[#2b2d31]"), "Discord's reaction tray colour");
  assert.ok(picker.includes("min-h-[44px]"), "quick reactions keep 44px targets");
  assert.ok(picker.includes("max-h-40"), "the wider emoji grid scrolls instead of growing forever");
});

await check("the action sheet rises quickly but still respects reduced motion", async () => {
  assert.match(styles, /\.action-sheet\[data-state="open"\] \{[\s\S]*?animation-duration: 200ms/);
  assert.match(styles, /\.action-sheet\[data-state="closed"\] \{[\s\S]*?animation-duration: 150ms/);
  assert.match(
    styles,
    /prefers-reduced-motion: reduce\) \{[\s\S]*?\.action-sheet\[data-state="open"\][\s\S]*?animation-duration: 1ms/,
  );
});

await check("the realm description is a one-line strip that expands on tap", async () => {
  assert.ok(realm.includes("<RealmTopicBar topic={c.topic} />"));
  assert.match(realm, /function RealmTopicBar\(\{ topic \}: \{ topic: string \}\)/);
  assert.match(realm, /line-clamp-1/, "collapsed by default");
  assert.match(realm, /aria-expanded=\{expanded\}/);
  assert.match(realm, /whitespace-pre-wrap/, "expanded text keeps the author's line breaks");
  assert.ok(!/className="chat-bar flex shrink-0 items-start gap-2[^"]*text-sm/.test(realm), "the old 3-line block is gone");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
