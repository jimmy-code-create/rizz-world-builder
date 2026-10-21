/**
 * Long-press message actions (Discord-style).
 *
 * The menu is the app's most-tapped surface, and its look lives entirely in
 * class names: the popout colour, the 32px desktop / 44px phone rows, the red
 * Delete row and the hairline that keeps destructive actions away from the
 * rest. A refactor that drops any of those silently turns the menu back into a
 * generic list, so they are guarded here.
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
const reactionBar = readFileSync(
  new URL("../src/components/chat/ReactionQuickBar.tsx", import.meta.url),
  "utf8",
);

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

await check("the quick reaction bar matches the menu", async () => {
  assert.ok(reactionBar.includes("bg-[#2b2d31]"), "Discord's reaction tray");
  assert.ok(reactionBar.includes("hover:bg-white/[0.08]"));
  assert.ok(reactionBar.includes("min-h-[44px]"), "touch targets stay 44px");
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
