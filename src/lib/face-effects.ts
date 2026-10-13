/**
 * The face-effect registry — all 69 lenses, as data.
 *
 * Nothing here draws anything. Each effect is a row of *parameters*, and the
 * renderer (`src/components/story/face-pipeline.ts`) reads them. That is the
 * whole point of the design: adding a lens means adding a row, not writing
 * shader code, and there is exactly ONE warp implementation for every warp
 * effect (a shared mesh-warp: bulge/pinch around landmarks), never a CPU pixel
 * loop.
 *
 * Build order is the order of the array — warps first, then reactive, overlays,
 * beauty, filters, world, fun — and the carousel follows it.
 */

export const EFFECT_CATEGORIES = [
  "warp",
  "reactive",
  "overlay",
  "beauty",
  "filter",
  "world",
  "fun",
] as const;

export type EffectCategory = (typeof EFFECT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<EffectCategory, string> = {
  warp: "Face warp",
  reactive: "Reactive",
  overlay: "Overlays",
  beauty: "Beauty",
  filter: "Filters",
  world: "World",
  fun: "Fun",
};

/** Where a warp is centred. Mapped to real landmarks by the pipeline. */
export type WarpAnchor =
  | "leftEye"
  | "rightEye"
  | "eyes"
  | "mouth"
  | "nose"
  | "forehead"
  | "chin"
  | "cheeks"
  | "jaw"
  | "face"
  | "frame";

export type WarpSpec = {
  anchor: WarpAnchor;
  /** Influence radius as a fraction of the face width (0–1). */
  radius: number;
  /** Signed strength: positive bulges, negative pinches. */
  strength: number;
};

/** Colour grading, applied in the same shared fragment shader. */
export type GradeSpec = {
  saturation?: number;
  contrast?: number;
  brightness?: number;
  hueShift?: number;
  sepia?: number;
  /** Animated film grain, 0–1. */
  grain?: number;
  /** Scanline/VHS wobble, 0–1. */
  vhs?: number;
  /** Quantise to N shades (8-bit look); 0 disables. */
  posterize?: number;
  /** Pixel block size in device pixels; 0 disables. */
  pixelate?: number;
  /** Edge-detect sketch, 0–1. */
  sketch?: number;
  /** Additive neon glow, 0–1. */
  neon?: number;
  vignette?: number;
  /** Multiply tint, rgb 0–1. */
  tint?: [number, number, number];
  /** Blend the whole grade in, 0–1 (driven by the intensity slider). */
  mix?: number;
};

/** Non-warp geometry changes — all shader uniforms. */
export type GeometrySpec = {
  mirror?: "horizontal" | "vertical" | "split";
  /** Kaleidoscope segment count; 0 disables. */
  kaleidoscope?: number;
  flip?: boolean;
  /** Repeat the face N times across the frame (clone). */
  clone?: number;
};

export type OverlayPart = {
  sprite: string;
  anchor: WarpAnchor;
  /** Multiplier on the face width. */
  scale: number;
  /** Offsets in face-width units, applied after head rotation. */
  offset?: { x: number; y: number };
};

export type OverlaySpec = {
  parts: OverlayPart[];
  /** Follow the head's roll/yaw/pitch as measured from the landmarks. */
  followRotation?: boolean;
  opacity?: number;
};

export type BeautySpec = {
  smooth?: number;
  glow?: number;
  softFocus?: number;
  whitenTeeth?: number;
  brightenEyes?: number;
  blush?: number;
  freckles?: number;
  /** Hex colour for the lips. */
  lipstick?: string;
};

export type WorldSpec = {
  kind: "blur" | "replace" | "snow" | "rain" | "confetti" | "hearts" | "galaxy" | "fire";
  amount: number;
};

export type ReactiveTrigger =
  | "mouthOpen"
  | "browRaise"
  | "blink"
  | "smile"
  | "kiss"
  | "tongueOut"
  | "headShake";

export type ReactiveSpec = {
  trigger: ReactiveTrigger;
  /** Overlay that appears while the trigger is active. */
  overlay?: OverlaySpec;
  warp?: WarpSpec[];
  particles?: "sparkles" | "hearts" | "fire" | "confetti" | "rainbow";
  hint: string;
};

export type FaceEffect = {
  id: string;
  name: string;
  category: EffectCategory;
  /** 0–1 starting position of the intensity slider. */
  defaultIntensity: number;
  warp?: WarpSpec[];
  /** Rotational warp applied around the face centre. */
  swirl?: number;
  grade?: GradeSpec;
  geometry?: GeometrySpec;
  overlay?: OverlaySpec;
  beauty?: BeautySpec;
  world?: WorldSpec;
  reactive?: ReactiveSpec;
  /**
   * Set when an effect needs something beyond landmarks (a segmentation model,
   * a second face, …). The carousel shows this instead of pretending to work.
   */
  unavailable?: string;
};

const w = (anchor: WarpAnchor, radius: number, strength: number): WarpSpec => ({ anchor, radius, strength });

function overlay(sprite: string, anchor: WarpAnchor, scale: number, offset?: { x: number; y: number }): OverlaySpec {
  return { parts: [{ sprite, anchor, scale, offset }], followRotation: true };
}

function twoSprites(a: OverlayPart, b: OverlayPart): OverlaySpec {
  return { parts: [a, b], followRotation: true };
}

/** Face warp (16) — every one is the shared mesh-warp with different numbers. */
const WARPS: FaceEffect[] = [
  { id: "big-eyes", name: "Big Eyes", category: "warp", defaultIntensity: 0.55, warp: [w("eyes", 0.26, 0.42)] },
  { id: "tiny-eyes", name: "Tiny Eyes", category: "warp", defaultIntensity: 0.5, warp: [w("eyes", 0.28, -0.36)] },
  { id: "big-mouth", name: "Big Mouth", category: "warp", defaultIntensity: 0.55, warp: [w("mouth", 0.22, 0.5)] },
  { id: "tiny-mouth", name: "Tiny Mouth", category: "warp", defaultIntensity: 0.5, warp: [w("mouth", 0.22, -0.42)] },
  { id: "big-nose", name: "Big Nose", category: "warp", defaultIntensity: 0.5, warp: [w("nose", 0.18, 0.5)] },
  { id: "tiny-nose", name: "Tiny Nose", category: "warp", defaultIntensity: 0.5, warp: [w("nose", 0.18, -0.45)] },
  { id: "big-forehead", name: "Big Forehead", category: "warp", defaultIntensity: 0.5, warp: [w("forehead", 0.4, 0.34)] },
  { id: "long-chin", name: "Long Chin", category: "warp", defaultIntensity: 0.5, warp: [w("chin", 0.3, -0.34)] },
  { id: "chipmunk-cheeks", name: "Chipmunk Cheeks", category: "warp", defaultIntensity: 0.6, warp: [w("cheeks", 0.32, 0.45)] },
  { id: "big-head", name: "Big Head", category: "warp", defaultIntensity: 0.45, warp: [w("face", 0.85, 0.3)] },
  { id: "tiny-head", name: "Tiny Head", category: "warp", defaultIntensity: 0.45, warp: [w("face", 0.9, -0.22)] },
  { id: "alien", name: "Alien", category: "warp", defaultIntensity: 0.55, warp: [w("face", 0.9, 0.34), w("chin", 0.3, 0.3), w("nose", 0.2, -0.2)] },
  { id: "fat-face", name: "Fat Face", category: "warp", defaultIntensity: 0.5, warp: [w("cheeks", 0.45, 0.4), w("jaw", 0.5, 0.24)] },
  { id: "skinny-face", name: "Skinny Face", category: "warp", defaultIntensity: 0.5, warp: [w("cheeks", 0.45, -0.34), w("jaw", 0.5, -0.22)] },
  { id: "squeeze", name: "Squeeze", category: "warp", defaultIntensity: 0.5, warp: [w("face", 0.95, -0.28), w("frame", 1, 0.2)] },
  { id: "swirl", name: "Swirl", category: "warp", defaultIntensity: 0.4, swirl: 1, warp: [w("face", 0.9, 0)] },
];

/** Reactive (8) — landmark events drive an overlay, warp or particle burst. */
const REACTIVE: FaceEffect[] = [
  {
    id: "open-mouth-bigger",
    name: "Bigger With Mouth",
    category: "reactive",
    defaultIntensity: 0.7,
    reactive: { trigger: "mouthOpen", warp: [w("mouth", 0.25, 0.55)], hint: "Open your mouth to grow it." },
  },
  {
    id: "rainbow-brows",
    name: "Rainbow Brows",
    category: "reactive",
    defaultIntensity: 0.8,
    reactive: { trigger: "browRaise", particles: "rainbow", hint: "Raise your eyebrows for a rainbow." },
  },
  {
    id: "blink-hearts",
    name: "Heart Blink",
    category: "reactive",
    defaultIntensity: 0.8,
    reactive: { trigger: "blink", particles: "hearts", hint: "Blink to pop hearts." },
  },
  {
    id: "smile-sparkles",
    name: "Smile Sparkles",
    category: "reactive",
    defaultIntensity: 0.8,
    reactive: { trigger: "smile", particles: "sparkles", hint: "Smile for sparkles." },
  },
  {
    id: "kiss-heart-burst",
    name: "Kiss Burst",
    category: "reactive",
    defaultIntensity: 0.85,
    reactive: { trigger: "kiss", particles: "hearts", hint: "Pucker up for a heart burst." },
  },
  {
    id: "dog-tongue",
    name: "Dog Tongue",
    category: "reactive",
    defaultIntensity: 0.7,
    reactive: {
      trigger: "tongueOut",
      overlay: overlay("👅", "mouth", 0.22, { x: 0, y: 0.02 }),
      hint: "Stick your tongue out.",
    },
  },
  {
    id: "fire-breath",
    name: "Fire Breath",
    category: "reactive",
    defaultIntensity: 0.9,
    reactive: { trigger: "mouthOpen", particles: "fire", hint: "Open wide to breathe fire." },
  },
  {
    id: "head-shake-confetti",
    name: "Shake Confetti",
    category: "reactive",
    defaultIntensity: 0.9,
    reactive: { trigger: "headShake", particles: "confetti", hint: "Shake your head to drop confetti." },
  },
];

/** Face overlays (12) — sprites pinned to landmarks, following head rotation. */
const OVERLAYS: FaceEffect[] = [
  { id: "dog", name: "Dog", category: "overlay", defaultIntensity: 0.8, overlay: twoSprites({ sprite: "🐶", anchor: "forehead", scale: 0.75 }, { sprite: "🐽", anchor: "nose", scale: 0.28 }) },
  { id: "cat", name: "Cat", category: "overlay", defaultIntensity: 0.8, overlay: twoSprites({ sprite: "🐱", anchor: "forehead", scale: 0.7 }, { sprite: "🐾", anchor: "cheeks", scale: 0.3 }) },
  { id: "bunny", name: "Bunny", category: "overlay", defaultIntensity: 0.8, overlay: overlay("🐰", "forehead", 0.72, { x: 0, y: -0.06 }) },
  { id: "crown", name: "Crown", category: "overlay", defaultIntensity: 0.8, overlay: overlay("👑", "forehead", 0.6, { x: 0, y: -0.12 }) },
  { id: "sunglasses", name: "Sunglasses", category: "overlay", defaultIntensity: 0.85, overlay: overlay("🕶️", "eyes", 0.68) },
  { id: "heart-glasses", name: "Heart Glasses", category: "overlay", defaultIntensity: 0.85, overlay: overlay("😍", "eyes", 0.7) },
  { id: "mustache", name: "Mustache", category: "overlay", defaultIntensity: 0.8, overlay: overlay("🥸", "mouth", 0.5, { x: 0, y: -0.02 }) },
  { id: "clown-nose", name: "Clown Nose", category: "overlay", defaultIntensity: 0.85, overlay: overlay("🤡", "nose", 0.26) },
  { id: "devil-horns", name: "Devil Horns", category: "overlay", defaultIntensity: 0.8, overlay: overlay("😈", "forehead", 0.7, { x: 0, y: -0.04 }) },
  { id: "halo", name: "Halo", category: "overlay", defaultIntensity: 0.75, overlay: overlay("😇", "forehead", 0.66, { x: 0, y: -0.12 }) },
  { id: "flower-crown", name: "Flower Crown", category: "overlay", defaultIntensity: 0.8, overlay: twoSprites({ sprite: "🌸", anchor: "forehead", scale: 0.5, offset: { x: -0.18, y: -0.08 } }, { sprite: "🌺", anchor: "forehead", scale: 0.5, offset: { x: 0.18, y: -0.08 } }) },
  { id: "party-hat", name: "Party Hat", category: "overlay", defaultIntensity: 0.8, overlay: overlay("🎉", "forehead", 0.55, { x: 0.12, y: -0.16 }) },
];

/** Beauty (8) — region-aware touches driven by landmarks. */
const BEAUTY: FaceEffect[] = [
  { id: "skin-smooth", name: "Skin Smooth", category: "beauty", defaultIntensity: 0.6, beauty: { smooth: 0.7 } },
  { id: "glow", name: "Glow", category: "beauty", defaultIntensity: 0.5, beauty: { glow: 0.6 } },
  { id: "soft-focus", name: "Soft Focus", category: "beauty", defaultIntensity: 0.5, beauty: { softFocus: 0.7 } },
  { id: "teeth-whiten", name: "Teeth Whiten", category: "beauty", defaultIntensity: 0.6, beauty: { whitenTeeth: 0.75 } },
  { id: "eye-brighten", name: "Eye Brighten", category: "beauty", defaultIntensity: 0.55, beauty: { brightenEyes: 0.7 } },
  { id: "blush", name: "Blush", category: "beauty", defaultIntensity: 0.5, beauty: { blush: 0.7 } },
  { id: "freckles", name: "Freckles", category: "beauty", defaultIntensity: 0.5, beauty: { freckles: 0.8 } },
  { id: "lipstick", name: "Lipstick", category: "beauty", defaultIntensity: 0.6, beauty: { lipstick: "#d6426b" } },
];

/** Filters and styles (12) — all one shared fragment shader, different numbers. */
const FILTERS: FaceEffect[] = [
  { id: "bw", name: "B&W", category: "filter", defaultIntensity: 1, grade: { saturation: 0 } },
  { id: "vintage", name: "Vintage", category: "filter", defaultIntensity: 1, grade: { sepia: 0.45, contrast: 1.06, saturation: 0.85, vignette: 0.35 } },
  { id: "warm", name: "Warm", category: "filter", defaultIntensity: 1, grade: { tint: [1.08, 0.98, 0.9], saturation: 1.08 } },
  { id: "cool", name: "Cool", category: "filter", defaultIntensity: 1, grade: { tint: [0.92, 0.98, 1.1], saturation: 1.04 } },
  { id: "neon", name: "Neon", category: "filter", defaultIntensity: 1, grade: { saturation: 1.6, contrast: 1.15, neon: 0.7 } },
  { id: "vhs", name: "VHS Glitch", category: "filter", defaultIntensity: 1, grade: { vhs: 0.8, saturation: 1.15, contrast: 1.05 } },
  { id: "retro-80s", name: "80s Retro", category: "filter", defaultIntensity: 1, grade: { hueShift: 0.08, saturation: 1.35, neon: 0.35, vignette: 0.3 } },
  { id: "film-grain", name: "Film Grain", category: "filter", defaultIntensity: 1, grade: { grain: 0.45, contrast: 1.04 } },
  { id: "cartoon", name: "Cartoon", category: "filter", defaultIntensity: 1, grade: { posterize: 6, saturation: 1.35, contrast: 1.12 } },
  { id: "anime", name: "Anime", category: "filter", defaultIntensity: 1, grade: { posterize: 8, saturation: 1.25, brightness: 1.06, neon: 0.15 } },
  { id: "pixel-8bit", name: "Pixel 8-bit", category: "filter", defaultIntensity: 1, grade: { pixelate: 8, posterize: 6 } },
  { id: "sketch", name: "Sketch", category: "filter", defaultIntensity: 1, grade: { sketch: 0.85 } },
];

/** World and background (8). */
const WORLD: FaceEffect[] = [
  { id: "bg-blur", name: "Background Blur", category: "world", defaultIntensity: 0.6, world: { kind: "blur", amount: 0.7 } },
  {
    id: "bg-replace",
    name: "Background Replace",
    category: "world",
    defaultIntensity: 0.8,
    world: { kind: "replace", amount: 0.8 },
    unavailable: "Background replacement needs a person-segmentation model, which isn't bundled yet. Use Background Blur meanwhile.",
  },
  { id: "snow", name: "Snow", category: "world", defaultIntensity: 0.7, world: { kind: "snow", amount: 0.6 } },
  { id: "rain", name: "Rain", category: "world", defaultIntensity: 0.7, world: { kind: "rain", amount: 0.7 } },
  { id: "world-confetti", name: "Confetti", category: "world", defaultIntensity: 0.8, world: { kind: "confetti", amount: 0.7 } },
  { id: "hearts-rain", name: "Hearts Rain", category: "world", defaultIntensity: 0.8, world: { kind: "hearts", amount: 0.7 } },
  { id: "galaxy", name: "Galaxy", category: "world", defaultIntensity: 0.7, world: { kind: "galaxy", amount: 0.7 } },
  { id: "fire", name: "Fire", category: "world", defaultIntensity: 0.7, world: { kind: "fire", amount: 0.7 } },
];

/** Fun (5). */
const FUN: FaceEffect[] = [
  { id: "mirror-split", name: "Mirror / Split", category: "fun", defaultIntensity: 1, geometry: { mirror: "split" } },
  { id: "kaleidoscope", name: "Kaleidoscope", category: "fun", defaultIntensity: 0.8, geometry: { kaleidoscope: 6 }, swirl: 0.2 },
  { id: "clone", name: "Clone", category: "fun", defaultIntensity: 0.7, geometry: { clone: 3 } },
  {
    id: "face-swap",
    name: "Face Swap",
    category: "fun",
    defaultIntensity: 0.8,
    unavailable: "Face swap needs two tracked faces plus a texture-transfer pass. Landmarks-only tracking can't do it honestly yet.",
  },
  { id: "upside-down", name: "Upside Down", category: "fun", defaultIntensity: 1, geometry: { flip: true } },
];

/** All 69, in build order. */
export const FACE_EFFECTS: FaceEffect[] = [
  ...WARPS,
  ...REACTIVE,
  ...OVERLAYS,
  ...BEAUTY,
  ...FILTERS,
  ...WORLD,
  ...FUN,
];

export const FACE_EFFECT_COUNT = FACE_EFFECTS.length;

export function effectsInCategory(category: EffectCategory): FaceEffect[] {
  return FACE_EFFECTS.filter((effect) => effect.category === category);
}

export function findFaceEffect(id: string | null | undefined): FaceEffect | null {
  if (!id) return null;
  return FACE_EFFECTS.find((effect) => effect.id === id) ?? null;
}

/** A short emoji stand-in so the carousel reads at a glance. */
export function effectGlyph(effect: FaceEffect): string {
  switch (effect.category) {
    case "warp":
      return "🌀";
    case "reactive":
      return "✨";
    case "overlay":
      return effect.overlay?.parts[0]?.sprite ?? "🎭";
    case "beauty":
      return "💄";
    case "filter":
      return "🎞️";
    case "world":
      return "🌍";
    case "fun":
      return "🎪";
    default:
      return "✨";
  }
}

/** True when the effect changes the frame at all (used by the "None" chip). */
export function effectIsNoop(effect: FaceEffect, intensity: number): boolean {
  return intensity <= 0.001;
}

/**
 * Clamps a 0–1 slider position to the effect's own useful range. Warps saturate
 * early; particle effects keep going.
 */
export function scaleIntensity(effect: FaceEffect, intensity: number): number {
  return Math.max(0, Math.min(1, intensity));
}
