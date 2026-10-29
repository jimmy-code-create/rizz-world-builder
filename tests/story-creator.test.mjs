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
import { mergeTemplateLayers } from "../src/lib/story-creator/templates.ts";

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
  const def = TEMPLATES.find((t) => t.texts.length > 0);
  const { layers } = mergeTemplateLayers([], def, () => "id");
  const text = layers.find((layer) => layer.kind === "text");
  assert.equal(text.scale, Math.max(0.25, def.texts[0].size / 72));
});

await check("applying a template keeps your own layers and replaces only its own", async () => {
  const grid2 = TEMPLATES.find((t) => t.id === "grid2");
  const grid3 = TEMPLATES.find((t) => t.id === "grid3");
  const mine = [
    { id: "my-photo", kind: "image", src: "blob:mine" },
    { id: "my-text", kind: "text", value: "my words" },
    { id: "my-ink", kind: "drawing" },
  ];
  const first = mergeTemplateLayers(mine, grid2, () => "a");
  const second = mergeTemplateLayers(first.layers, grid3, () => "b");
  const ids = second.layers.map((layer) => layer.id);
  for (const keep of ["my-photo", "my-text", "my-ink"]) {
    assert.ok(ids.includes(keep), `${keep} must survive a template change`);
  }
  // grid2's two slots are gone; grid3 contributed its own three and no more.
  const templateSlots = second.layers.filter((layer) => layer.template && layer.kind === "image");
  assert.equal(templateSlots.length, grid3.slots.length);
  assert.equal(second.layers.filter((layer) => layer.template).length, grid3.slots.length);
});

await check("photos already in slots follow across layouts", async () => {
  const grid2 = TEMPLATES.find((t) => t.id === "grid2");
  const grid3 = TEMPLATES.find((t) => t.id === "grid3");
  let n = 0;
  const first = mergeTemplateLayers([], grid2, () => `s${(n += 1)}`);
  const filled = first.layers.map((layer) =>
    layer.kind === "image" ? { ...layer, src: `blob:${layer.id}` } : layer,
  );
  const second = mergeTemplateLayers(filled, grid3, () => `t${(n += 1)}`);
  const sources = second.layers
    .filter((layer) => layer.template && layer.kind === "image")
    .map((layer) => layer.src);
  assert.deepEqual(sources.slice(0, 2), ["blob:s1", "blob:s2"]);
  assert.equal(sources.length, grid3.slots.length);
  assert.equal(sources[2], undefined, "the extra grid3 slot starts empty");
});

await check("template merge reports the first empty slot and unique ids", async () => {
  const film = TEMPLATES.find((t) => t.id === "filmstrip");
  let n = 0;
  const { layers, firstEmptyId } = mergeTemplateLayers([], film, () => `u${(n += 1)}`);
  const ids = layers.map((layer) => layer.id);
  assert.equal(new Set(ids).size, ids.length, "layer ids must be unique");
  const firstSlot = layers.find((layer) => layer.kind === "image");
  assert.equal(firstEmptyId, firstSlot.id);
  const allFilled = layers.map((layer) =>
    layer.kind === "image" ? { ...layer, src: "blob:x" } : layer,
  );
  assert.equal(mergeTemplateLayers(allFilled, film, () => `v${(n += 1)}`).firstEmptyId, null);
});

await check("typing in a story text layer does not refocus on every render", async () => {
  // The ref callback ran on every keystroke, re-focusing and re-selecting the
  // span: each new letter replaced the previous one, so typing died after one
  // character. Focus/select now happens once per edit session.
  assert.ok(
    !composerSrc.includes("if (el) { el.focus();"),
    "focusing from a ref callback breaks typing — use an effect on editingId",
  );
  assert.ok(composerSrc.includes("ref={textEditorRef}"), "the text editor needs its own ref");
  assert.ok(
    /\}, \[editingId\]\);/.test(composerSrc),
    "focus/select must run once when the editor opens",
  );
});

