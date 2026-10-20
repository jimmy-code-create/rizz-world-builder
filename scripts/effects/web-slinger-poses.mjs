#!/usr/bin/env node
/**
 * QA storyboard for the Web Slinger rig.
 *
 * Renders a grid of frames with the avatar zone drawn in, so the swing, the
 * tuck, the landing and the perch can be judged without a browser.
 *
 *   node scripts/effects/web-slinger-poses.mjs [outDir]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildTimeline } from "./web-slinger-motion.mjs";
import { buildCharacter } from "./web-slinger-rig.mjs";
import { renderSvg } from "./web-slinger-svg.mjs";
import { W, H } from "./web-slinger-lib.mjs";

const OUT = resolve(process.argv[2] ?? "/data/data/com.termux/files/usr/tmp/opencode/ws-poses");
mkdirSync(OUT, { recursive: true });

const FRAMES = [0, 36, 52, 66, 72, 80, 88, 96, 104, 120, 150, 188, 198, 206, 214, 230];
const CELL = 256;
const COLS = 4;
const ROWS = Math.ceil(FRAMES.length / COLS);

const timeline = buildTimeline();
const hero = buildCharacter(timeline);

const cells = FRAMES.map((frame, index) => {
  const file = `pose-${frame}.svg`;
  writeFileSync(resolve(OUT, file), renderSvg([hero], frame, { width: W, height: H }));
  return { frame, file, index };
});

const width = COLS * CELL;
const height = ROWS * CELL;
const body = cells
  .map(({ frame, file, index }) => {
    const x = (index % COLS) * CELL;
    const y = Math.floor(index / COLS) * CELL;
    return `
  <g>
    <rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#0b0b10"/>
    <image xlink:href="${file}" x="${x}" y="${y}" width="${CELL}" height="${CELL}"/>
    <circle cx="${x + CELL / 2}" cy="${y + CELL / 2}" r="${(135 / W) * CELL}" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-dasharray="4 6"/>
    <circle cx="${x + CELL / 2}" cy="${y + CELL / 2}" r="${(168 / W) * CELL}" fill="none" stroke="#ffffff" stroke-opacity="0.1"/>
    <rect x="${x}" y="${y}" width="${CELL}" height="20" fill="#000000" opacity="0.55"/>
    <text x="${x + 8}" y="${y + 14}" fill="#c8ff3d" font-family="monospace" font-size="12">f${frame}</text>
  </g>`;
  })
  .join("");

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<rect width="100%" height="100%" fill="#08080b"/>
${body}
</svg>`;

writeFileSync(resolve(OUT, "sheet.svg"), sheet);
console.log(resolve(OUT, "sheet.svg"));
