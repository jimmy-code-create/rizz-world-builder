/**
 * Create Avatar: the 3D person a member makes for themselves, and the pet that
 * stands at their feet.
 *
 * The model lives in `public/models/avatar.glb`. It is a rigged character with
 * named materials rather than morph sliders, so what the builder can change is
 * read from the file: `AvatarBody`/`AvatarHead` are skin, `haircut` is hair,
 * `outfit_*` is clothing and `glasses` is a real accessory mesh. A model that
 * does ship morph targets still gets sliders — the discovery code stays.
 */

export const AVATAR_MODEL_URL = "/models/avatar.glb";

/** Where a member's own avatar is kept until `avatar3d_config` exists. */
export const AVATAR_STORAGE_KEY = "rizz:avatar3d";

/**
 * Skin tones. Flat hex rather than a colour picker: a face needs to look like a
 * person at a glance, and a free picker is where avatars start looking like
 * accidents.
 */
export const SKIN_TONES = [
  "#f2d3b8",
  "#e8bd97",
  "#d8a375",
  "#c08a5f",
  "#a66f47",
  "#8a5634",
  "#6b3f24",
  "#4a2a17",
  "#2e1a0e",
] as const;

export const HAIR_COLOURS = [
  "#151317",
  "#2b1d14",
  "#4a3222",
  "#7a5230",
  "#b4813f",
  "#d9b46b",
  "#8d8d92",
  "#c94f3d",
  "#7a4bd0",
  "#3f8fd6",
] as const;

export const OUTFIT_COLOURS = [
  "#1b1b1f",
  "#f2f2f4",
  "#c9ff3d",
  "#9be8ff",
  "#ff87b7",
  "#ffd166",
  "#c7a3ff",
  "#3d5afe",
  "#0f766e",
  "#8b3a2f",
] as const;

/** Defaults land on the model's own look: plain dark hair and a black tee. */
export const DEFAULT_HAIR = "#2b1d14";
export const DEFAULT_OUTFIT = "#1b1b1f";

export type Avatar3DConfig = {
  /** Base colour of the skin materials (multiplied over their texture). */
  skin: string;
  /** Colour of the `haircut` material. */
  hair: string;
  /** Colour of the `outfit_*` materials. */
  outfit: string;
  /** Wear the glasses the model ships with. */
  glasses: boolean;
  /** Facial hair on or off, for models that ship a beard morph. */
  beard: boolean;
  /** `mesh|morphName` → 0..1, for models that ship morph targets. */
  morphs: Record<string, number>;
};

export const DEFAULT_AVATAR: Avatar3DConfig = {
  skin: SKIN_TONES[2],
  hair: DEFAULT_HAIR,
  outfit: DEFAULT_OUTFIT,
  glasses: true,
  beard: false,
  morphs: {},
};

function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function clamp01(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function sanitizeAvatar3D(input: unknown): Avatar3DConfig {
  const raw = (input ?? {}) as Partial<Avatar3DConfig>;
  const morphs: Record<string, number> = {};
  if (raw.morphs && typeof raw.morphs === "object") {
    for (const [key, value] of Object.entries(raw.morphs)) {
      if (!/^[^|]{1,80}\|[^|]{1,80}$/.test(key)) continue;
      morphs[key] = clamp01(value);
    }
  }
  return {
    skin: hex(raw.skin, DEFAULT_AVATAR.skin),
    hair: hex(raw.hair, DEFAULT_HAIR),
    outfit: hex(raw.outfit, DEFAULT_OUTFIT),
    glasses: raw.glasses !== false,
    beard: raw.beard === true,
    morphs,
  };
}

export function loadStoredAvatar(): Avatar3DConfig {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (!raw) return DEFAULT_AVATAR;
    return sanitizeAvatar3D(JSON.parse(raw));
  } catch {
    return DEFAULT_AVATAR;
  }
}

export function storeAvatar(config: Avatar3DConfig) {
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Private mode: the avatar is still previewable, it just will not survive.
  }
}

/** What this particular model can actually be changed with. */
export type AvatarCapabilities = {
  skin: boolean;
  hair: boolean;
  outfit: boolean;
  glasses: boolean;
  morphs: AvatarMorphTarget[];
};

export const NO_CAPABILITIES: AvatarCapabilities = {
  skin: false,
  hair: false,
  outfit: false,
  glasses: false,
  morphs: [],
};

/** A morph the model actually has, named for a slider. */
export type AvatarMorphTarget = {
  key: string;
  mesh: string;
  name: string;
  group: "eyes" | "weight" | "beard" | "other";
  label: string;
};

const EYE_RE = /eye|blink|squint|pupil|iris|lid/i;
const WEIGHT_RE = /weight|body|muscle|fat|chub|belly|bulk|heavy|thin|slim/i;
const BEARD_RE = /beard|stubble|facial|moustache|mustache|goatee/i;

function prettify(name: string) {
  const spaced = name
    .replace(/[_.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Which slider section a morph belongs in, from its name. */
export function morphGroup(name: string): AvatarMorphTarget["group"] {
  if (BEARD_RE.test(name)) return "beard";
  if (EYE_RE.test(name)) return "eyes";
  if (WEIGHT_RE.test(name)) return "weight";
  return "other";
}

export function morphLabel(target: { group: AvatarMorphTarget["group"]; name: string }) {
  const base = prettify(target.name);
  if (target.group === "weight") return `${base} (body)`;
  if (target.group === "eyes") return `${base} (eyes)`;
  return base;
}

/**
 * Material names in the supplied model, matched by prefix so a `.001` suffix
 * from an export round-trip still lands on the right slider group.
 */
export const SKIN_MATERIAL_RE = /^(avatarhead|avatarbody)(\.|$)/i;
export const HAIR_MATERIAL_RE = /^haircut(\.|$)/i;
export const OUTFIT_MATERIAL_RE = /^outfit_/i;
export const GLASSES_RE = /^(glasses|eyewear|spectacles)(\.|_|$)/i;
