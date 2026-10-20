#!/usr/bin/env node
/**
 * Build the four cinematic profile effects from the supplied source reel.
 *
 * Usage:
 *   CINEMATIC_SOURCE=/path/to/source.mp4 node scripts/effects/build-cinematic.mjs
 *   CINEMATIC_SOURCE=... node scripts/effects/build-cinematic.mjs --only=sakura-bloom
 *
 * The source reel is not committed. The generated WebM files use VP9 with a
 * real alpha plane (yuva420p) and the posters are alpha PNGs. The source
 * checkerboard is removed with a saturation/luma matte rather than a chroma
 * key, so white highlights and the petals survive.
 *
 * The reel is a compilation of four takes:
 *   web-slinger    5.2s - 14.8s
 *   sakura-bloom  15.2s - 24.8s
 *   arcane-nexus  25.2s - 34.8s
 *   sakura-storm  35.2s - 44.8s
 *
 * The video canvas is 1600x480. The effect itself is 853x480, centred, with
 * transparent sides so a member's banner image still shows through.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";

const SOURCE =
  process.env.CINEMATIC_SOURCE ||
  "/data/data/com.termux/files/usr/tmp/opencode/effects-video/source.mp4";
const OUT_DIR = path.resolve("public/effects/cinematic");
const TMP_DIR = path.resolve("scripts/effects/.tmp-cinematic");

const W = 960;
const H = 540;
const OUT_W = 1600;
const OUT_H = 480;
const FX_W = 853;
const FX_H = 480;
const FX_X = Math.floor((OUT_W - FX_W) / 2);
const FPS = 24;
const DURATION = 9.6;
const TOTAL_FRAMES = Math.round(FPS * DURATION);
const FADE_FRAMES = Math.max(1, Math.round(FPS * 0.25));
const CRF = 31;

const CLIPS = [
  {
    slug: "web-slinger",
    start: 5.2,
    kind: "spider",
    posterFrame: 140,
    logoRect: { x: 0.88 * W, y: 0.86 * H },
  },
  {
    slug: "sakura-bloom",
    start: 15.2,
    kind: "cherry",
    posterFrame: 100,
    glow: 1,
    logoRect: { x: 0.88 * W, y: 0.86 * H },
  },
  {
    slug: "arcane-nexus",
    start: 25.2,
    kind: "sci",
    posterFrame: 100,
    logoRect: { x: 790, y: 430 },
  },
  {
    slug: "sakura-storm",
    start: 35.2,
    kind: "cherry",
    posterFrame: 100,
    glow: 1.12,
    logoRect: { x: 0.88 * W, y: 0.86 * H },
  },
];

const FRAME_BYTES = W * H * 3;
const RGBA_BYTES = W * H * 4;

function log(...args) {
  console.log("[cinematic]", ...args);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Four-connected component walker used to remove specks and fill holes. */
function components(mask, value) {
  const seen = new Uint8Array(W * H);
  const out = [];
  for (let seed = 0; seed < W * H; seed++) {
    if (mask[seed] !== value || seen[seed]) continue;
    const stack = [seed];
    seen[seed] = 1;
    const pixels = [];
    let touchesEdge = false;
    while (stack.length) {
      const p = stack.pop();
      pixels.push(p);
      const x = p % W;
      const y = (p / W) | 0;
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) touchesEdge = true;
      if (x > 0 && mask[p - 1] === value && !seen[p - 1]) {
        seen[p - 1] = 1;
        stack.push(p - 1);
      }
      if (x < W - 1 && mask[p + 1] === value && !seen[p + 1]) {
        seen[p + 1] = 1;
        stack.push(p + 1);
      }
      if (y > 0 && mask[p - W] === value && !seen[p - W]) {
        seen[p - W] = 1;
        stack.push(p - W);
      }
      if (y < H - 1 && mask[p + W] === value && !seen[p + W]) {
        seen[p + W] = 1;
        stack.push(p + W);
      }
    }
    out.push({ pixels, touchesEdge });
  }
  return out;
}

/**
 * Separable square-kernel morphology. A naive 9x9/13x13 scan over every
 * frame is far too slow on a phone; horizontal then vertical passes give the
 * same result at O(radius) per pixel.
 */
