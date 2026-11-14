/**
 * Cat Studio — the shape of a cat, and the rules for trusting one.
 *
 * Everything here is pure: no React, no Supabase, no DOM. The builder, the
 * renderer and the SQL function all speak the same numbers, so a config that
 * passes `sanitizeCatConfig` renders identically in all three places.
 */
import { ITEM_IDS_BY_SLOT, slotForItem } from "./catalog.ts";

export const CAT_SLOTS = ["hat", "eyewear", "neck", "face", "back", "backdrop"] as const;
export type CatSlot = (typeof CAT_SLOTS)[number];

export const PATTERNS = ["solid", "tuxedo", "tabby", "calico"] as const;
export type CatPattern = (typeof PATTERNS)[number];

/**
 * Where the cat shows up. Instagram, WhatsApp and Snapchat all let an avatar sit
 * beside your photo instead of replacing it, so "sticker" (photo stays, cat
 * pinned to the corner) is the default and "photo" is the opt-in old behaviour.
 */
export const CAT_FLEX = ["sticker", "name", "photo"] as const;
export type CatFlex = (typeof CAT_FLEX)[number];

export const EXPRESSIONS = ["happy", "chill", "sleepy", "surprised", "smug"] as const;
export type CatExpression = (typeof EXPRESSIONS)[number];

export const FUR_COLORS = [
  "#17171a",
  "#2b2b31",
  "#f4f1e7",
  "#e8b786",
  "#8d6e4d",
  "#5b6474",
  "#b45a5a",
  "#5f7a58",
] as const;

export const ACCENT_COLORS = ["#c8ff3d", "#9be8ff", "#ffb3d1", "#ffd166", "#c7a3ff"] as const;
export const EYE_COLORS = ["#ffffff", "#c8ff3d", "#9be8ff", "#ffd166"] as const;

/** Slider truth. Anything outside a range is clamped, never trusted. */
export const SHAPE_RANGES = {
  body: [0.85, 1.25],
  head: [0.9, 1.15],
  earSize: [0.8, 1.3],
  earTilt: [-12, 12],
  eyeSize: [0.8, 1.3],
  eyeSpacing: [0.9, 1.15],
  tailLength: [0.7, 1.4],
} as const satisfies Record<string, readonly [number, number]>;

export type ShapeKey = keyof typeof SHAPE_RANGES;
export type CatShape = Record<ShapeKey, number>;

export type CatConfig = {
  base: "cat";
  shape: CatShape;
  colors: { fur: string; accent: string; eye: string };
  pattern: CatPattern;
  slots: Record<CatSlot, string | null>;
  expression: CatExpression;
  flex: CatFlex;
};

export const DEFAULT_SHAPE: CatShape = {
  body: 1,
  head: 1,
  earSize: 1,
  earTilt: 0,
  eyeSize: 1,
  eyeSpacing: 1,
  tailLength: 1,
};

export const DEFAULT_CONFIG: CatConfig = {
  base: "cat",
  shape: { ...DEFAULT_SHAPE },
  colors: { fur: "#17171a", accent: "#c8ff3d", eye: "#ffffff" },
  pattern: "solid",
  slots: { hat: null, eyewear: null, neck: null, face: null, back: null, backdrop: null },
  expression: "happy",
  flex: "sticker",
};

/** Four breeds, each a full set of sliders plus the colours that sell it. */
export const BREED_PRESETS: {
  id: string;
  name: string;
  config: Pick<CatConfig, "shape" | "colors" | "pattern" | "expression">;
}[] = [
  {
    id: "midnight",
    name: "Midnight",
    config: {
      shape: { body: 0.92, head: 0.95, earSize: 1.1, earTilt: -4, eyeSize: 1.18, eyeSpacing: 1.02, tailLength: 1.25 },
      colors: { fur: "#17171a", accent: "#c8ff3d", eye: "#ffffff" },
      pattern: "solid",
      expression: "happy",
    },
  },
  {
    id: "cream",
    name: "Cream",
    config: {
      shape: { body: 1.22, head: 1.12, earSize: 0.88, earTilt: 6, eyeSize: 0.92, eyeSpacing: 1.1, tailLength: 0.8 },
      colors: { fur: "#f4f1e7", accent: "#ffb3d1", eye: "#5b6474" },
      pattern: "tuxedo",
      expression: "chill",
    },
  },
  {
    id: "tuxedo",
    name: "Tuxedo",
    config: {
      shape: { body: 1, head: 0.98, earSize: 1, earTilt: 0, eyeSize: 1.1, eyeSpacing: 0.96, tailLength: 1.1 },
      colors: { fur: "#2b2b31", accent: "#ffffff", eye: "#c8ff3d" },
      pattern: "tuxedo",
      expression: "smug",
    },
  },
  {
    id: "forest",
    name: "Forest",
    config: {
      shape: { body: 1.12, head: 1.04, earSize: 1.24, earTilt: 10, eyeSize: 0.86, eyeSpacing: 1.04, tailLength: 1.34 },
      colors: { fur: "#8d6e4d", accent: "#ffd166", eye: "#ffffff" },
      pattern: "tabby",
      expression: "surprised",
    },
  },
];

