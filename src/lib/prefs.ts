export const PREFS_KEY = "rizz:prefs";

export type Prefs = {
  autoplay: boolean;
  dataSaver: boolean;
  sounds: boolean;
  blurSensitive: boolean;
  focusMode: boolean;
  colorBlind: boolean;
  mentionColor: string;
  textScale: number; // 0.9 - 1.2
  language: string;
};

export const DEFAULT_PREFS: Prefs = {
  autoplay: true,
  dataSaver: false,
  sounds: true,
  blurSensitive: true,
  focusMode: false,
  colorBlind: false,
  mentionColor: "#5865f2",
  textScale: 1,
  language: "en",
};

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function applyPrefs(p: Prefs) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${Math.round(p.textScale * 100)}%`;
  document.documentElement.classList.toggle("focus-mode", p.focusMode);
  document.documentElement.classList.toggle("color-blind", p.colorBlind);
  document.documentElement.style.setProperty("--rizz-mention-color", p.mentionColor);
}

export function savePrefs(p: Prefs) {
  if (typeof localStorage !== "undefined") localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  applyPrefs(p);
}
