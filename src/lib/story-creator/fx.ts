/**
 * Story Creator FX: filter bakes, adjustments, brush smoothing, particles.
 * Pure pixel math on Uint8ClampedArray — no canvas, no DOM — so every effect
 * is unit-testable in node. The composer paints with these; preview uses the
 * matching CSS approximation documented per filter.
 */

export type AdjustOpts = {
  brightness: number; // 0.5..1.5, 1 = off
  contrast: number; // 0.5..1.5
  saturation: number; // 0..2
  warmth: number; // -1..1 (blue..amber)
  vignette: number; // 0..1
  grain: number; // 0..1
};

export const NEUTRAL_ADJUST: AdjustOpts = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  vignette: 0,
  grain: 0,
};

/** Deterministic PRNG so grain is stable across export frames. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

export function applyAdjustments(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  opts: AdjustOpts,
  seed = 7,
): void {
  const { brightness, contrast, saturation, warmth, vignette, grain } = opts;
  const rand = mulberry32(seed);
  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.hypot(cx, cy) || 1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      let r = px[i];
      let g = px[i + 1];
      let b = px[i + 2];
      // brightness + contrast around midpoint
      r = (r - 128) * contrast + 128 + (brightness - 1) * 128;
      g = (g - 128) * contrast + 128 + (brightness - 1) * 128;
      b = (b - 128) * contrast + 128 + (brightness - 1) * 128;
      // saturation around luma
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      r = luma + (r - luma) * saturation;
      g = luma + (g - luma) * saturation;
      b = luma + (b - luma) * saturation;
      // warmth: amber shift
      r += warmth * 28;
      b -= warmth * 28;
      // vignette: darken toward corners
      if (vignette > 0) {
        const d = Math.hypot(x - cx, y - cy) / maxDist;
        const v = 1 - vignette * d * d * 0.9;
        r *= v;
        g *= v;
        b *= v;
      }
      // grain: deterministic per-pixel noise
      if (grain > 0) {
        const n = (rand() - 0.5) * 2 * grain * 36;
        r += n;
        g += n;
        b += n;
      }
      px[i] = clamp255(r);
      px[i + 1] = clamp255(g);
      px[i + 2] = clamp255(b);
    }
  }
}

export type BakeFilterId =
  | "none"
  | "warm"
  | "cool"
  | "bw"
  | "vintage"
  | "glitch"
  | "rgb-split"
  | "vhs"
  | "pixelate"
  | "dreamy"
  | "neon-edge";

export const BAKE_FILTERS: Array<{ id: BakeFilterId; label: string; css: string }> = [
  { id: "none", label: "None", css: "none" },
  { id: "warm", label: "Warm", css: "sepia(0.35) saturate(1.3) brightness(1.05)" },
  { id: "cool", label: "Cool", css: "hue-rotate(190deg) saturate(1.1)" },
  { id: "bw", label: "B&W", css: "grayscale(1) contrast(1.15)" },
  { id: "vintage", label: "Vintage", css: "sepia(0.7) saturate(1.1) contrast(0.95)" },
  { id: "glitch", label: "Glitch", css: "saturate(1.5) contrast(1.1)" },
  { id: "rgb-split", label: "RGB split", css: "saturate(1.4)" },
  { id: "vhs", label: "VHS", css: "saturate(0.9) contrast(1.05)" },
  { id: "pixelate", label: "Pixelate", css: "none" },
  { id: "dreamy", label: "Dreamy", css: "brightness(1.12) saturate(1.1) blur(0.4px)" },
  { id: "neon-edge", label: "Neon edge", css: "contrast(1.2)" },
];

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** One-shot stylized bakes. `seed` keeps glitch/VHS deterministic per export. */
export function bakeFilter(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  id: BakeFilterId,
  seed = 7,
): void {
  if (id === "none") return;
  const rand = mulberry32(seed);
  if (id === "warm" || id === "cool" || id === "bw" || id === "vintage") {
    const warm = id === "warm" ? 1 : id === "vintage" ? 0.7 : 0;
    const cool = id === "cool" ? 1 : 0;
    for (let i = 0; i < px.length; i += 4) {
      let r = px[i];
      let g = px[i + 1];
      let b = px[i + 2];
      if (id === "bw") {
        const l = luminance(r, g, b);
        r = l;
        g = l;
        b = l;
      } else if (id === "vintage") {
        const l = luminance(r, g, b);
        r = l * 1.05 + 18;
        g = l * 0.92 + 10;
        b = l * 0.72;
      }
      r += warm * 22 - cool * 14;
      b += cool * 22 - warm * 14;
      px[i] = clamp255(r);
      px[i + 1] = clamp255(g);
      px[i + 2] = clamp255(b);
    }
    return;
  }
  if (id === "glitch") {
    const src = px.slice();
    const bands = 6 + Math.floor(rand() * 6);
    for (let k = 0; k < bands; k += 1) {
      const y0 = Math.floor(rand() * h);
      const bh = 4 + Math.floor(rand() * h * 0.06);
      const shift = Math.floor((rand() - 0.5) * w * 0.12);
      for (let y = y0; y < Math.min(h, y0 + bh); y += 1) {
        for (let x = 0; x < w; x += 1) {
          const sx = (x - shift + w * 4) % w;
          const a = (y * w + x) * 4;
          const b = (y * w + sx) * 4;
          px[a] = src[b];
          px[a + 1] = src[b + 1];
          px[a + 2] = src[b + 2];
        }
      }
    }
    return;
  }
  if (id === "rgb-split") {
    const src = px.slice();
    const shift = Math.max(2, Math.round(w * 0.008));
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        px[i] = src[(y * w + Math.min(w - 1, x + shift)) * 4];
        px[i + 2] = src[(y * w + Math.max(0, x - shift)) * 4 + 2];
      }
    }
    return;
  }
  if (id === "vhs") {
    for (let y = 0; y < h; y += 1) {
      const scan = y % 3 === 0 ? 0.82 : 1;
      const tear = rand() < 0.02 ? 0.6 + rand() * 0.4 : 1;
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const n = (rand() - 0.5) * 22;
        px[i] = clamp255(px[i] * scan * tear + n);
        px[i + 1] = clamp255(px[i + 1] * scan * tear + n);
        px[i + 2] = clamp255(px[i + 2] * scan * tear + n * 1.2);
      }
    }
    return;
  }
  if (id === "pixelate") {
    const block = Math.max(6, Math.round(w / 90));
    for (let y = 0; y < h; y += block) {
      for (let x = 0; x < w; x += block) {
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let yy = y; yy < Math.min(h, y + block); yy += 1) {
          for (let xx = x; xx < Math.min(w, x + block); xx += 1) {
            const i = (yy * w + xx) * 4;
            r += px[i];
            g += px[i + 1];
            b += px[i + 2];
            n += 1;
          }
        }
        r /= n;
        g /= n;
        b /= n;
        for (let yy = y; yy < Math.min(h, y + block); yy += 1) {
          for (let xx = x; xx < Math.min(w, x + block); xx += 1) {
            const i = (yy * w + xx) * 4;
            px[i] = Math.round(r);
            px[i + 1] = Math.round(g);
            px[i + 2] = Math.round(b);
          }
        }
      }
    }
    return;
  }
  if (id === "dreamy") {
    const src = px.slice();
    const at = (x: number, y: number, c: number) => {
      const cx = Math.min(w - 1, Math.max(0, x));
      const cy = Math.min(h - 1, Math.max(0, y));
      return src[(cy * w + cx) * 4 + c];
    };
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c += 1) {
          const blurred =
            (at(x - 1, y, c) +
              at(x + 1, y, c) +
              at(x, y - 1, c) +
              at(x, y + 1, c) +
              at(x, y, c) * 4) /
            8;
          px[i + c] = clamp255(blurred * 0.72 + src[i + c] * 0.28 + 14);
        }
      }
    }
    return;
  }
  if (id === "neon-edge") {
    const src = px.slice();
    const lum = (x: number, y: number) => {
      const cx = Math.min(w - 1, Math.max(0, x));
      const cy = Math.min(h - 1, Math.max(0, y));
      const i = (cy * w + cx) * 4;
      return luminance(src[i], src[i + 1], src[i + 2]);
    };
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const gx = lum(x + 1, y) - lum(x - 1, y);
        const gy = lum(x, y + 1) - lum(x, y - 1);
        const edge = Math.min(255, Math.hypot(gx, gy) * 1.6);
        const i = (y * w + x) * 4;
        px[i] = clamp255(edge * 0.78);
        px[i + 1] = clamp255(edge);
        px[i + 2] = clamp255(edge * 0.24);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Brush stroke smoothing (Catmull-Rom resample, velocity-aware)       */
/* ------------------------------------------------------------------ */

export type StrokePoint = { x: number; y: number; p?: number };

export function smoothStroke(points: StrokePoint[], samplesPerSpan = 6): StrokePoint[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const out: StrokePoint[] = [];
  const get = (i: number) => points[Math.min(points.length - 1, Math.max(0, i))];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    for (let s = 0; s < samplesPerSpan; s += 1) {
      const t = s / samplesPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const blend = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({
        x: blend(p0.x, p1.x, p2.x, p3.x),
        y: blend(p0.y, p1.y, p2.y, p3.y),
        p: (p1.p ?? 0.7) + ((p2.p ?? 0.7) - (p1.p ?? 0.7)) * t,
      });
    }
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

/* ------------------------------------------------------------------ */
/* Particles (animated overlays). Pure step; composer draws them.      */
/* ------------------------------------------------------------------ */

export type ParticleKind = "hearts" | "confetti" | "snow" | "fireflies" | "rain" | "leaks";

export type Particle = {
  x: number; // 0..1
  y: number; // 0..1
  vx: number;
  vy: number;
  size: number; // px at 720p
  rot: number;
  spin: number;
  hue: number;
  alpha: number;
  wobble: number;
};

export const PARTICLE_COUNTS: Record<ParticleKind, number> = {
  hearts: 26,
  confetti: 90,
  snow: 110,
  fireflies: 40,
  rain: 130,
  leaks: 7,
};

export const MOTIONS: Array<{ id: ParticleKind | "none"; label: string }> = [
  { id: "none", label: "Still" },
  { id: "hearts", label: "Hearts" },
  { id: "confetti", label: "Confetti" },
  { id: "snow", label: "Snow" },
  { id: "fireflies", label: "Fireflies" },
  { id: "rain", label: "Rain" },
  { id: "leaks", label: "Light leaks" },
];

export function createParticles(kind: ParticleKind, seed = 7): Particle[] {
  const rand = mulberry32(seed);
  const n = PARTICLE_COUNTS[kind];
  const out: Particle[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      x: rand(),
      y: rand(),
      vx: (rand() - 0.5) * 0.02,
      vy:
        kind === "hearts" || kind === "fireflies"
          ? -(0.01 + rand() * 0.03)
          : kind === "leaks"
            ? (rand() - 0.5) * 0.01
            : 0.05 + rand() * (kind === "rain" ? 0.35 : 0.08),
      size: kind === "leaks" ? 120 + rand() * 220 : 4 + rand() * (kind === "confetti" ? 10 : 14),
      rot: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 0.2,
      hue: rand() * 360,
      alpha: 0.5 + rand() * 0.5,
      wobble: rand() * Math.PI * 2,
    });
  }
  return out;
}

/** Advance particles by dt seconds; wraps vertically for endless loops. */
export function stepParticles(ps: Particle[], kind: ParticleKind, dt: number): void {
  for (const p of ps) {
    p.wobble += dt * 2;
    p.x +=
      (p.vx + Math.sin(p.wobble) * (kind === "snow" || kind === "fireflies" ? 0.02 : 0.004)) *
      dt *
      10;
    p.y += p.vy * dt * 10;
    p.rot += p.spin * dt * 10;
    if (p.y > 1.08) {
      p.y = -0.08;
      p.x = (p.x + 1) % 1;
    }
    if (p.y < -0.08) {
      p.y = 1.08;
      p.x = (p.x + 1) % 1;
    }
    if (p.x > 1.08) p.x = -0.08;
    if (p.x < -0.08) p.x = 1.08;
  }
}
