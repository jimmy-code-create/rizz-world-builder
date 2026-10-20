#!/usr/bin/env node
/**
 * Builds the "Web Slinger" profile effect.
 *
 * One scene description, two outputs:
 *
 *   public/effects/fx-web-slinger.json      the Lottie file (what Discord's
 *                                           profile effects are, and what the
 *                                           RIZZ app plays with lottie-web)
 *   public/effects/fx-web-slinger-frame.svg a frame-accurate still of the same
 *                                           scene, for the static preview
 *
 * The character is ORIGINAL work — a masked web-slinger in the red-and-blue
 * spider aesthetic, drawn from scratch as bezier paths. No Marvel, Sony or
 * Disney assets, models or textures are used, referenced or required.
 *
 * Everything is procedural: the geometry, the gradients, the web physics
 * (trim paths on bezier strands) and the timeline live in this file, so the
 * effect can be re-tuned without an After Effects round trip.
 *
 *   node scripts/build-web-slinger-effect.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = resolve(ROOT, "public/effects");

/* ------------------------------------------------------------------ *
 * Canvas and timeline
 * ------------------------------------------------------------------ */

const W = 512;
const H = 512;
const FR = 30;
const LOOP_SECONDS = 8;
const OP = FR * LOOP_SECONDS; // 240 frames

const RED = "#e8253f";
const DEEP_RED = "#7d0f1f";
const BLUE = "#2f6df6";
const DEEP_BLUE = "#0b1c46";
const INK = "#070911";

/* ------------------------------------------------------------------ *
 * SVG path -> Lottie path
 * ------------------------------------------------------------------ */

/**
 * A very small SVG path reader: M, L, C, Q, Z in absolute and relative
 * form. That is everything the character is drawn with, and reading it here
 * means the shapes below can be written as ordinary SVG path strings.
 */
export function parseSvgPath(d) {
  const tokens = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const vertices = [];
  const inTangents = [];
  const outTangents = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let i = 0;
  let cmd = null;

  const num = () => Number(tokens[i++]);
  const isCommand = (token) => /^[a-zA-Z]$/.test(token);

  const pushVertex = (x, y, inTan, outTan) => {
    vertices.push([x, y]);
    inTangents.push(inTan ?? [0, 0]);
    outTangents.push(outTan ?? [0, 0]);
  };

  while (i < tokens.length) {
    if (isCommand(tokens[i])) {
      cmd = tokens[i++];
    } else if (cmd === "M") {
      cmd = "L";
    } else if (cmd === "m") {
      cmd = "l";
    }

    const rel = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();

    if (upper === "M") {
      const x = num();
      const y = num();
      cx = rel ? cx + x : x;
      cy = rel ? cy + y : y;
      startX = cx;
      startY = cy;
      pushVertex(cx, cy);
    } else if (upper === "L") {
      const x = num();
      const y = num();
      cx = rel ? cx + x : x;
      cy = rel ? cy + y : y;
      pushVertex(cx, cy);
    } else if (upper === "H") {
      const x = num();
      cx = rel ? cx + x : x;
      pushVertex(cx, cy);
    } else if (upper === "V") {
      const y = num();
      cy = rel ? cy + y : y;
      pushVertex(cx, cy);
    } else if (upper === "C") {
      const x1 = num();
      const y1 = num();
      const x2 = num();
      const y2 = num();
      const x = num();
      const y = num();
      const ax = rel ? cx + x1 : x1;
      const ay = rel ? cy + y1 : y1;
      const bx = rel ? cx + x2 : x2;
      const by = rel ? cy + y2 : y2;
      const nx = rel ? cx + x : x;
      const ny = rel ? cy + y : y;
      // The first control point leaves the previous vertex, the second one
      // arrives at the new vertex.
      outTangents[outTangents.length - 1] = [ax - cx, ay - cy];
      pushVertex(nx, ny, [bx - nx, by - ny]);
      cx = nx;
      cy = ny;
    } else if (upper === "Q") {
      const qx = num();
      const qy = num();
      const x = num();
      const y = num();
      const ax = rel ? cx + qx : qx;
      const ay = rel ? cy + qy : qy;
      const nx = rel ? cx + x : x;
      const ny = rel ? cy + y : y;
      // Convert the quadratic control point to a cubic equivalent.
      const c1x = cx + (2 / 3) * (ax - cx);
      const c1y = cy + (2 / 3) * (ay - cy);
      const c2x = nx + (2 / 3) * (ax - nx);
      const c2y = ny + (2 / 3) * (ay - ny);
      outTangents[outTangents.length - 1] = [c1x - cx, c1y - cy];
      pushVertex(nx, ny, [c2x - nx, c2y - ny]);
      cx = nx;
      cy = ny;
    } else if (upper === "Z") {
      if (vertices.length) {
        // Close back onto the first vertex.
        inTangents[outTangents.length - 1] = [startX - cx, startY - cy];
        cx = startX;
        cy = startY;
      }
    } else {
      i += 1;
    }
  }

  return { vertices, inTangents, outTangents, closed: /z/i.test(d) };
}

