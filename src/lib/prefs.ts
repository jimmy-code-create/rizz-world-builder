export const PREFS_KEY = "rizz:prefs";

export type Prefs = {
  autoplay: boolean;
  dataSaver: boolean;
  sounds: boolean;
  blurSensitive: boolean;
  focusMode: boolean;
  colorBlind: boolean;
  mentionColor: string;
  textScale: number; // 0.92 - 1.2
  /** Emoji size multiplier. One value for every emoji, in every surface. */
  emojiScale: number; // 0.75 - 1.6
  /** Set the moment someone moves the text-size slider, so their choice is never migrated again. */
  textScaleCustom?: boolean;
  language: string;
  /** Show cards for links in chats. */
  linkPreviews: boolean;
};

/** Fired whenever prefs change, so live UI (like Link previews) updates at once. */
export const PREFS_EVENT = "rizz:prefs-changed";

export const DEFAULT_PREFS: Prefs = {
  autoplay: true,
  dataSaver: false,
  sounds: true,
  blurSensitive: true,
  focusMode: false,
  colorBlind: false,
  mentionColor: "#5865f2",
  textScale: 0.92,
  emojiScale: 1,
  language: "auto",
  linkPreviews: true,
};

/** The text size the app used to ship as its default, before it moved to 92%. */
const LEGACY_DEFAULT_TEXT_SCALE = 0.9;

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") as Partial<Prefs>;
    const merged = { ...DEFAULT_PREFS, ...stored };
    if (typeof stored.emojiScale !== "number") merged.emojiScale = DEFAULT_PREFS.emojiScale;
    // New users get 92%. Existing users who never touched the slider still sit on
    // the old 90% default and are moved up; anyone who chose their own size keeps it.
    if (
      stored.textScaleCustom !== true &&
      typeof stored.textScale === "number" &&
      Math.abs(stored.textScale - LEGACY_DEFAULT_TEXT_SCALE) < 1e-9
    ) {
      merged.textScale = DEFAULT_PREFS.textScale;
    }
    return merged;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function applyPrefs(p: Prefs) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${Math.round(p.textScale * 100)}%`;
  // One emoji size for the whole app: captions, comments, chat, the composer
  // and the picker all read the same variable, so nothing drifts per screen.
  const emojiScale = Number.isFinite(p.emojiScale)
    ? Math.min(1.6, Math.max(0.75, p.emojiScale))
    : 1;
  document.documentElement.style.setProperty("--emoji-scale", String(emojiScale));
  document.documentElement.style.setProperty(
    "--emoji-size",
    `${(1.15 * emojiScale).toFixed(3)}em`,
  );
  document.documentElement.classList.toggle("focus-mode", p.focusMode);
  // Reels and any other media surface read this class when choosing a preload
  // window, so Data saver does not need a second settings store.
  document.documentElement.classList.toggle("data-saver", p.dataSaver);
  document.documentElement.classList.toggle("color-blind", p.colorBlind);
  document.documentElement.style.setProperty("--rizz-mention-color", p.mentionColor);
  document.documentElement.lang = resolveHtmlLanguage(p.language);
}

/** "auto" (or anything unknown) resolves to the browser language, else English.
 *  Kept here instead of importing i18n so prefs never cycles back into it. */
export function resolveHtmlLanguage(pref?: string): string {
  const supported = ["en", "es", "fr", "de", "ja", "hi", "pt"];
  if (pref && pref !== "auto" && supported.includes(pref)) return pref;
  if (typeof navigator !== "undefined") {
    const nav = navigator.language || "";
    if (supported.includes(nav)) return nav;
    const base = nav.split("-")[0];
    if (base && supported.includes(base)) return base;
  }
  return "en";
}

export function savePrefs(p: Prefs) {
  if (typeof localStorage !== "undefined") localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  applyPrefs(p);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PREFS_EVENT));
}