function dilate(src, radius) {
  const horizontal = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let any = 0;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(W - 1, x + radius);
      for (let xx = x0; xx <= x1; xx++) {
        if (src[y * W + xx]) {
          any = 1;
          break;
        }
      }
      horizontal[y * W + x] = any;
    }
  }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(H - 1, y + radius);
    for (let x = 0; x < W; x++) {
      let any = 0;
      for (let yy = y0; yy <= y1; yy++) {
        if (horizontal[yy * W + x]) {
          any = 1;
          break;
        }
      }
      out[y * W + x] = any;
    }
  }
  return out;
}

function erode(src, radius) {
  const horizontal = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let all = 1;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(W - 1, x + radius);
      for (let xx = x0; xx <= x1; xx++) {
        if (!src[y * W + xx]) {
          all = 0;
          break;
        }
      }
      horizontal[y * W + x] = all;
    }
  }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(H - 1, y + radius);
    for (let x = 0; x < W; x++) {
      let all = 1;
      for (let yy = y0; yy <= y1; yy++) {
        if (!horizontal[yy * W + x]) {
          all = 0;
          break;
        }
      }
      out[y * W + x] = all;
    }
  }
  return out;
}

/** A small box blur on the alpha plane; keeps edges soft at banner size. */
function blurAlpha(src) {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let n = 0;
      for (let yy = -1; yy <= 1; yy++) {
        const ny = y + yy;
        if (ny < 0 || ny >= H) continue;
        for (let xx = -1; xx <= 1; xx++) {
          const nx = x + xx;
          if (nx < 0 || nx >= W) continue;
          sum += src[ny * W + nx];
          n++;
        }
      }
      out[y * W + x] = sum / n;
    }
  }
  return out;
}

function clearLogo(rgba, rect) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  for (let y = y0; y < H; y++) {
    for (let x = x0; x < W; x++) {
      rgba[(y * W + x) * 4 + 3] = 0;
    }
  }
}

function applyFade(rgba, index) {
  const fade = Math.min(1, index / FADE_FRAMES, (TOTAL_FRAMES - 1 - index) / FADE_FRAMES);
  if (fade >= 1) return;
  const factor = Math.max(0, fade);
  for (let p = 3; p < rgba.length; p += 4) {
    rgba[p] = Math.round(rgba[p] * factor);
  }
}

/**
 * The spider take is a close-up / landing montage on a checkerboard. Keep the
 * saturated suit and the dark suit; neutral highlights inside the silhouette
 * (the lenses) are cleaned to a cool white. The generic web strands are
 * intentionally excluded: they are transparent against a checkerboard and
 * would carry the pattern into the overlay.
 */
function processSpider(rgb) {
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = rgb[i];
      const g = rgb[i + 1];
      const b = rgb[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = (max - min) / Math.max(1, max);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      mask[y * W + x] = sat > 0.12 || lum < 140 ? 1 : 0;
    }
  }

  for (const c of components(mask, 1)) {
    if (c.pixels.length < 120) for (const p of c.pixels) mask[p] = 0;
  }
  for (const c of components(mask, 0)) {
    if (!c.touchesEdge && c.pixels.length < 7200) for (const p of c.pixels) mask[p] = 1;
  }

  // Close the silhouette, then erode slightly more than we closed so the
  // checkerboard's bright anti-aliased rim does not survive as a white halo.
  const closed = dilate(mask, 4);
  const trimmed = erode(closed, 6);
  const alpha = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = trimmed[p];
  const softAlpha = blurAlpha(alpha);

  const out = Buffer.alloc(RGBA_BYTES);
  for (let p = 0; p < W * H; p++) {
    const i = p * 3;
    let r = rgb[i];
    let g = rgb[i + 1];
    let b = rgb[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = (max - min) / Math.max(1, max);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (softAlpha[p] > 0.03 && sat < 0.08 && lum > 165) {
      r = 238;
      g = 238;
      b = 242;
    }
    out[p * 4] = r;
    out[p * 4 + 1] = g;
    out[p * 4 + 2] = b;
    out[p * 4 + 3] = Math.round(softAlpha[p] * 255);
  }
  return out;
}

/**
 * Cherry takes: the petals are saturated; the baked checkerboard and the
 * translucent ring haze are neutral. A saturation/luma matte leaves clean
 * petals, and a procedural rose halo supplies the soft ring the haze used to
 * provide without any checker texture.
 */
