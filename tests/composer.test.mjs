/**
 * Composer — the panel state machine and per-chat drafts.
 * Run: node tests/composer.test.mjs
 */
import assert from "node:assert/strict";
import {
  DEFAULT_KEYBOARD_HEIGHT,
  MIN_KEYBOARD_HEIGHT,
  backShouldClosePanel,
  clampKeyboardHeight,
  emojiTriggerShowsKeyboard,
  nextPanel,
  panelHeight,
} from "../src/features/composer/panels.ts";
import {
  DRAFT_DEBOUNCE_MS,
  clearDraft,
  draftKey,
  flushDraft,
  queueDraft,
  readDraft,
} from "../src/features/composer/drafts.ts";

let checks = 0;
const ok = (label, fn) => {
  fn();
  checks += 1;
  console.log("  ✓", label);
};

function memoryStore() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

ok("one panel at a time, and the keyboard is one of them", () => {
  let panel = "keyboard";
  panel = nextPanel(panel, { type: "toggle", panel: "emoji" });
  assert.equal(panel, "emoji", "emoji replaces the keyboard");
  panel = nextPanel(panel, { type: "toggle", panel: "stickers" });
  assert.equal(panel, "stickers", "stickers replace emoji, never stack");
  panel = nextPanel(panel, { type: "open", panel: "attach" });
  assert.equal(panel, "attach");
});

ok("tapping the same trigger twice closes the panel", () => {
  assert.equal(nextPanel("emoji", { type: "toggle", panel: "emoji" }), "none");
  assert.equal(nextPanel("attach", { type: "toggle", panel: "attach" }), "none");
});

ok("tapping the field always comes back to the keyboard", () => {
  assert.equal(nextPanel("emoji", { type: "focus-field" }), "keyboard");
  assert.equal(nextPanel("attach", { type: "focus-field" }), "keyboard");
});

ok("a panel taking the focus does not close itself", () => {
  assert.equal(nextPanel("emoji", { type: "blur-field" }), "emoji");
  assert.equal(nextPanel("keyboard", { type: "blur-field" }), "none");
});

ok("back closes a panel before the screen", () => {
  assert.equal(backShouldClosePanel("stickers"), true);
  assert.equal(backShouldClosePanel("keyboard"), false);
  assert.equal(nextPanel("stickers", { type: "back" }), "none");
});

ok("the keyboard height is clamped, not trusted", () => {
  assert.equal(clampKeyboardHeight(0, 800), DEFAULT_KEYBOARD_HEIGHT);
  assert.equal(clampKeyboardHeight(120, 800), MIN_KEYBOARD_HEIGHT);
  assert.equal(clampKeyboardHeight(900, 800), 400, "never more than half the viewport");
  assert.equal(clampKeyboardHeight(320, 900), 320);
});

ok("a panel stands exactly where the keyboard was", () => {
  assert.equal(panelHeight("emoji", 320, 900), 320);
  assert.equal(panelHeight("attach", 320, 900), 320);
  assert.equal(panelHeight("keyboard", 320, 900), null);
  assert.equal(panelHeight("none", 320, 900), null);
});

ok("the emoji trigger becomes a keyboard only while emoji is open", () => {
  assert.equal(emojiTriggerShowsKeyboard("emoji"), true);
  assert.equal(emojiTriggerShowsKeyboard("stickers"), false);
  assert.equal(emojiTriggerShowsKeyboard("none"), false);
});

ok("drafts are per conversation", () => {
  const store = memoryStore();
  const dm = draftKey("dm", "abc");
  const group = draftKey("group", "abc");
  assert.notEqual(dm, group);
  store.setItem(dm, "half a thought");
  assert.equal(readDraft(dm, store), "half a thought");
  assert.equal(readDraft(group, store), "");
});

ok("drafts save debounced and clear on send", async () => {
  const store = memoryStore();
  const key = draftKey("realm", "cats#general");
  queueDraft(key, "typing…", store, 10);
  assert.equal(readDraft(key, store), "", "nothing written before the debounce");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(readDraft(key, store), "typing…");
  clearDraft(key, store);
  assert.equal(readDraft(key, store), "");
  assert.equal(DRAFT_DEBOUNCE_MS, 400);
});

ok("an empty draft removes the entry instead of storing whitespace", () => {
  const store = memoryStore();
  const key = draftKey("dm", "z");
  store.setItem(key, "old");
  flushDraft(key, "   ", store);
  assert.equal(readDraft(key, store), "");
});

console.log(`\ncomposer: ${checks} checks passed`);
