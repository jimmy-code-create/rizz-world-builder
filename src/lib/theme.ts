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
  { id: "dark", label: "Dark", hint: "Ink black with acid lime (default)" },
  { id: "light", label: "Light", hint: "Warm paper, ink text" },
  { id: "amoled", label: "AMOLED black", hint: "True black for OLED screens" },
  { id: "auto", label: "Auto", hint: "Follow the device setting" },
];

export const THEME_PRESETS: { id: ThemePreset; name: string; desc: string; colors: string[] }[] = [
  { id: "nightclub", name: "Ink", desc: "Near-black ink + acid lime (default)", colors: ["#0a0a0b", "#c9ff3d", "#f4f1e7"] },
  { id: "midnight", name: "Midnight", desc: "Cold blue on black", colors: ["#0b1220", "#3b82f6", "#93c5fd"] },
  { id: "sunset", name: "Sunset", desc: "Rust and amber, no neon", colors: ["#2a1508", "#e2601f", "#f0b429"] },
  { id: "cyber", name: "Cyber", desc: "Signal green on deep green", colors: ["#07130d", "#22c55e", "#a3e635"] },
  { id: "mono", name: "Mono", desc: "Ink, paper, nothing else", colors: ["#0a0a0b", "#f4f1e7", "#a9a69c"] },
  { id: "pastel", name: "Paper", desc: "Warm off-white and clay", colors: ["#f2efe6", "#c46a4a", "#8a7f6a"] },
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