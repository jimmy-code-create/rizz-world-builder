/**
 * One source of truth for how a profile banner + theme is rendered.
 *
 * Every surface (settings preview, card, popup, full profile, account menu)
 * calls `getBanner(user)` so an uploaded image, the full-page gradient, or an
 * empty banner can never disagree between two views. The v1 column names still
 * say "banner", but the gradient now paints the whole profile behind the
 * banner and content — never the 3:1 banner box itself.
 */

export type BannerMode = "image" | "gradient" | "none";

export type BannerGradient = {
  c1: string;
  c2: string;
  angle: number;
};

export type BannerPreset = {
  id: string;
  label: string;
  c1: string;
  c2: string;
  angle: number;
  none?: boolean;
};

export const DEFAULT_BANNER_ANGLE = 160;

export const BANNER_PRESETS: BannerPreset[] = [
  { id: "signal", label: "Signal", c1: "#a3e635", c2: "#15803d", angle: 160 },
  { id: "aurora", label: "Aurora", c1: "#38bdf8", c2: "#6366f1", angle: 160 },
  { id: "ember", label: "Ember", c1: "#fb923c", c2: "#dc2626", angle: 160 },
  { id: "ocean", label: "Ocean", c1: "#38bdf8", c2: "#1d4ed8", angle: 160 },
  { id: "orchid", label: "Orchid", c1: "#f0abfc", c2: "#7e22ce", angle: 160 },
  { id: "moon", label: "Moon", c1: "#94a3b8", c2: "#334155", angle: 160 },
  { id: "gold", label: "Gold", c1: "#fde047", c2: "#b45309", angle: 160 },
  { id: "violet", label: "Violet", c1: "#c4b5fd", c2: "#4c1d95", angle: 160 },
  { id: "rose", label: "Rose", c1: "#fda4af", c2: "#9f1239", angle: 160 },
  { id: "forest", label: "Forest", c1: "#86efac", c2: "#14532d", angle: 160 },
  { id: "sunset", label: "Sunset", c1: "#fb923c", c2: "#831843", angle: 160 },
  { id: "neon", label: "Neon", c1: "#22d3ee", c2: "#a3e635", angle: 160 },
  { id: "ice", label: "Ice", c1: "#e0f2fe", c2: "#0369a1", angle: 160 },
  { id: "candy", label: "Candy", c1: "#f9a8d4", c2: "#60a5fa", angle: 160 },
  { id: "midnight", label: "Midnight", c1: "#312e81", c2: "#020617", angle: 160 },
  { id: "cherry", label: "Cherry", c1: "#fb7185", c2: "#7f1d1d", angle: 160 },
];

const HEX = /^#[0-9a-f]{6}$/i;

/** Old saved rows used preset names; keep those looks instead of resetting them. */
const LEGACY_PRESETS: Record<string, BannerGradient> = Object.fromEntries(
  BANNER_PRESETS.filter((preset) => !preset.none).map((preset) => [
    preset.id,
    { c1: preset.c1, c2: preset.c2, angle: preset.angle },
  ]),
);

export function isValidBannerHex(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

export function normalizeBannerHex(value: unknown, fallback = "#141416"): string {
  return isValidBannerHex(value) ? value.toLowerCase() : fallback;
}

/** Returns null instead of inventing a gradient when the saved value is invalid. */
export function normalizeBannerGradient(value: unknown): BannerGradient | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;
    const legacy = LEGACY_PRESETS[raw.toLowerCase().replace(/^preset[:-]/, "")];
    if (legacy) return { ...legacy };
    // Some older rows stored JSON in a text column.
    if (raw.startsWith("{")) {
      try {
        return normalizeBannerGradient(JSON.parse(raw));
      } catch {
        return null;
      }
    }
    return null;
  }

  if (Array.isArray(value) && value.length >= 2) {
    return normalizeBannerGradient({ c1: value[0], c2: value[1], angle: value[2] });
  }

  if (typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const presetName = typeof row.preset === "string" ? row.preset.toLowerCase() : null;
  if (presetName && !isValidBannerHex(row.c1)) {
    const legacy = LEGACY_PRESETS[presetName];
    if (legacy) return { ...legacy };
  }

  const c1 = row.c1 ?? row.primary ?? row.from;
  const c2 = row.c2 ?? row.accent ?? row.to;
  if (!isValidBannerHex(c1) || !isValidBannerHex(c2)) return null;
  const rawAngle = Number(row.angle ?? row.deg ?? DEFAULT_BANNER_ANGLE);
  const angle = Number.isFinite(rawAngle)
    ? Math.min(360, Math.max(0, Math.round(rawAngle)))
    : DEFAULT_BANNER_ANGLE;
  return { c1: c1.toLowerCase(), c2: c2.toLowerCase(), angle };
}

export function normalizeBannerMode(value: unknown): BannerMode | null {
  if (value === "image" || value === "gradient" || value === "none") return value;
  return null;
}

export function gradientCss(gradient: BannerGradient): string {
  return `linear-gradient(${gradient.angle}deg, ${gradient.c1}, ${gradient.c2})`;
}

