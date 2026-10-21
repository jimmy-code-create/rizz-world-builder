/**
 * Profile banner gradients.
 *
 * Discord lets a member pick a standing gradient for the profile banner instead
 * of uploading an image. The preset id is stored in `profiles.banner_gradient`
 * and resolved here on every surface, so the shop, cards and the own-profile
 * editor all paint the same two/three-stop ramp.
 */
export type BannerGradientId =
  | "signal"
  | "aurora"
  | "ember"
  | "ocean"
  | "orchid"
  | "moon"
  | "gold";

export type BannerGradient = {
  id: BannerGradientId;
  label: string;
  colors: [string, string, string];
  /** Ink that stays readable on the gradient's light end. */
  ink: string;
};

export const BANNER_GRADIENTS: BannerGradient[] = [
  { id: "signal", label: "Signal", colors: ["#dcff77", "#b6f22e", "#4d7d00"], ink: "#141807" },
  { id: "aurora", label: "Aurora", colors: ["#65f5d0", "#4d9bff", "#6b57e8"], ink: "#071411" },
  { id: "ember", label: "Ember", colors: ["#ffc46b", "#ff6247", "#8e1730"], ink: "#1b0905" },
  { id: "ocean", label: "Ocean", colors: ["#7ee8ff", "#3194ff", "#26309a"], ink: "#04121a" },
  { id: "orchid", label: "Orchid", colors: ["#ffa6e8", "#cf72ff", "#6640d8"], ink: "#18081a" },
  { id: "moon", label: "Moon", colors: ["#cbd8e3", "#71859a", "#1a222b"], ink: "#0b1117" },
  { id: "gold", label: "Gold", colors: ["#ffe9a8", "#f0bd4d", "#8b5a12"], ink: "#1b1204" },
];

const BY_ID = new Map(BANNER_GRADIENTS.map((gradient) => [gradient.id, gradient]));

export function isBannerGradientId(value: unknown): value is BannerGradientId {
  return typeof value === "string" && BY_ID.has(value as BannerGradientId);
}

export function bannerGradientFor(value: string | null | undefined): BannerGradient | null {
  return isBannerGradientId(value) ? BY_ID.get(value)! : null;
}

/** The CSS value for a preset, or null when the member has no gradient. */
export function bannerGradientCss(value: string | null | undefined): string | null {
  const gradient = bannerGradientFor(value);
  if (!gradient) return null;
  return `linear-gradient(135deg, ${gradient.colors[0]} 0%, ${gradient.colors[1]} 48%, ${gradient.colors[2]} 100%)`;
}

/**
 * Banner paint: an uploaded image always wins (like Discord), then the chosen
 * gradient, then the muted per-account fallback tone.
 */
export function bannerBackground(
  url: string | null | undefined,
  gradient: string | null | undefined,
  fallback: string,
): string {
  if (url) return `url("${url}") center/cover`;
  return bannerGradientCss(gradient) ?? fallback;
}
