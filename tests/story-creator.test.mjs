/**
 * Story Creator content tests: templates, RIZZ-matched fonts, sticker packs,
 * code-drawn icons. Pure data only — no canvas, no network.
 * Run: node tests/story-creator.test.mjs
 */
import assert from "node:assert/strict";
import {
  EMOJI_PACK,
  FONTS,
  ICONS,
  ICON_NAMES,
  PHRASE_PACK,
  TEMPLATES,
  TEXT_STYLES,
  fontStack,
} from "../src/lib/story-creator/content.ts";

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

await check("12+ templates with valid slots and texts", async () => {
  assert.ok(TEMPLATES.length >= 13, String(TEMPLATES.length));
  const styles = new Set(TEXT_STYLES.map((s) => s.id));
  const fonts = new Set(FONTS.map((f) => f.id));
  for (const t of TEMPLATES) {
    assert.ok(t.id && t.label && t.bg);
    assert.ok(["none", "polaroid", "film", "neon"].includes(t.frame));
    for (const s of t.slots) {
      for (const v of [s.x, s.y, s.w, s.h])
        assert.ok(v >= 0 && v <= 1, `${t.id} slot out of range`);
      assert.ok(s.w > 0.05 && s.h > 0.05, `${t.id} slot too small`);
    }
    for (const p of t.texts) {
      assert.ok(p.text.trim(), `${t.id} empty preset text`);
      assert.ok(styles.has(p.style), `${t.id} bad style ${p.style}`);
      assert.ok(fonts.has(p.font), `${t.id} bad font ${p.font}`);
      assert.ok(p.size >= 20 && p.size <= 120, `${t.id} bad size`);
    }
  }
  const ids = TEMPLATES.map((t) => t.id);
  assert.ok(new Set(ids).size === ids.length, "duplicate template ids");
});

await check("fonts match RIZZ lime/black style", async () => {
  assert.ok(FONTS.length >= 8, String(FONTS.length));
  assert.ok(fontStack("rizz-display").includes("Bricolage Grotesque"));
  assert.ok(fontStack("rizz-sans").includes("Instrument Sans"));
  assert.equal(TEXT_STYLES.length, 7);
  assert.ok(TEXT_STYLES.some((s) => s.id === "neon") && TEXT_STYLES.some((s) => s.id === "poster"));
});

await check("sticker packs cover Emoji, Mood, Gen Z, Hinglish, Desi", async () => {
  for (const tab of ["Emoji", "Mood", "Desi pop"]) {
    assert.ok(EMOJI_PACK[tab].length >= 8, `${tab} too small`);
  }
  assert.ok(PHRASE_PACK["Gen Z"].length >= 8);
  assert.ok(PHRASE_PACK.Hinglish.length >= 8);
  assert.ok(PHRASE_PACK.Hinglish.some((p) => /scene|bhai|yaar|mast/i.test(p)));
  assert.ok(PHRASE_PACK["Gen Z"].some((p) => /rizz|slay|no cap/i.test(p)));
  assert.ok(ICON_NAMES.length >= 40, String(ICON_NAMES.length));
  for (const must of ["heart", "chai", "cricket", "diya", "rangoli", "crown", "bolt", "music"]) {
    assert.ok(ICONS[must], `missing icon ${must}`);
    assert.equal(typeof ICONS[must].draw, "function");
  }
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
