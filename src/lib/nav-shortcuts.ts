/**
 * Pinned + recent destinations for the mobile "More" sheet.
 *
 * Both lists live in localStorage. Callers validate saved paths against the
 * current destination list, so renamed or removed screens never become dead
 * chips. Frontend-only, per the project scope.
 */
export const RECENTS_KEY = "rizz:recent-destinations";
export const PINS_KEY = "rizz:more-pins";
export const RECENTS_LIMIT = 6;

function loadList(key: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function saveList(key: string, list: string[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(list));
}

/** Moves a destination to the front of the recents list. */
export function recordRecent(path: string, known: readonly string[]): string[] {
  const next = [path, ...loadList(RECENTS_KEY).filter((item) => item !== path)]
    .filter((item) => known.includes(item))
    .slice(0, RECENTS_LIMIT);
  saveList(RECENTS_KEY, next);
  return next;
}

export function loadRecents(): string[] {
  return loadList(RECENTS_KEY);
}

export function loadPins(): string[] {
  return loadList(PINS_KEY);
}

/** Pins or unpins a destination and returns the new list. */
export function togglePin(path: string): string[] {
  const current = loadList(PINS_KEY);
  const next = current.includes(path)
    ? current.filter((item) => item !== path)
    : [...current, path];
  saveList(PINS_KEY, next);
  return next;
}
