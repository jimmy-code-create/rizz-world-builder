/**
 * Cat Studio — config validation, clamping, shape maths and the layer stack.
 * Run: node tests/cat-studio.test.mjs
 */
import assert from "node:assert/strict";
import {
  BREED_PRESETS,
  DEFAULT_CONFIG,
  SHAPE_RANGES,
  clampShape,
  randomCatConfig,
  sanitizeCatConfig,
  serializeCatConfig,
  shapeTransforms,
} from "../src/features/cat-studio/config.ts";
import { CAT_ITEMS, ITEM_IDS_BY_SLOT, RARITY_LABEL } from "../src/features/cat-studio/catalog.ts";
import { catLayerStack } from "../src/features/cat-studio/parts.ts";
import { isOnlyMediaMarker, renderGifSegments } from "../src/lib/gif-content.ts";

let checks = 0;
const ok = (label, fn) => {
  fn();
  checks += 1;
  console.log("  ✓", label);
};

ok("defaults are stable through a round trip", () => {
  assert.deepEqual(sanitizeCatConfig(DEFAULT_CONFIG), DEFAULT_CONFIG);
  assert.deepEqual(sanitizeCatConfig(null), DEFAULT_CONFIG);
  assert.deepEqual(sanitizeCatConfig({}), DEFAULT_CONFIG);
});

ok("sliders clamp to their ranges instead of being trusted", () => {
  const shape = clampShape({
    body: 9,
    head: -3,
    earSize: 1.3,
    earTilt: 400,
    eyeSize: 0.1,
    eyeSpacing: "1.1",
    tailLength: Number.NaN,
  });
  assert.equal(shape.body, SHAPE_RANGES.body[1]);
  assert.equal(shape.head, SHAPE_RANGES.head[0]);
  assert.equal(shape.earSize, 1.3);
  assert.equal(shape.earTilt, SHAPE_RANGES.earTilt[1]);
  assert.equal(shape.eyeSize, SHAPE_RANGES.eyeSize[0]);
  assert.equal(shape.eyeSpacing, 1.1);
  assert.equal(shape.tailLength, DEFAULT_CONFIG.shape.tailLength);
});

ok("unknown pattern, expression and colours fall back", () => {
  const config = sanitizeCatConfig({
    pattern: "polka",
    expression: "angry",
    colors: { fur: "red", accent: "#zzz", eye: "#ffffff" },
  });
  assert.equal(config.pattern, DEFAULT_CONFIG.pattern);
  assert.equal(config.expression, DEFAULT_CONFIG.expression);
  assert.equal(config.colors.fur, DEFAULT_CONFIG.colors.fur);
  assert.equal(config.colors.accent, DEFAULT_CONFIG.colors.accent);
  assert.equal(config.colors.eye, "#ffffff");
});

ok("an item can only sit in its own slot", () => {
  const config = sanitizeCatConfig({
    slots: { hat: "eyewear_sunglasses", neck: "neck_gold_chain", face: "face_nope" },
  });
  assert.equal(config.slots.hat, null);
  assert.equal(config.slots.neck, "neck_gold_chain");
  assert.equal(config.slots.face, null);
});

ok("shape maths is derived from the sliders", () => {
  const t = shapeTransforms({ ...DEFAULT_CONFIG.shape, eyeSpacing: 1.05, tailLength: 1.2, earTilt: 8 });
  assert.equal(t.eyes.gap, 1.05 * 52);
  assert.equal(t.ears.tilt, 8);
  assert.ok(t.tail.rotate > 6);
  const wide = shapeTransforms({ ...DEFAULT_CONFIG.shape, body: 1.25 });
  assert.equal(wide.body.scaleX, 1.25);
  assert.ok(wide.body.scaleY > 1.25);
});

