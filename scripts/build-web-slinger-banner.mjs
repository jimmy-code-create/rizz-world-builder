#!/usr/bin/env node
/**
 * Builds the Web Slinger banner effect.
 *
 * Outputs
 *   public/effects/fx-web-slinger-banner.json       the wide Lottie file
 *   public/effects/fx-web-slinger-banner-frame.svg  a still of the landing
 *
 * The profile banner is wide (roughly 3:1 on desktop), so the hero gets its
 * own 1200x420 scene where the whole swing, flip and landing are visible.
 * The square avatar decoration is built separately by
 * `build-web-slinger-effect.mjs`.
 *
 * The character is original work: a masked web-slinger in the red-and-blue
 * spider aesthetic, drawn from scratch as bezier paths. No Marvel, Sony or
 * Disney assets, models or textures are used, referenced or required.
 *
 *   node scripts/build-web-slinger-banner.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildBannerLottie,
  buildBannerScene,
  W,
  H,
  FR,
  OP,
} from "./effects/web-slinger-banner.mjs";
import { renderSvg } from "./effects/web-slinger-svg.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = resolve(ROOT, "public/effects");

mkdirSync(OUT_DIR, { recursive: true });

const lottie = buildBannerLottie();
const json = JSON.stringify(lottie);
const lottiePath = resolve(OUT_DIR, "fx-web-slinger-banner.json");
writeFileSync(lottiePath, json);

const heroFrame = 130;
const layers = buildBannerScene().layers;
const still = renderSvg(layers, heroFrame, { width: W, height: H });
const stillPath = resolve(OUT_DIR, "fx-web-slinger-banner-frame.svg");
writeFileSync(stillPath, still);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

console.log(`Web Slinger banner`);
console.log(`  lottie  ${lottiePath}`);
console.log(
  `          ${kb(Buffer.byteLength(json))} · ${lottie.layers.length} layers · ${W}x${H} · ${FR}fps · ${OP} frames (${(OP / FR).toFixed(1)}s loop)`,
);
console.log(`  still   ${stillPath}`);