const HEX = /^#[0-9a-f]{6}$/i;

function clampValue(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number * 1000) / 1000));
}

export function clampShape(input: unknown): CatShape {
  const raw = (input ?? {}) as Partial<Record<ShapeKey, unknown>>;
  const out = {} as CatShape;
  for (const key of Object.keys(SHAPE_RANGES) as ShapeKey[]) {
    const [min, max] = SHAPE_RANGES[key];
    out[key] = clampValue(raw[key], min, max, DEFAULT_SHAPE[key]);
  }
  return out;
}

function safeColor(value: unknown, palette: readonly string[], fallback: string): string {
  if (typeof value === "string" && HEX.test(value)) return value.toLowerCase();
  return fallback;
}

function safeOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Coerce anything (a stored JSON blob, a crafted request) into a renderable
 * config: unknown patterns/expressions/items fall back, colours must be hex,
 * sliders are clamped, and an item may only occupy its own slot.
 */
export function sanitizeCatConfig(input: unknown): CatConfig {
  const raw = (input ?? {}) as Record<string, unknown>;
  const colors = (raw.colors ?? {}) as Record<string, unknown>;
  const slots = (raw.slots ?? {}) as Record<string, unknown>;
  const safeSlots = { ...DEFAULT_CONFIG.slots };

  for (const slot of CAT_SLOTS) {
    const id = slots[slot];
    if (typeof id === "string" && slotForItem(id) === slot) safeSlots[slot] = id;
  }

  return {
    base: "cat",
    shape: clampShape(raw.shape),
    colors: {
      fur: safeColor(colors.fur, FUR_COLORS, DEFAULT_CONFIG.colors.fur),
      accent: safeColor(colors.accent, ACCENT_COLORS, DEFAULT_CONFIG.colors.accent),
      eye: safeColor(colors.eye, EYE_COLORS, DEFAULT_CONFIG.colors.eye),
    },
    pattern: safeOneOf(raw.pattern, PATTERNS, DEFAULT_CONFIG.pattern),
    slots: safeSlots,
    expression: safeOneOf(raw.expression, EXPRESSIONS, DEFAULT_CONFIG.expression),
    flex: safeOneOf(raw.flex, CAT_FLEX, DEFAULT_CONFIG.flex),
  };
}

/** Only what the SQL function should ever see. */
export function serializeCatConfig(config: CatConfig) {
  const safe = sanitizeCatConfig(config);
  return {
    base: "cat" as const,
    shape: safe.shape,
    colors: safe.colors,
    pattern: safe.pattern,
    slots: safe.slots,
    expression: safe.expression,
    flex: safe.flex,
  };
}

export function randomCatConfig(owned: (id: string) => boolean, random = Math.random): CatConfig {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length];
  const jitter = (key: ShapeKey) => {
    const [min, max] = SHAPE_RANGES[key];
    return Math.round((min + random() * (max - min)) * 1000) / 1000;
  };
  const slots = { ...DEFAULT_CONFIG.slots };
  for (const slot of CAT_SLOTS) {
    const choices = ITEM_IDS_BY_SLOT[slot].filter((id) => owned(id));
    if (choices.length && random() > 0.25) slots[slot] = pick(choices);
  }
  return sanitizeCatConfig({
    base: "cat",
    shape: Object.fromEntries((Object.keys(SHAPE_RANGES) as ShapeKey[]).map((key) => [key, jitter(key)])),
    colors: { fur: pick(FUR_COLORS), accent: pick(ACCENT_COLORS), eye: pick(EYE_COLORS) },
    pattern: pick(PATTERNS),
    slots,
    expression: pick(EXPRESSIONS),
  });
}

/**
 * Slider maths, kept out of the renderer so it can be tested on its own.
 * Every value is a multiplier around the centre of the 512 box.
 */
export function shapeTransforms(shape: CatShape) {
  const s = clampShape(shape);
  return {
    body: { scaleX: s.body, scaleY: 1 + (s.body - 1) * 1.35 },
    head: { scaleX: s.head, scaleY: 1 + (s.head - 1) * 0.8, lift: (s.head - 1) * 26 },
    ears: { scale: s.earSize, tilt: s.earTilt },
    eyes: { scale: s.eyeSize, gap: s.eyeSpacing * 52 },
    tail: { scale: s.tailLength, rotate: 6 + (s.tailLength - 1) * 16 },
  };
}