ok("catalog ids are unique and priced, with 4+ items per slot", () => {
  const ids = CAT_ITEMS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of CAT_ITEMS) {
    assert.ok(RARITY_LABEL[item.rarity], `rarity label for ${item.id}`);
    assert.equal(typeof item.price, "number");
    assert.ok(item.price >= 0);
    assert.equal(item.requires_purify, item.rarity === "luxe", `${item.id} luxe ⇒ purify`);
  }
  for (const [slot, list] of Object.entries(ITEM_IDS_BY_SLOT)) {
    assert.ok(list.length >= 4, `${slot} has ${list.length} items`);
  }
});

ok("layer stack follows the documented order", () => {
  const order = catLayerStack({
    ...DEFAULT_CONFIG,
    slots: {
      ...DEFAULT_CONFIG.slots,
      hat: "hat_crown",
      backdrop: "backdrop_marble",
      eyewear: "eyewear_monocle",
      neck: "neck_gold_chain",
      face: "face_blush",
    },
  }).map((layer) => layer.key);
  assert.equal(order[0], "backdrop");
  assert.ok(order.indexOf("tail") < order.indexOf("body"));
  assert.ok(order.indexOf("body") < order.indexOf("head"));
  assert.ok(order.indexOf("head") < order.indexOf("ears"));
  assert.ok(order.indexOf("eyes") < order.indexOf("neck"));
  assert.ok(order.indexOf("neck") < order.indexOf("hat"));
  assert.equal(order.at(-1), "eyewear");
  assert.equal(new Set(order).size, order.length);
});

ok("renderer output is ours and contains no script or url", () => {
  const markup = catLayerStack({ ...DEFAULT_CONFIG, slots: { ...DEFAULT_CONFIG.slots, hat: "hat_crown" } })
    .map((layer) => layer.markup)
    .join("");
  assert.ok(markup.includes("cat-ear-l"));
  assert.ok(!/<script/i.test(markup));
  assert.ok(!/https?:/i.test(markup));
  assert.ok(!/on\w+=/i.test(markup));
});

ok("serialize drops anything the server should not see", () => {
  const payload = serializeCatConfig({ ...DEFAULT_CONFIG, extra: "nope", shape: { ...DEFAULT_CONFIG.shape, body: 99 } });
  assert.deepEqual(Object.keys(payload).sort(), ["base", "colors", "expression", "flex", "pattern", "shape", "slots"]);
  assert.equal(payload.shape.body, SHAPE_RANGES.body[1]);
});

ok("randomize only wears owned items", () => {
  const owned = new Set(["hat_beret"]);
  for (let i = 0; i < 25; i += 1) {
    const config = randomCatConfig((id) => owned.has(id));
    for (const id of Object.values(config.slots)) {
      if (id) assert.ok(owned.has(id), `${id} is not owned`);
    }
  }
});

ok("the cat sits on your photo unless you say otherwise", () => {
  assert.equal(DEFAULT_CONFIG.flex, "sticker");
  assert.equal(sanitizeCatConfig({}).flex, "sticker");
  assert.equal(sanitizeCatConfig({ flex: "photo" }).flex, "photo");
  assert.equal(sanitizeCatConfig({ flex: "name" }).flex, "name");
  assert.equal(sanitizeCatConfig({ flex: "everywhere" }).flex, "sticker");
});

ok("a sent cat is media, not a message with a URL in it", () => {
  const url = "https://example.supabase.co/storage/v1/object/public/avatars/abc/cat-1.png";
  const marker = `![sticker](${url})`;
  const segments = renderGifSegments(marker);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].isSticker, true);
  assert.equal(segments[0].value, url);
  assert.equal(isOnlyMediaMarker(marker), true);
  assert.equal(isOnlyMediaMarker(`look at my cat ${marker}`), false);
});

ok("breed presets are all valid configs", () => {
  for (const preset of BREED_PRESETS) {
    const config = sanitizeCatConfig({ ...DEFAULT_CONFIG, ...preset.config });
    assert.equal(config.shape.body, preset.config.shape.body);
    assert.equal(config.pattern, preset.config.pattern);
  }
});

console.log(`\ncat-studio: ${checks} checks passed`);
