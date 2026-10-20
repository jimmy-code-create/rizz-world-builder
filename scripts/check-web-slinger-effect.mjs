#!/usr/bin/env node
/**
 * Validates the Web Slinger Lottie file.
 *
 * The file is loaded into lottie-web — the same player the app uses — and
 * stepped through every frame of the loop. If the JSON is malformed, the
 * player throws or leaves the DOM empty, and this script fails.
 *
 * It also checks the things that make a good profile effect: a real size, a
 * real frame rate, a loop that closes, and a file small enough to ship.
 *
 *   node scripts/check-web-slinger-effect.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const FILE = resolve(ROOT, "public/effects/fx-web-slinger.json");

const MAX_BYTES = 300 * 1024; // Discord profile effect uploads stay well under this.

let JSDOM;
try {
  ({ JSDOM } = await import("jsdom"));
} catch {
  console.log("Web Slinger effect: skipped — jsdom is not installed.");
  console.log("  npm install --save-dev jsdom   # then run this again");
  process.exit(0);
}

const raw = readFileSync(FILE);
const data = JSON.parse(raw.toString("utf8"));

const problems = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
};

check(data.v && data.v.startsWith("5"), "the file is not a Lottie 5.x document");
check(data.w === 512 && data.h === 512, `the canvas is ${data.w}x${data.h}, expected 512x512`);
check(data.fr >= 24 && data.fr <= 60, `the frame rate is ${data.fr}, expected 24-60`);
check(data.ip === 0, "the in point is not 0");
check(data.op > data.ip, "the out point is before the in point");
check(Array.isArray(data.layers) && data.layers.length >= 8, "the scene has too few layers");
check(
  raw.length < MAX_BYTES,
  `the file is ${(raw.length / 1024).toFixed(1)} kB, over the ${(MAX_BYTES / 1024).toFixed(0)} kB budget`,
);

// Every animated property has to be a real keyframe list.
let keyframes = 0;
let shapes = 0;
const walk = (node) => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  if (node.a === 1 && Array.isArray(node.k)) {
    keyframes += 1;
    for (const key of node.k) {
      check(typeof key.t === "number", "a keyframe has no time");
      check(Array.isArray(key.s), "a keyframe has no value");
    }
  }
  if (node.ty === "sh") {
    shapes += 1;
    const k = node.ks?.k;
    check(k && Array.isArray(k.v) && k.v.length > 0, "a shape has no vertices");
    check(
      k && Array.isArray(k.i) && k.i.length === k.v.length,
      "a shape's tangents do not match its vertices",
    );
    check(
      k && Array.isArray(k.o) && k.o.length === k.v.length,
      "a shape's tangents do not match its vertices",
    );
  }
  for (const value of Object.values(node)) walk(value);
};
walk(data.layers);
check(shapes > 0, "the scene has no shapes");
check(keyframes > 40, `the scene has only ${keyframes} animated properties`);

// Now play it, the way the app does. lottie-web is a browser bundle, so it
// is loaded into the jsdom window rather than imported.
const dom = new JSDOM(`<!doctype html><html><body><div id="host"></div></body></html>`, {
  pretendToBeVisual: true,
  runScripts: "dangerously",
});
const playerSource = readFileSync(
  resolve(ROOT, "node_modules/lottie-web/build/player/lottie.js"),
  "utf8",
);
// lottie-web touches the canvas API while it loads, even when the SVG
// renderer is the one in use. jsdom has no canvas, so a stub is enough.
dom.window.HTMLCanvasElement.prototype.getContext = () => ({
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  globalAlpha: 1,
  globalCompositeOperation: "",
  save() {},
  restore() {},
  beginPath() {},
  closePath() {},
  moveTo() {},
  lineTo() {},
  arc() {},
  fill() {},
  stroke() {},
  rect() {},
  translate() {},
  rotate() {},
  scale() {},
  setTransform() {},
  transform() {},
  clip() {},
  clearRect() {},
  fillRect() {},
  strokeRect() {},
  drawImage() {},
  measureText: () => ({ width: 0 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  canvas: null,
});
const script = dom.window.document.createElement("script");
script.textContent = playerSource;
dom.window.document.head.appendChild(script);

const lottie = dom.window.lottie;
check(typeof lottie?.loadAnimation === "function", "lottie-web did not load in the test window");
if (typeof lottie?.loadAnimation !== "function") {
  console.error("Web Slinger effect: FAILED");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
global.SVGElement = dom.window.SVGElement;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame =
  dom.window.requestAnimationFrame?.bind(dom.window) ?? ((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = dom.window.cancelAnimationFrame?.bind(dom.window) ?? clearTimeout;

const host = dom.window.document.getElementById("host");
const animation = lottie.loadAnimation({
  container: host,
  renderer: "svg",
  loop: true,
  autoplay: false,
  animationData: data,
});

let failed = null;
animation.addEventListener("data_failed", () => {
  failed = "the player rejected the file";
});

await new Promise((resolve) => setTimeout(resolve, 120));
check(!failed, failed ?? "");
check(host.querySelectorAll("svg").length > 0, "the player produced no SVG");
check(host.querySelectorAll("path").length > 0, "the player produced no paths");

// Step the whole loop: every frame has to render without throwing.
let frames = 0;
for (let frame = data.ip; frame < data.op; frame += 1) {
  try {
    animation.goToAndStop(frame, true);
    frames += 1;
  } catch (error) {
    problems.push(`frame ${frame} threw: ${error.message}`);
    break;
  }
}
check(frames === data.op - data.ip, `only ${frames} of ${data.op - data.ip} frames rendered`);

const svg = host.querySelector("svg");
check(!!svg?.getAttribute("viewBox"), "the rendered SVG has no viewBox");

animation.destroy();

if (problems.length) {
  console.error("Web Slinger effect: FAILED");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log("Web Slinger effect: OK");
console.log(
  `  ${(raw.length / 1024).toFixed(1)} kB · ${data.w}x${data.h} · ${data.fr}fps · ${data.op} frames (${(data.op / data.fr).toFixed(1)}s)`,
);
console.log(`  ${data.layers.length} layers · ${shapes} shapes · ${keyframes} animated properties`);
console.log(`  all ${frames} frames rendered`);
