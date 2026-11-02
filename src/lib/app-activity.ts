/**
 * Whether opening the app is a "quick return" — less than ten minutes since
 * the last time it was visible — or a real cold start.
 *
 * A quick return shows the shell straight away instead of the branded
 * loading screen; the splash only earns its place after a longer absence
 * (or on a first visit). The pre-React boot script in `__root.tsx` writes the
 * stamp and sets `data-boot="quick"` on `<html>`; this module is the typed
 * side of that same contract. Keep its key and window in sync with the
 * inline script.
 */
export const AWAY_RESET_MS = 10 * 60 * 1000;
export const ACTIVE_AT_KEY = "rizz.last-active-at";

/** Record that the app is being used right now. */
export function markAppActive() {
  try {
    window.localStorage.setItem(ACTIVE_AT_KEY, String(Date.now()));
  } catch {
    // Private mode or storage disabled: the splash simply behaves as before.
  }
}

/**
 * True when this page load followed a recent use of the app, so the loading
 * screen should stand down. Safe during SSR (always false there).
 */
export function isQuickReturn() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.boot === "quick";
}
