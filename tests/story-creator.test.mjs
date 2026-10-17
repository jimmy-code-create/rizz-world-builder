/**
 * Story Creator content tests: templates, RIZZ-matched fonts, sticker packs,
 * code-drawn icons. Pure data only — no canvas, no network.
 * Run: node tests/story-creator.test.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

await check("20 templates with valid slots and texts", async () => {
  assert.ok(TEMPLATES.length >= 20, String(TEMPLATES.length));
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

await check("template preset texts sit inside the canvas", async () => {
  for (const t of TEMPLATES) {
    for (const p of t.texts) {
      assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1, `${t.id} text out of canvas`);
    }
  }
});

const composerSrc = await readFile(new URL("../src/components/StoryComposer.tsx", import.meta.url), "utf8");

await check("overlay preview no longer double-translates (Tailwind v4 `translate` property)", async () => {
  // Tailwind v4 compiles -translate-x-1/2 to the CSS `translate` property,
  // which stacks with the inline transform: translate(-50%,-50%) and shifted
  // every template slot/sticker half a slot off-canvas.
  const overlayJsx = composerSrc.slice(composerSrc.indexOf("overlays.map"));
  assert.ok(
    !/className=\{`absolute -translate/.test(overlayJsx),
    "overlay wrapper must not combine -translate-* classes with the inline transform",
  );
  assert.ok(overlayJsx.includes("transform: `translate(-50%,-50%) rotate"), "inline centering transform missing");
});

await check("slot preview height uses canvas-height fractions (matches the export)", async () => {
  // Slots store h as a fraction of canvas height; the old aspectRatio sizing
  // made preview slots 56% of their exported height on a 9:16 stage.
  assert.ok(
    composerSrc.includes("height: ov.kind === \"image\" && ov.h ? `${ov.h * 100}%` : undefined"),
    "image overlays must size their height as a % of the stage height",
  );
  assert.ok(!composerSrc.includes("aspectRatio: ov.kind"), "slot aspect-ratio sizing must be gone");
});

await check("template text sizes are honored on apply (scale = size / 72)", async () => {
  assert.ok(composerSrc.includes("preset.size / 72"), "applyTemplate must map the authored size to the overlay scale");
});

await check("lens tool removed from the story composer", async () => {
  assert.ok(!composerSrc.includes("FaceEffectsStudio"), "FaceEffectsStudio must not be wired in");
  assert.ok(!composerSrc.includes('label="Lens"'), "Lens tool button must be gone");
  assert.ok(!composerSrc.includes("lensOpen"), "lensOpen state must be gone");
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
