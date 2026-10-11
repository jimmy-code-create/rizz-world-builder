import { useSyncExternalStore } from "react";

export const RIZZ_COMPANION_PREF_KEY = "rizz:companion-enabled";
const CHANGE_EVENT = "rizz:companion-preference-changed";

function getSnapshot(): boolean {
  try {
    // Keep the existing enabled behavior unless explicitly switched off.
    return localStorage.getItem(RIZZ_COMPANION_PREF_KEY) !== "false";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === RIZZ_COMPANION_PREF_KEY || event.key === null) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setRizzCompanionEnabled(enabled: boolean): void {
  // Let Settings report storage failures rather than claiming it was saved.
  localStorage.setItem(RIZZ_COMPANION_PREF_KEY, String(enabled));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useRizzCompanionEnabled(): boolean {
  // Do not mount voice hooks until the browser preference has been read.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
