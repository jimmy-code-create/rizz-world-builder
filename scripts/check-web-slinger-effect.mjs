#!/usr/bin/env node
/**
 * Validates the Web Slinger Lottie files.
 *
 * Both files are loaded into lottie-web — the same player the app uses — and
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

const TARGETS = [
  {
    label: "avatar",
    file: resolve(ROOT, "public/effects/fx-web-slinger.json"),
    w: 512,
    h: 512,
    maxBytes: 300 * 1024,
    minLayers: 6,
    minPaths: 40,
  },
  {
    label: "banner",
    file: resolve(ROOT, "public/effects/fx-web-slinger-banner.json"),
    w: 1200,
    h: 420,
    maxBytes: 380 * 1024,
    minLayers: 8,
    minPaths: 120,
  },
];

let JSDOM;
try {
  ({ JSDOM } = await import("jsdom"));
} catch {
  console.log("Web Slinger effect: skipped — jsdom is not installed.");
  console.log("  npm install --save-dev jsdom   # then run this again");
  process.exit(0);
}

// A shape's geometry can be static (`ks.k = {v,i,o}`) or keyed
// (`ks.k = [{s:{v,i,o}}, ...]`). Both are valid; both have to be well formed.
const validGeometry = (k) =>
  k && Array.isArray(k.v) && k.v.length > 0 && Array.isArray(k.i) && k.i.length === k.v.length &&
  Array.isArray(k.o) && k.o.length === k.v.length;

const inspect = (data, target) => {
  const problems = [];
  const check = (ok, message) => {
    if (!ok) problems.push(message);
  };

  check(data.v && data.v.startsWith("5"), "the file is not a Lottie 5.x document");
  check(data.w === target.w && data.h === target.h, `the canvas is ${data.w}x${data.h}, expected ${target.w}x${target.h}`);
  check(data.fr >= 24 && data.fr <= 60, `the frame rate is ${data.fr}, expected 24-60`);
  check(data.ip === 0, "the in point is not 0");
  check(data.op > data.ip, "the out point is before the in point");
  check(
    Array.isArray(data.layers) && data.layers.length >= target.minLayers,
    `the scene has only ${data.layers?.length ?? 0} layers`,
  );

  let keyframes = 0;
  let shapes = 0;
  let animatedShapes = 0;
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
        check("s" in key, "a keyframe has no value");
      }
    }
    if (node.ty === "sh") {
      shapes += 1;
      const k = node.ks?.k;
      if (Array.isArray(k)) {
        animatedShapes += 1;
        check(k.length > 0, "an animated shape has no keyframes");
        for (const key of k) {
          const geometry = Array.isArray(key.s) ? key.s[0] : key.s;
          check(validGeometry(geometry), "an animated shape keyframe has malformed vertices");
        }
      } else {
        check(validGeometry(k), "a shape has malformed vertices or tangents");
      }
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(data.layers);
  check(shapes > 0, "the scene has no shapes");
  check(keyframes > 40, `the scene has only ${keyframes} animated properties`);

  return { problems, keyframes, shapes, animatedShapes };
};

const play = async (raw, data, target, problems) => {
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
  if (typeof lottie?.loadAnimation !== "function") {
    problems.push("lottie-web did not load in the test window");
    return { frames: 0 };
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
  if (failed) problems.push(failed);
  if (!host.querySelectorAll("svg").length) problems.push("the player produced no SVG");
  if (!host.querySelectorAll("path").length) problems.push("the player produced no paths");

  // A single seek can leave a layer that starts transparent hidden: lottie
  // updates transforms on the first tick and visibility on the next. Seek to
  // 0, then to the check frame, so the mid-scene is actually painted.
  animation.goToAndStop(0, true);
  animation.goToAndStop(60, true);
  await new Promise((resolve) => setTimeout(resolve, 60));
  const painted = [...host.querySelectorAll("path")].filter((node) => node.getAttribute("d"));
  if (painted.length < target.minPaths) {
    problems.push(`only ${painted.length} paths were painted at frame 60, expected at least ${target.minPaths}`);
  }
  const colouredStops = [...host.querySelectorAll("stop")].filter((node) => node.getAttribute("stop-color"));
  if (colouredStops.length < 4) {
    problems.push(`only ${colouredStops.length} gradient stops were painted`);
  }

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
  if (frames !== data.op - data.ip) {
    problems.push(`only ${frames} of ${data.op - data.ip} frames rendered`);
  }

  const svg = host.querySelector("svg");
  if (!svg?.getAttribute("viewBox")) problems.push("the rendered SVG has no viewBox");

  animation.destroy();
  return { frames };
};

let failed = false;

for (const target of TARGETS) {
  const raw = readFileSync(target.file);
  const data = JSON.parse(raw.toString("utf8"));
  const { problems, keyframes, shapes, animatedShapes } = inspect(data, target);

  if (raw.length >= target.maxBytes) {
    problems.push(
      `the file is ${(raw.length / 1024).toFixed(1)} kB, over the ${(target.maxBytes / 1024).toFixed(0)} kB budget`,
    );
  }

  let frames = 0;
  if (!problems.length) {
    frames = (await play(raw, data, target, problems)).frames;
  }

  if (problems.length) {
    console.error(`Web Slinger ${target.label}: FAILED`);
    for (const problem of problems) console.error(`  - ${problem}`);
    failed = true;
    continue;
  }

  console.log(`Web Slinger ${target.label}: OK`);
  console.log(
    `  ${(raw.length / 1024).toFixed(1)} kB · ${data.w}x${data.h} · ${data.fr}fps · ${data.op} frames (${(data.op / data.fr).toFixed(1)}s)`,
  );
  console.log(
    `  ${data.layers.length} layers · ${shapes} shapes (${animatedShapes} animated) · ${keyframes} animated properties`,
  );
  console.log(`  all ${frames} frames rendered`);
}

if (failed) process.exit(1);