export function toLottiePath(d) {
  const { vertices, inTangents, outTangents, closed } = parseSvgPath(d);
  return {
    ty: "sh",
    ind: 0,
    ks: {
      a: 0,
      k: {
        i: inTangents,
        o: outTangents,
        v: vertices,
        c: closed,
      },
    },
    nm: "path",
    hd: false,
  };
}

/* ------------------------------------------------------------------ *
 * Properties: still values and keyframes
 * ------------------------------------------------------------------ */

const EASE_IN = { i: { x: [0.35], y: [1] }, o: { x: [0.65], y: [0] } };
const EASE_OUT = { i: { x: [0.16], y: [1] }, o: { x: [0.3], y: [0] } };
const EASE_SOFT = { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } };

function toVec(v) {
  return Array.isArray(v) ? v : [v];
}

/** A property that never changes. */
export function still(v) {
  return { a: 0, k: toVec(v) };
}

/**
 * An animated property.
 *
 * `frames` is a list of `{ t, v, ease? }`. The easing belongs to the
 * segment that *ends* at that keyframe, which is how bodymovin stores it.
 */
export function anim(frames) {
  return {
    a: 1,
    k: frames.map((frame, index) => {
      const key = { t: frame.t, s: toVec(frame.v) };
      if (index < frames.length - 1) {
        const ease = frame.ease ?? EASE_SOFT;
        key.i = { x: ease.i.x, y: ease.i.y };
        key.o = { x: ease.o.x, y: ease.o.y };
      }
      return key;
    }),
  };
}

/** Sample an animated property at a frame, for the static SVG preview. */
export function valueAt(prop, frame) {
  if (!prop || prop.a === 0) return toVec(prop?.k ?? [0]);
  const keys = prop.k;
  if (!keys.length) return [0];
  if (frame <= keys[0].t) return toVec(keys[0].s);
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame >= a.t && frame <= b.t) {
      const span = b.t - a.t || 1;
      const raw = (frame - a.t) / span;
      const eased = raw * raw * (3 - 2 * raw); // smoothstep, close enough to the curve
      const av = toVec(a.s);
      const bv = toVec(b.s);
      return av.map((value, index) => value + ((bv[index] ?? value) - value) * eased);
    }
  }
  return toVec(keys[keys.length - 1].s);
}

/* ------------------------------------------------------------------ *
 * Colours and gradients
 * ------------------------------------------------------------------ */

function hexToRgba(hex, alpha = 1) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

export function rgba(hex, alpha = 1) {
  const [r, g, b, a] = hexToRgba(hex, alpha);
  return [r / 255, g / 255, b / 255, a];
}

/**
 * Gradient stops, in the shape lottie-web expects.
 *
 * The colour stops come first — an offset and three channels each — and the
 * opacity stops follow, an offset and an alpha each. The player reads the
 * second block as the alpha of a matching stop, which is how a gradient can
 * fade to nothing without giving up its colour.
 */
function gradientStops(stops) {
  const colours = [];
  const alphas = [];
  for (const [offset, color, alpha] of stops) {
    const [r, g, b, a] = hexToRgba(color, alpha ?? 1);
    colours.push(offset, r / 255, g / 255, b / 255);
    alphas.push(offset, a);
  }
  return [...colours, ...alphas];
}