function mixHex(from: string, to: string, toWeight: number): string {
  const weight = Math.min(1, Math.max(0, toWeight));
  const a = Number.parseInt(from.slice(1), 16);
  const b = Number.parseInt(to.slice(1), 16);
  const channel = (shift: number) => {
    const av = (a >> shift) & 255;
    const bv = (b >> shift) & 255;
    return Math.round(av + (bv - av) * weight)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

const DEFAULT_PROFILE_SURFACE = "#141416";

/**
 * The profile-wide theme. Discord tints the whole profile with the banner's
 * colours, then darkens it enough for white text to stay readable. The raw
 * gradient is only shown in the picker swatches; this version is the surface.
 */
export function profileThemeFor(gradient: BannerGradient | null): {
  background: string | null;
  surface: string;
} {
  if (!gradient) return { background: null, surface: DEFAULT_PROFILE_SURFACE };
  return {
    background: [
      "linear-gradient(180deg, rgba(8,8,10,0.40) 0%, rgba(8,8,10,0.70) 48%, rgba(8,8,10,0.90) 100%)",
      `linear-gradient(${gradient.angle}deg, ${gradient.c1}, ${gradient.c2})`,
    ].join(", "),
    // The presence-dot cutout and banner scrim need one solid colour. Use a
    // heavily darkened accent so it melts into the bottom of the page theme.
    surface: mixHex(gradient.c2, "#0b0b0c", 0.82),
  };
}

/** Match a saved gradient to a preset so the swatch can show its selected ring. */
export function presetForGradient(gradient: BannerGradient | null): BannerPreset | null {
  if (!gradient) return null;
  return (
    BANNER_PRESETS.find(
      (preset) =>
        !preset.none &&
        preset.c1.toLowerCase() === gradient.c1.toLowerCase() &&
        preset.c2.toLowerCase() === gradient.c2.toLowerCase() &&
        preset.angle === gradient.angle,
    ) ?? null
  );
}

function valueFrom(user: Record<string, unknown>, snake: string, camel: string): unknown {
  return user[snake] ?? user[camel];
}

function bustCache(url: string, updatedAt: unknown): string {
  if (!updatedAt) return url;
  const stamp = typeof updatedAt === "string" ? updatedAt.trim() : String(updatedAt);
  if (!stamp) return url;
  // Only the profile's own updated_at, never Date.now(): the URL stays stable
  // between renders so the browser cache keeps working.
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(stamp)}`;
}

export type BannerSource = {
  mode: BannerMode;
  imageUrl: string | null;
  gradient: BannerGradient | null;
  /** A CSS `background` value for the banner box (image or neutral empty). */
  background: string;
  /** Full-profile gradient layer; null means keep the app background. */
  profileBackground: string | null;
  /** Solid colour for the header scrim and presence-dot cutout. */
  surface: string;
  /** Stable React key for the selected source. */
  key: string;
};

const EMPTY_BANNER_BACKGROUND = "linear-gradient(135deg, #1a1a1d, #0f0f11)";

/**
 * Resolve a profile row (snake_case) or a form object (camelCase) into one
 * banner source. Images still own the 3:1 banner; the saved gradient is
 * returned separately as a profile-wide background. `banner_mode` is optional
 * for old rows, and a legacy "gradient" row with an image keeps the image.
 */
export function getBanner(user: unknown): BannerSource {
  if (!user || typeof user !== "object") {
    const theme = profileThemeFor(null);
    return {
      mode: "none",
      imageUrl: null,
      gradient: null,
      background: EMPTY_BANNER_BACKGROUND,
      profileBackground: theme.background,
      surface: theme.surface,
      key: "none",
    };
  }
  const row = user as Record<string, unknown>;

  const rawImage = valueFrom(row, "banner_url", "bannerUrl");
  const image = typeof rawImage === "string" && rawImage.trim() ? rawImage.trim() : null;
  const gradient = normalizeBannerGradient(valueFrom(row, "banner_gradient", "bannerGradient"));
  // Image and gradient are independent now: an uploaded image owns the banner,
  // the gradient owns the page, and the legacy banner_mode is no longer a
  // visibility switch (Remove clears banner_url itself).
  const mode: BannerMode = image ? "image" : gradient ? "gradient" : "none";
  const theme = profileThemeFor(gradient);

  if (image) {
    const url = bustCache(image, valueFrom(row, "updated_at", "updatedAt"));
    return {
      mode,
      imageUrl: url,
      gradient,
      // Anchor to the top so faces stay in frame when a wide photo is cropped
      // into the 3:1 banner.
      background: `url("${url.replace(/"/g, '\\"')}") center top / cover no-repeat`,
      profileBackground: theme.background,
      surface: theme.surface,
      key: `image:${url}:${gradient ? `${gradient.c1}:${gradient.c2}:${gradient.angle}` : "plain"}`,
    };
  }

  return {
    mode,
    imageUrl: image,
    gradient,
    background: EMPTY_BANNER_BACKGROUND,
    profileBackground: theme.background,
    surface: theme.surface,
    key: `empty:${mode}:${gradient ? `${gradient.c1}:${gradient.c2}:${gradient.angle}` : "plain"}`,
  };
}