function processCherry(rgb, glowMultiplier) {
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = rgb[i];
      const g = rgb[i + 1];
      const b = rgb[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = (max - min) / Math.max(1, max);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      mask[y * W + x] = sat > 0.19 && lum < 228 ? 1 : 0;
    }
  }

  for (const c of components(mask, 1)) {
    if (c.pixels.length < 48) for (const p of c.pixels) mask[p] = 0;
  }
  for (const c of components(mask, 0)) {
    if (!c.touchesEdge && c.pixels.length < 1800) for (const p of c.pixels) mask[p] = 1;
  }

  const alpha = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = mask[p];
  const soft = blurAlpha(alpha);

  const out = Buffer.alloc(RGBA_BYTES);
  const cx = 480;
  const cy = 276;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const i = p * 3;
      const r = Math.hypot(x - cx, y - cy);
      // The source already carries a delicate rose trail. Keep the added
      // halo barely there so it reads as light, not as a grey smoke ring on
      // a white or pastel banner.
      const core = Math.exp(-((r - 282) ** 2) / (18 * 18)) * 0.05;
      const halo = Math.exp(-((r - 290) ** 2) / (75 * 75)) * 0.012;
      const thin = Math.exp(-((r - 282) ** 2) / (4 * 4)) * 0.02;
      const glow = Math.min(1, (core + halo + thin) * glowMultiplier);
      const petalAlpha = r < 160 ? 0 : soft[p];
      const a = petalAlpha + glow * (1 - petalAlpha);
      let rr = 0;
      let gg = 0;
      let bb = 0;
      if (a > 0.001) {
        const pr = rgb[i];
        const pg = rgb[i + 1];
        const pb = rgb[i + 2];
        rr = (pr * petalAlpha + 250 * glow * (1 - petalAlpha)) / a;
        gg = (pg * petalAlpha + 172 * glow * (1 - petalAlpha)) / a;
        bb = (pb * petalAlpha + 192 * glow * (1 - petalAlpha)) / a;
      }
      out[p * 4] = Math.round(rr);
      out[p * 4 + 1] = Math.round(gg);
      out[p * 4 + 2] = Math.round(bb);
      out[p * 4 + 3] = Math.round(a * 255);
    }
  }
  return out;
}

/**
 * The arcane take is additive light on black. Alpha is derived from the
 * brightest channel, then the colour is unpremultiplied so the ring keeps its
 * neon saturation over a light or dark banner. The Gemini corner mark is
 * cleared by rectangle (it sits outside the ring).
 */
function processSci(rgb, logoRect) {
  const out = Buffer.alloc(RGBA_BYTES);
  for (let p = 0; p < W * H; p++) {
    const i = p * 3;
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];
    const max = Math.max(r, g, b);
    let a = max < 30 ? 0 : Math.min(1, (max - 30) / 200);
    a = Math.pow(a, 0.9);
    out[p * 4] = a > 0.01 ? Math.round(Math.min(255, r / a)) : 0;
    out[p * 4 + 1] = a > 0.01 ? Math.round(Math.min(255, g / a)) : 0;
    out[p * 4 + 2] = a > 0.01 ? Math.round(Math.min(255, b / a)) : 0;
    out[p * 4 + 3] = Math.round(a * 255);
  }
  clearLogo(out, logoRect);
  return out;
}

function savePosterFrame(clip, rgba) {
  const file = path.join(TMP_DIR, `${clip.slug}-poster.rgba`);
  fs.writeFileSync(file, rgba);
  return file;
}