/** A linear gradient fill, from (x1,y1) to (x2,y2) in the layer's space. */
export function linearGradient(stops, x1, y1, x2, y2, opacity = 100) {
  return {
    ty: "gf",
    t: 1,
    s: still([x1, y1]),
    e: still([x2, y2]),
    g: { p: stops.length, k: { a: 0, k: gradientStops(stops) } },
    // A gradient fill needs its own opacity property; without it the player
    // throws and the whole layer is dropped.
    o: still(opacity),
    r: 1,
    nm: "gradient",
    hd: false,
  };
}

/* ------------------------------------------------------------------ *
 * Shape primitives
 * ------------------------------------------------------------------ */

export function group(items, transform = {}) {
  return {
    ty: "gr",
    it: [...items, tr(transform)],
    nm: "group",
    np: items.length,
    cix: 2,
    bm: 0,
    ix: 1,
    hd: false,
  };
}

export function path(d) {
  return toLottiePath(d);
}

export function ellipse(size, position) {
  return {
    ty: "el",
    d: 1,
    s: still(size),
    p: still(position ?? [0, 0]),
    nm: "ellipse",
    hd: false,
  };
}

export function fill(color, opacity = 100) {
  return { ty: "fl", c: still(rgba(color)), o: still(opacity), r: 1, nm: "fill", hd: false };
}

export function stroke(color, width, opacity = 100, cap = 2, join = 2) {
  return {
    ty: "st",
    c: still(rgba(color)),
    o: still(opacity),
    w: still(width),
    lc: cap,
    lj: join,
    ml: 4,
    nm: "stroke",
    hd: false,
  };
}

export function gradientStroke(stops, x1, y1, x2, y2, width, opacity = 100) {
  return {
    ty: "gs",
    t: 1,
    s: still([x1, y1]),
    e: still([x2, y2]),
    g: { p: stops.length, k: { a: 0, k: gradientStops(stops) } },
    o: still(opacity),
    w: still(width),
    lc: 2,
    lj: 2,
    ml: 4,
    nm: "gradient stroke",
    hd: false,
  };
}

/** Trim path: the "draw on" of a strand. */
export function trim(start, end, offset = 0) {
  return {
    ty: "tm",
    s: start,
    e: end,
    o: still(offset),
    m: 1,
    nm: "trim",
    hd: false,
  };
}

export function tr({
  p = [0, 0],
  a = [0, 0],
  s = [100, 100],
  r = 0,
  o = 100,
  sk = 0,
  sa = 0,
} = {}) {
  return {
    ty: "tr",
    p: p.a !== undefined ? p : still(p),
    a: a.a !== undefined ? a : still(a),
    s: s.a !== undefined ? s : still(s),
    r: r.a !== undefined ? r : still(r),
    o: o.a !== undefined ? o : still(o),
    sk: sk.a !== undefined ? sk : still(sk),
    sa: sa.a !== undefined ? sa : still(sa),
    nm: "transform",
    hd: false,
  };
}

/** A soft glow built from stacked ellipses — no blur effects, so it plays
 *  everywhere, including renderers that ignore Lottie effect layers. */
export function glow(cx, cy, radius, color, opacity, rings = 4) {
  const items = [];
  for (let i = rings; i >= 1; i -= 1) {
    const scale = i / rings;
    items.push(ellipse([radius * 2 * scale, radius * 2 * scale], [cx, cy]));
  }
  return group(items, {});
}

export function shapeLayer(name, shapes, transform = {}, { ip = 0, op = OP, ind = 1 } = {}) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: transform.o ?? still(100),
      r: transform.r ?? still(0),
      p: transform.p ?? still([0, 0, 0]),
      a: transform.a ?? still([0, 0, 0]),
      s: transform.s ?? still([100, 100, 100]),
    },
    ao: 0,
    shapes,
    ip,
    op,
    st: 0,
    bm: 0,
  };
}

export { EASE_IN, EASE_OUT, EASE_SOFT, RED, DEEP_RED, BLUE, DEEP_BLUE, INK, W, H, FR, OP };