await check("living text is wired end to end", async () => {
  assert.ok(composerSrc.includes("live?: boolean"), "overlays carry a live flag");
  assert.ok(composerSrc.includes("story-live-text"), "preview animates living text");
  assert.ok(composerSrc.includes("paintLiveTexts"), "the clip bake paints living text per frame");
  assert.ok(
    composerSrc.includes("skipLiveText: true"),
    "the still base must not freeze living text",
  );
  assert.ok(
    composerSrc.includes('label="Fill photo slot"') &&
      composerSrc.includes("onPointerDown={(e) => e.stopPropagation()}"),
    "template slots own their press so the picker opens",
  );
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.ok(styles.includes(".story-live-text"), "styles define the living-text animation");
  assert.ok(
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.story-live-text/.test(styles),
    "living text must respect reduced motion",
  );
});

await check("new text spawns below centre, not on the photo's middle", async () => {
  // A dead-centre default (0.5/0.5) dropped the label on the middle of the
  // photo — and straight over a template's centre slot. New text spawns in
  // the same lower band the phrase stickers use, draggable from there.
  assert.ok(
    /kind:\s*"text",\s*value:\s*"Tap to edit",\s*x:\s*0\.5,\s*y:\s*0\.62/.test(composerSrc),
    "addText must spawn the label below centre",
  );
});

