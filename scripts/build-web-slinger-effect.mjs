#!/usr/bin/env node
/**
 * Builds the Web Slinger profile effect.
 *
 * Outputs
 *   public/effects/fx-web-slinger.json        the Lottie file — what Discord's
 *                                             profile effects are, and what the
 *                                             RIZZ app plays through lottie-web
 *   public/effects/fx-web-slinger-frame.svg   a still of the same scene
 *   public/effects/fx-web-slinger-contact.svg the same still on a light and a
 *                                             dark background, side by side
 *
 * The character is original work: a masked web-slinger in the red-and-blue
 * spider aesthetic, drawn from scratch as bezier paths. No Marvel, Sony or
 * Disney assets, models or textures are used, referenced or required.
 *
 *   node scripts/build-web-slinger-effect.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLottie, buildScene, AVATAR } from "./effects/web-slinger-scene.mjs";
import { renderSvg } from "./effects/web-slinger-svg.mjs";
import { W, H, FR, OP } from "./effects/web-slinger-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = resolve(ROOT, "public/effects");

mkdirSync(OUT_DIR, { recursive: true });

const lottie = buildLottie();
const json = JSON.stringify(lottie);

const lottiePath = resolve(OUT_DIR, "fx-web-slinger.json");
writeFileSync(lottiePath, json);

// A still from the hero moment, with the sigil lit.
const heroFrame = 140;
const layers = buildScene();
const still = renderSvg(layers, heroFrame, { width: W, height: H });
const stillPath = resolve(OUT_DIR, "fx-web-slinger-frame.svg");
writeFileSync(stillPath, still);

// A contact sheet: the still on a dark and on a light background, with the
// avatar disc drawn in place so the composition can be judged the way it will
// actually be seen. The still is referenced as an image so its gradients
// survive the inlining.
const contact = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W * 2 + 96} ${H + 72}" width="${W * 2 + 96}" height="${H + 72}">
  <defs>
    <clipPath id="disc-dark"><circle cx="${32 + W / 2}" cy="${48 + H / 2}" r="${AVATAR.r}"/></clipPath>
    <clipPath id="disc-light"><circle cx="${W + 64 + W / 2}" cy="${48 + H / 2}" r="${AVATAR.r}"/></clipPath>
  </defs>
  <rect width="100%" height="100%" fill="#0a0a0b"/>
  <rect x="32" y="48" width="${W}" height="${H}" fill="#0e0e10"/>
  <rect x="${W + 64}" y="48" width="${W}" height="${H}" fill="#f4f1e7"/>
  <image xlink:href="fx-web-slinger-frame.svg" x="32" y="48" width="${W}" height="${H}"/>
  <image xlink:href="fx-web-slinger-frame.svg" x="${W + 64}" y="48" width="${W}" height="${H}"/>
  <circle cx="${32 + W / 2}" cy="${48 + H / 2}" r="${AVATAR.r}" fill="#16161a" stroke="#2a2a2e" stroke-width="2"/>
  <circle cx="${W + 64 + W / 2}" cy="${48 + H / 2}" r="${AVATAR.r}" fill="#e2ddd0" stroke="#c9c3b4" stroke-width="2"/>
  <text x="32" y="32" fill="#a9a69c" font-family="system-ui, sans-serif" font-size="15">Dark background — the avatar disc is the darker circle</text>
  <text x="${W + 64}" y="32" fill="#6f6b60" font-family="system-ui, sans-serif" font-size="15">Light background — the avatar disc is the lighter circle</text>
</svg>`;
const contactPath = resolve(OUT_DIR, "fx-web-slinger-contact.svg");
writeFileSync(contactPath, contact);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

console.log(`Web Slinger effect`);
console.log(`  lottie  ${lottiePath}`);
console.log(
  `          ${kb(Buffer.byteLength(json))} · ${lottie.layers.length} layers · ${W}x${H} · ${FR}fps · ${OP} frames (${(OP / FR).toFixed(1)}s loop)`,
);
console.log(`  still   ${stillPath}`);
console.log(`  contact ${contactPath}`);
