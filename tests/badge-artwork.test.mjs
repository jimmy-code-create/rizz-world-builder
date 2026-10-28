/**
 * The badge emblems themselves (`public/badges/badges.svg`).
 *
 * `badge-sprite.test.mjs` guards the *contract* (every catalog slug has art, all
 * on the 24 grid, gradients resolve). This file guards the *drawing*: art is
 * easy to break in a later edit — a path with one bad coordinate renders blank,
 * a silhouette drifts off the grid and gets clipped, a medal grows until it
 * touches the edge, or two marks end up looking identical in a 20px name row.
 *
 * Every symbol is rasterised and measured rather than eyeballed. The pixel
 * checks skip themselves when `sharp` is not installed, like the BadgesMark
 * suite.
 *
 * Run: node tests/badge-artwork.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("../public/badges/badges.svg", import.meta.url), "utf8");
const ids = [...svg.matchAll(/<symbol id="([^"]+)"/g)].map((match) => match[1]);

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

/** One symbol's inner markup, standalone. Custom properties carry a fallback
 *  here because the extracted document has no stylesheet of its own. */
function symbolBody(id) {
  const start = svg.indexOf(`<symbol id="${id}"`);
  const bodyStart = svg.indexOf(">", start) + 1;
  const end = svg.indexOf("</symbol>", bodyStart);
  return svg
    .slice(bodyStart, end)
    .replace(/var\(--bz-ink,#0B0B0B\)/g, "#0B0B0B")
    .replace(/var\(--bz-lime,#C6FF1A\)/g, "#C6FF1A")
    .replace(/var\(--bz-white,#[0-9A-Fa-f]{6}\)/g, "#F2F2F2")
    .replace(/var\(--bz-grey,#[0-9A-Fa-f]{6}\)/g, "#3A3A3A");
}

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.log("badge-artwork: pixel checks skipped (sharp is not installed)");
}

/** Rasterise one emblem and return its coverage box plus composited pixels. */
async function rasterise(id, size, composite = false) {
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${symbolBody(id)}</svg>`;
  let pipeline = sharp(Buffer.from(svgMarkup)).ensureAlpha();
  if (composite) pipeline = pipeline.flatten({ background: "#141417" }).removeAlpha();
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  let covered = 0;
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;
  const rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * channels;
      if (composite || channels === 4) {
        const alpha = composite ? 255 : data[index + 3];
        if (alpha > 24) {
          covered += 1;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      const target = (y * size + x) * 3;
      rgb[target] = data[index];
      rgb[target + 1] = data[index + 1];
      rgb[target + 2] = data[index + 2];
    }
  }
  return { size, rgb, covered, ratio: covered / (size * size), minX, minY, maxX, maxY };
}

if (sharp) {
  await check("every emblem draws, inside the 24 grid, centred", async () => {
    const tooSmall = [];
    const clipped = [];
    const drifting = [];
    const blank = [];
    const weirdFill = [];
    for (const id of ids) {
      const art = await rasterise(id, 240);
      if (art.maxX < 0) {
        blank.push(id);
        continue;
      }
      if (art.minX < 1 || art.minY < 1 || art.maxX > 238 || art.maxY > 238) clipped.push(id);
      // An emblem that shrinks to a speck disappears beside a username; one
      // that fills the frame has eaten its own margin.
      const width = (art.maxX - art.minX + 1) / 240;
      const height = (art.maxY - art.minY + 1) / 240;
      if (width < 0.6 || height < 0.6) tooSmall.push(`${id} ${Math.round(width * 100)}x${Math.round(height * 100)}`);
      if (art.ratio < 0.1 || art.ratio > 0.92) weirdFill.push(`${id} ${(art.ratio * 100).toFixed(0)}%`);
      // Optical centring, not mathematical: 5% of the frame is the allowance.
      const driftX = Math.abs((art.minX + art.maxX) / 2 - 120) / 240;
      const driftY = Math.abs((art.minY + art.maxY) / 2 - 120) / 240;
      if (Math.max(driftX, driftY) > 0.05) drifting.push(`${id} ${(Math.max(driftX, driftY) * 100).toFixed(1)}%`);
    }
    assert.deepEqual(blank, [], "blank emblems (a path coordinate likely broke)");
    assert.deepEqual(clipped, [], "emblems touching the grid edge get clipped");
    assert.deepEqual(tooSmall, [], "emblems too small to read beside a name");
    assert.deepEqual(weirdFill, [], "emblems that are nearly empty or nearly solid");
    assert.deepEqual(drifting, [], "emblems off the optical centre");
  });

  await check("no two emblems look alike at 20px", async () => {
    // Two different coloured discs are distinct to the eye even when their
    // silhouettes overlap, so compare composited pixels rather than alpha.
    const small = new Map();
    for (const id of ids) small.set(id, await rasterise(id, 20, true));
    const collisions = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = small.get(ids[i]).rgb;
        const b = small.get(ids[j]).rgb;
        let sum = 0;
        for (let k = 0; k < a.length; k += 3) {
          const dr = a[k] - b[k];
          const dg = a[k + 1] - b[k + 1];
          const db = a[k + 2] - b[k + 2];
          sum += Math.sqrt(dr * dr + dg * dg + db * db);
        }
        const distance = sum / (20 * 20);
        if (distance < 26) {
          collisions.push(`${ids[i]} / ${ids[j]} (${distance.toFixed(0)} of 441)`);
        }
      }
    }
    assert.deepEqual(collisions, [], "emblems that read as the same mark in a name row");
  });
}

console.log(`\n${passed} checks passed.`);