function buildPoster(clip, posterRaw) {
  const poster = path.join(OUT_DIR, `${clip.slug}.png`);
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${W}x${H}`,
      "-i",
      posterRaw,
      "-vf",
      `scale=${FX_W}:${FX_H}:flags=lanczos,pad=${OUT_W}:${OUT_H}:${FX_X}:0:color=black@0,format=rgba`,
      "-frames:v",
      "1",
      poster,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`poster encode failed for ${clip.slug}`);
  log(`poster -> ${path.relative(process.cwd(), poster)}`);
}

async function buildClip(clip) {
  ensureDir(OUT_DIR);
  ensureDir(TMP_DIR);
  const outFile = path.join(OUT_DIR, `${clip.slug}.webm`);
  log(`building ${clip.slug} from ${clip.start}s`);

  const decoder = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(clip.start),
      "-i",
      SOURCE,
      "-t",
      String(DURATION),
      "-vf",
      `fps=${FPS},scale=${W}:${H}:flags=lanczos`,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );

  const encoder = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${W}x${H}`,
      "-r",
      String(FPS),
      "-i",
      "pipe:0",
      "-f",
      "lavfi",
      "-i",
      `color=c=black@0.0:s=${OUT_W}x${OUT_H}:r=${FPS}:d=${DURATION},format=rgba`,
      "-filter_complex",
      `[0:v]scale=${FX_W}:${FX_H}:flags=lanczos,format=rgba[fx];[1:v]format=rgba[bg];[bg][fx]overlay=${FX_X}:0,format=yuva420p[v]`,
      "-map",
      "[v]",
      "-c:v",
      "libvpx-vp9",
      "-pix_fmt",
      "yuva420p",
      "-crf",
      String(CRF),
      "-b:v",
      "0",
      "-auto-alt-ref",
      "0",
      "-row-mt",
      "1",
      "-tile-columns",
      "2",
      "-cpu-used",
      "4",
      "-deadline",
      "good",
      "-metadata:s:v:0",
      "alpha_mode=1",
      "-an",
      outFile,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );

  let buffer = Buffer.alloc(0);
  let frameIndex = 0;
  let posterRaw = null;
  let encoderFailure = null;
  let stopped = false;
  const decoderClosed = once(decoder, "close");
  const encoderClosed = once(encoder, "close");

  const failEncoder = (error) => {
    if (encoderFailure || stopped) return;
    encoderFailure = error;
    stopped = true;
    decoder.kill("SIGKILL");
  };
  encoder.on("error", failEncoder);
  encoder.stdin.on("error", failEncoder);
  encoder.on("close", (code) => {
    if (code !== 0) failEncoder(new Error(`encoder exited ${code} for ${clip.slug}`));
  });

  const onData = (chunk) => {
    if (stopped) return;
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
    while (buffer.length >= FRAME_BYTES) {
      if (stopped) return;
      const rgb = buffer.subarray(0, FRAME_BYTES);
      buffer = buffer.subarray(FRAME_BYTES);
      let rgba;
      if (clip.kind === "spider") rgba = processSpider(rgb);
      else if (clip.kind === "cherry") rgba = processCherry(rgb, clip.glow ?? 1);
      else rgba = processSci(rgb, clip.logoRect);
      if (frameIndex === clip.posterFrame) posterRaw = savePosterFrame(clip, rgba);
      applyFade(rgba, frameIndex);
      try {
        if (!encoder.stdin.write(rgba)) {
          decoder.stdout.pause();
          encoder.stdin.once("drain", () => {
            if (!stopped) decoder.stdout.resume();
          });
        }
      } catch (error) {
        failEncoder(error);
        return;
      }
      frameIndex++;
      if (frameIndex % 40 === 0) log(`${clip.slug}: ${frameIndex}/${TOTAL_FRAMES} frames`);
    }
  };

  decoder.stdout.on("data", onData);
  const [decoderCode] = await decoderClosed;
  if (encoderFailure) throw encoderFailure;
  if (decoderCode !== 0) throw new Error(`decoder exited ${decoderCode} for ${clip.slug}`);
  encoder.stdin.end();
  const [encoderCode] = await encoderClosed;
  if (encoderCode !== 0) throw encoderFailure ?? new Error(`encoder exited ${encoderCode} for ${clip.slug}`);

  if (!posterRaw) {
    // Fall back to a mid frame if the poster frame never arrived.
    throw new Error(`poster frame ${clip.posterFrame} was not produced for ${clip.slug}`);
  }
  buildPoster(clip, posterRaw);
  fs.unlinkSync(posterRaw);

  const stat = fs.statSync(outFile);
  log(`${clip.slug}: ${frameIndex} frames, ${(stat.size / 1024 / 1024).toFixed(2)} MiB`);
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(
      `Source reel not found at ${SOURCE}. Set CINEMATIC_SOURCE to the downloaded source.mp4.`,
    );
  }
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg?.slice("--only=".length);
  const clips = only ? CLIPS.filter((c) => c.slug === only) : CLIPS;
  if (!clips.length) throw new Error(`Unknown clip "${only}"`);
  for (const clip of clips) await buildClip(clip);
  log("done");
}

main().catch((error) => {
  console.error("[cinematic] failed:", error.message);
  process.exitCode = 1;
});
