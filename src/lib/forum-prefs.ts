import { useCallback, useEffect, useState } from "react";

/**
 * How one person likes to read a forum: layout, density, text size and whether
 * read threads stay on screen.
 *
 * The moderator's choice lives on the forum row; this module is only ever the
 * *reader's* preference. Layout and density are the two knobs both sides can
 * set, and they resolve in one order — the reader's choice for this forum, then
 * the moderator's forum default, then the app default — through
 * `resolveForumView`, so the toolbar, the list and the container can never
 * disagree about what is on screen. Text size and hide-read belong to the reader
 * alone, so they never take a forum default.
 */

export const FORUM_PREFS_KEY = "rizz:forum-prefs";
export const FORUM_PREFS_EVENT = "rizz:forum-prefs-changed";

export type ForumLayout = "card" | "compact" | "gallery";
export type ForumDensity = "comfortable" | "compact";
export type ForumSort = "activity" | "new" | "top" | "unanswered";
export type ForumFontScale = 0.9 | 1 | 1.08 | 1.16;

export const FORUM_LAYOUTS: { id: ForumLayout; label: string; hint: string }[] = [
  { id: "card", label: "Cards", hint: "Big cards with a thumbnail and a preview" },
  { id: "compact", label: "Compact", hint: "One dense row per thread" },
  { id: "gallery", label: "Gallery", hint: "Masonry grid of picture threads" },
];

export const FORUM_SORTS: { id: ForumSort; label: string }[] = [
  { id: "activity", label: "Latest activity" },
  { id: "new", label: "Newest first" },
  { id: "top", label: "Most liked" },
  { id: "unanswered", label: "Unanswered" },
];

export const FORUM_FONT_SCALES: { id: ForumFontScale; label: string }[] = [
  { id: 0.9, label: "Small" },
  { id: 1, label: "Default" },
  { id: 1.08, label: "Large" },
  { id: 1.16, label: "Huge" },
];

export const DEFAULT_FORUM_PREFS: ForumViewPrefs = {
  layout: "card",
  density: "comfortable",
  fontScale: 1,
  hideRead: false,
  perRoom: {},
};

export type ForumViewPrefs = {
  layout: ForumLayout;
  density: ForumDensity;
  fontScale: number;
  hideRead: boolean;
  /** A per-forum override, so a gallery board and a text board can differ. */
  perRoom: Record<string, Partial<Omit<ForumViewPrefs, "perRoom">>>;
};

function isLayout(value: unknown): value is ForumLayout {
  return value === "card" || value === "compact" || value === "gallery";
}

function isDensity(value: unknown): value is ForumDensity {
  return value === "comfortable" || value === "compact";
}

function normalize(raw: Partial<ForumViewPrefs> | null | undefined): ForumViewPrefs {
  const prefs = raw ?? {};
  const perRoom: ForumViewPrefs["perRoom"] = {};
  for (const [roomId, value] of Object.entries(prefs.perRoom ?? {})) {
    if (!value || typeof value !== "object") continue;
    const entry: Partial<Omit<ForumViewPrefs, "perRoom">> = {};
    if (isLayout(value.layout)) entry.layout = value.layout;
    if (isDensity(value.density)) entry.density = value.density;
    if (typeof value.fontScale === "number" && value.fontScale >= 0.8 && value.fontScale <= 1.4) {
      entry.fontScale = value.fontScale;
    }
    if (typeof value.hideRead === "boolean") entry.hideRead = value.hideRead;
    perRoom[roomId] = entry;
  }
  return {
    layout: isLayout(prefs.layout) ? prefs.layout : DEFAULT_FORUM_PREFS.layout,
    density: isDensity(prefs.density) ? prefs.density : DEFAULT_FORUM_PREFS.density,
    fontScale:
      typeof prefs.fontScale === "number" && prefs.fontScale >= 0.8 && prefs.fontScale <= 1.4
        ? prefs.fontScale
        : DEFAULT_FORUM_PREFS.fontScale,
    hideRead: prefs.hideRead === true,
    perRoom,
  };
}

export function loadForumPrefs(): ForumViewPrefs {
  if (typeof window === "undefined") return DEFAULT_FORUM_PREFS;
  try {
    return normalize(JSON.parse(localStorage.getItem(FORUM_PREFS_KEY) || "{}") as Partial<ForumViewPrefs>);
  } catch {
    return DEFAULT_FORUM_PREFS;
  }
}

export function saveForumPrefs(prefs: ForumViewPrefs): ForumViewPrefs {
  const next = normalize(prefs);
  if (typeof localStorage !== "undefined") localStorage.setItem(FORUM_PREFS_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FORUM_PREFS_EVENT));
  return next;
}

export type ForumDefaults = {
  default_layout?: string | null;
  default_density?: string | null;
  default_sort?: string | null;
};

/**
 * The settings actually used on screen.
 *
 * Layout and density: the reader's choice for *this* forum wins (that is what
 * "remember my choice" means), otherwise the moderator's default, otherwise the
 * app default. Text size and hide-read are the reader's alone and ignore the
 * forum's defaults entirely.
 *
 * A forum default that is not a valid value is ignored rather than trusted, so a
 * hand-edited row can never render an unusable layout.
 */
export function resolveForumView(
  prefs: ForumViewPrefs,
  roomId: string | null | undefined,
  defaults: ForumDefaults | null | undefined,
): { layout: ForumLayout; density: ForumDensity; fontScale: number; hideRead: boolean; sort: ForumSort } {
  const perRoom = (roomId && prefs.perRoom[roomId]) || {};
  const layout = perRoom.layout
    ?? (isLayout(defaults?.default_layout) ? defaults.default_layout : prefs.layout);
  const density = perRoom.density
    ?? (isDensity(defaults?.default_density) ? defaults.default_density : prefs.density);
  const sort = FORUM_SORTS.some((entry) => entry.id === defaults?.default_sort)
    ? (defaults!.default_sort as ForumSort)
    : "activity";
  return {
    layout,
    density,
    fontScale: perRoom.fontScale ?? prefs.fontScale,
    hideRead: perRoom.hideRead ?? prefs.hideRead,
    sort,
  };
}

/**
 * One preference store per tab, kept in sync with every other reader of it —
 * the toolbar toggles and the list are the same state, not two copies.
 */
export function useForumPrefs() {
  const [prefs, setPrefs] = useState<ForumViewPrefs>(() => loadForumPrefs());

  useEffect(() => {
    const sync = () => setPrefs(loadForumPrefs());
    window.addEventListener(FORUM_PREFS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FORUM_PREFS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** Room-scoped updates stay on this forum; global ones change the default. */
  const update = useCallback(
    (
      patch: Partial<Omit<ForumViewPrefs, "perRoom">>,
      options?: { roomId?: string | null; global?: boolean; clearRoom?: boolean },
    ) => {
      const current = loadForumPrefs();
      if (options?.roomId && !options.global) {
        const room = { ...(current.perRoom[options.roomId] ?? {}) };
        if (options.clearRoom) {
          delete current.perRoom[options.roomId];
          setPrefs(saveForumPrefs(current));
          return;
        }
        setPrefs(saveForumPrefs({
          ...current,
          perRoom: { ...current.perRoom, [options.roomId]: { ...room, ...patch } },
        }));
        return;
      }
      if (options?.roomId && options.global) {
        const perRoom = { ...current.perRoom };
        delete perRoom[options.roomId];
        setPrefs(saveForumPrefs({ ...current, ...patch, perRoom }));
        return;
      }
      setPrefs(saveForumPrefs({ ...current, ...patch }));
    },
    [],
  );

  return { prefs, update };
}