await check("dragging a layer survives the gesture, on every browser", async () => {
  // Text could not be dragged. The move handle committed the text on press,
  // which unmounted the very element holding the pointer — iOS cancels the
  // pointer of a captured element that leaves the DOM, so the drag died on the
  // first move. The commit must happen when the finger lifts instead.
  const drag = composerSrc.slice(
    composerSrc.indexOf("const onDragOverlay"),
    composerSrc.indexOf("if (!open) return null;"),
  );
  assert.ok(drag.length > 0, "onDragOverlay must exist");
  assert.ok(
    /commitTextOnRelease\s*=\s*force\s*&&\s*editingId\s*===\s*id/.test(drag),
    "the pressed handle must stay mounted until the drag ends",
  );
  assert.ok(
    !/if \(editingId === id && force\) \{\s*\n\s*const el/.test(drag),
    "the old press-time commit (which unmounted the handle) must not return",
  );
  assert.ok(/if \(commitTextOnRelease\)/.test(drag), "the text commits on release");
  // Pointer capture is an optimisation only: Safari throws when the node is
  // detached, and an uncaught throw skipped the listeners entirely.
  assert.ok(/try \{\s*\n\s*handle\.setPointerCapture/.test(drag), "capture must be guarded");
  assert.ok(drag.includes("window.addEventListener(\"pointermove\", move, true)"), "moves must be captured");
  // The layer follows the finger's delta, and a tap is not an undo step.
  assert.ok(
    drag.includes("posX + (p.x - prevX) * unitX"),
    "drag integrates pointer deltas, so a mid-gesture resize cannot fling it",
  );
  assert.ok(
    drag.includes("const r = stage.getBoundingClientRect();"),
    "the stage is re-read every frame — a phone keyboard resizes it",
  );
  assert.ok(
    drag.includes("dragLayerIdRef.current = id") &&
      drag.includes("dragLayerIdRef.current = null"),
    "the gesture claims the layer and releases it on release",
  );
  assert.ok(drag.includes("beginMove") && drag.includes("if (pushed) return;"), "history only grows on a real move");
  // Dropping on the bin has to read the release-time state, not the closure.
  assert.ok(drag.includes("dragOverTrashRef.current"), "trash drop must use the live hover state");
});

await check("pressing the move handle can't close the editor under the finger", async () => {
  // The mobile failure: tapping the handle moved focus off the caret, the
  // blur closed the editor, and the handle unmounted while the finger held it.
  // iOS answers that with pointercancel, so text could not be moved on a phone.
  assert.ok(
    composerSrc.includes("if (dragLayerIdRef.current === editingId) return;"),
    "the caret's blur is guarded while its own layer is being dragged",
  );
  assert.ok(
    composerSrc.includes("textEditorRef.current?.blur();"),
    "the handle drops the caret itself, so the keyboard gets out of the way",
  );
  const armed = composerSrc.indexOf("onDragOverlay(ov.id, true)(e);");
  const dropped = composerSrc.indexOf("textEditorRef.current?.blur();");
  assert.ok(
    armed > 0 && dropped > armed,
    "the gesture must be armed before the blur fires",
  );
  assert.match(
    composerSrc,
    /min-h-\[40px\][^"]*touch-none/,
    "the handle is a real touch target, not a 24px pill",
  );
});

await check("the selected layer panel keeps move, rotate and font on screen", async () => {
  // The old toolbar was one horizontally scrolling strip: rotate and the fonts
  // sat past the fold on a 360px phone, so placing a layer relied on a drag
  // alone. The panel is tabbed, and status plus reset live next to the tabs.
  assert.ok(
    !composerSrc.includes('className="glass-strong rounded-2xl p-2 flex items-center gap-2 overflow-x-auto no-scrollbar"'),
    "the endless scrolling toolbar must be gone",
  );
  for (const label of ["\"move\", \"Move\"", "\"font\", \"Font\"", "\"colour\", \"Colour\""]) {
    assert.ok(composerSrc.includes(label), `missing tab ${label}`);
  }
  assert.ok(
    composerSrc.includes('role="tablist"') && composerSrc.includes('aria-selected={editTab === id}'),
    "the tabs must be real tabs, not decoration",
  );
  // Move: explicit nudges, a centre reset, a 15° stepper and a degree reset.
  assert.ok(composerSrc.includes("nudgeSelected(0, -0.015)"), "up nudge missing");
  assert.ok(composerSrc.includes("nudgeSelected(-0.015, 0)"), "left nudge missing");
  assert.ok(composerSrc.includes("nudgeSelected(0, 0.015)"), "down nudge missing");
  assert.ok(composerSrc.includes("nudgeSelected(0.015, 0)"), "right nudge missing");
  assert.ok(
    composerSrc.includes("updateSelected({ x: 0.5, y: 0.5 })"),
    "the pad centre must snap the layer back to the middle",
  );
  assert.ok(composerSrc.includes("rotateSelected(-15)") && composerSrc.includes("rotateSelected(15)"), "rotate steppers missing");
  assert.ok(composerSrc.includes("updateSelected({ rotate: 0 })"), "rotation reset missing");
  assert.ok(composerSrc.includes("min={-180}") && composerSrc.includes("max={180}"), "the fine rotation slider must cover a full turn");
  assert.ok(
    composerSrc.includes("it.rotate + delta + 180") &&
      composerSrc.includes("% 360) + 360) % 360) - 180"),
    "rotation must wrap instead of jumping past the slider limits",
  );
  // Font: a card per family that shows its own shape, not just its name.
  assert.ok(
    composerSrc.includes("style={{ fontFamily: f.stack }}>Aa</span>"),
    "font cards must show the font's own Aa",
  );
  assert.ok(
    composerSrc.includes("aria-pressed={sel.font === f.id}"),
    "the chosen font must be announced",
  );
  // Colour and Living text only exist on their own tab, so neither crowds Move.
  const colourTab = composerSrc.split('editTab === "colour"').length - 1;
  assert.ok(colourTab >= 2, "swatches and Living text belong to the colour tab");
  assert.ok((composerSrc.split('editTab === "font"').length - 1) >= 2, "styles and fonts belong to the font tab");
  // A two-letter word is ~30px wide; the drag area is padded without moving it.
  assert.ok(
    composerSrc.includes('padding: ov.kind === "image" ? undefined : 10'),
    "text and stickers need a wider grab area than their glyphs",
  );
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
