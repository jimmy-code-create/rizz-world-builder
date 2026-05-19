export type ThemePreset = "nightclub" | "midnight" | "sunset" | "cyber" | "mono" | "pastel";
export type ThemeMode = "dark" | "light" | "auto";
export type Density = "comfy" | "compact";

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
  root.dataset.mode = resolvedMode;
  root.dataset.density = density;
  root.dataset.reducedMotion = reducedMotion ? "true" : "false";
}