export type ThemePreset = "nightclub" | "midnight" | "sunset" | "cyber" | "mono" | "pastel";
export type ThemeMode = "dark" | "light" | "amoled" | "auto";
export type Density = "comfy" | "compact";

/**
 * The modes someone can pick, in the order the settings screen shows them.
 *
 * "amoled" is the true-black variant of dark: on an OLED panel a #000 surface
 * draws no light at all, so the forum and chat surfaces step up to a visible
 * near-black and borders carry the separation that shadows used to.
 */
export const THEME_MODES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: "dark", label: "Dark", hint: "The default nightclub dark" },
  { id: "light", label: "Light", hint: "Bright surfaces, darkened accents" },
  { id: "amoled", label: "AMOLED black", hint: "True black for OLED screens" },
  { id: "auto", label: "Auto", hint: "Follow the device setting" },
];

export const THEME_PRESETS: { id: ThemePreset; name: string; desc: string; colors: string[] }[] = [
  { id: "nightclub", name: "Nightclub", desc: "Hot pink + violet (default)", colors: ["#ff2d92", "#7c3aed", "#22d3ee"] },
  { id: "midnight", name: "Midnight", desc: "Deep ocean blue", colors: ["#3b82f6", "#1e1b4b", "#06b6d4"] },
  { id: "sunset", name: "Sunset", desc: "Warm fire orange", colors: ["#f97316", "#ec4899", "#facc15"] },
  { id: "cyber", name: "Cyber", desc: "Matrix green", colors: ["#22c55e", "#06b6d4", "#a3e635"] },
  { id: "mono", name: "Mono", desc: "Pure black & white", colors: ["#fafafa", "#525252", "#a3a3a3"] },
  { id: "pastel", name: "Pastel Dream", desc: "Soft and dreamy", colors: ["#f9a8d4", "#c4b5fd", "#a5f3fc"] },
];

export function applyTheme(preset: ThemePreset, mode: ThemeMode, density: Density, reducedMotion: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = preset;
  const resolvedMode = mode === "auto"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : mode;
  // Styling hangs off `data-mode`, so light, dark and AMOLED are three blocks of
  // tokens in styles.css and this stays a single attribute assignment.
  root.dataset.mode = resolvedMode;
  root.dataset.density = density;
  root.dataset.reducedMotion = reducedMotion ? "true" : "false";
}