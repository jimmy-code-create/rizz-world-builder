/**
 * Story Creator FX tests: pixel bakes, stroke smoothing, particle loops.
 * Pure math only — no canvas, no network.
 * Run: node tests/story-fx.test.mjs
 */
import assert from "node:assert/strict";
import {
  NEUTRAL_ADJUST,
  applyAdjustments,
  bakeFilter,
  createParticles,
  mulberry32,
  smoothStroke,
  stepParticles,
} from "../src/lib/story-creator/fx.ts";

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

function testImage(w, h, fill) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    px[i * 4] = (fill(i) ?? 128) % 256;
    px[i * 4 + 1] = ((fill(i) ?? 128) + 40) % 256;
    px[i * 4 + 2] = ((fill(i) ?? 128) + 90) % 256;
    px[i * 4 + 3] = 255;
  }
  return px;
}

await check("neutral adjustments leave pixels alone", async () => {
  const px = testImage(8, 8, (i) => i * 7);
  const before = px.slice();
  applyAdjustments(px, 8, 8, NEUTRAL_ADJUST);
  assert.deepEqual([...px], [...before]);
});

await check("brightness and bw behave", async () => {
  const px = testImage(4, 4, () => 100);
  applyAdjustments(px, 4, 4, { ...NEUTRAL_ADJUST, brightness: 1.2 });
  assert.ok(px[0] > 100, String(px[0]));
  const bw = testImage(4, 4, (i) => i * 30);
  bakeFilter(bw, 4, 4, "bw");
  for (let i = 0; i < 16; i += 1) {
    assert.equal(bw[i * 4], bw[i * 4 + 1]);
    assert.equal(bw[i * 4 + 1], bw[i * 4 + 2]);
  }
});

await check("seeded bakes are deterministic", async () => {
  for (const id of ["glitch", "rgb-split", "vhs", "neon-edge", "dreamy", "pixelate"]) {
    const a = testImage(24, 24, (i) => (i * 13) % 256);
    const b = a.slice();
    bakeFilter(a, 24, 24, id, 42);
    bakeFilter(b, 24, 24, id, 42);
    assert.deepEqual([...a], [...b], `${id} not deterministic`);
    const c = testImage(24, 24, (i) => (i * 13) % 256);
    assert.ok(!c.every((v, i) => v === a[i]), `${id} changed nothing`);
  }
});

await check("neon edge is dark on flat fields", async () => {
  const px = testImage(8, 8, () => 150);
  bakeFilter(px, 8, 8, "neon-edge");
  let total = 0;
  for (let i = 0; i < px.length; i += 4) total += px[i] + px[i + 1] + px[i + 2];
  assert.ok(total / (px.length / 4) < 60, String(total));
});

await check("stroke smoothing keeps endpoints, adds points", async () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 30 },
    { x: 40, y: 10 },
    { x: 60, y: 60 },
  ];
  const out = smoothStroke(pts, 6);
  assert.ok(out.length > pts.length);
  assert.deepEqual({ x: out[0].x, y: out[0].y }, { x: 0, y: 0 });
  const last = out[out.length - 1];
  assert.deepEqual({ x: last.x, y: last.y }, { x: 60, y: 60 });
  assert.deepEqual(smoothStroke([{ x: 1, y: 2 }]), [{ x: 1, y: 2 }]);
  assert.ok(out.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

await check("particles loop forever within bounds", async () => {
  for (const kind of ["hearts", "confetti", "snow", "fireflies", "rain", "leaks"]) {
    const ps = createParticles(kind, 9);
    assert.ok(ps.length > 0);
    for (let f = 0; f < 600; f += 1) stepParticles(ps, kind, 1 / 30);
    for (const p of ps) {
      assert.ok(p.x > -0.1 && p.x < 1.1 && p.y > -0.1 && p.y < 1.1, `${kind} escaped`);
      assert.ok(Number.isFinite(p.rot));
    }
  }
  const r1 = mulberry32(5);
  const r2 = mulberry32(5);
  assert.equal(r1(), r2());
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}.`);
