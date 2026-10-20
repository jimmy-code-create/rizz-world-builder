#!/usr/bin/env node
/** QA sheet for the wide Web Slinger banner. */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildBannerScene, W, H } from "./web-slinger-banner.mjs";
import { renderSvg } from "./web-slinger-svg.mjs";

const OUT = resolve(process.argv[2] ?? "/data/data/com.termux/files/usr/tmp/opencode/ws-banner");
mkdirSync(OUT, { recursive: true });
const FRAMES = [0, 24, 40, 56, 70, 78, 88, 96, 106, 130, 170, 200, 210, 230];
const { layers } = buildBannerScene();
const CELL_W = 400, CELL_H = 140, COLS = 3;
const rows = Math.ceil(FRAMES.length / COLS);
const cells = FRAMES.map((frame, index) => {
  const file = `b${frame}.svg`;
  writeFileSync(resolve(OUT, file), renderSvg(layers, frame, { width: W, height: H }));
  const x = (index % COLS) * CELL_W, y = Math.floor(index / COLS) * CELL_H;
  return `<g><rect x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" fill="#08080b"/><image xlink:href="${file}" x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}"/><text x="${x + 8}" y="${y + 16}" fill="#c8ff3d" font-size="12" font-family="monospace">f${frame}</text></g>`;
}).join("");
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${COLS * CELL_W} ${rows * CELL_H}" width="${COLS * CELL_W}" height="${rows * CELL_H}"><rect width="100%" height="100%" fill="#08080b"/>${cells}</svg>`;
writeFileSync(resolve(OUT, "sheet.svg"), sheet);
console.log(resolve(OUT, "sheet.svg"));
