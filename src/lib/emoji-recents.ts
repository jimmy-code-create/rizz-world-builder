import { useSyncExternalStore } from 'react';

export type EmojiPrefRecord = {
  top: string[];
  recents: string[];
  favorites: string[];
  updatedAt: number;
};

const PREFS_KEY = 'rizz:emoji-prefs:v1';

function defaultPrefs(): EmojiPrefRecord {
  return { top: [], recents: [], favorites: [], updatedAt: 0 };
}

let cachedRaw: string | null = null;
let cachedSnapshot: EmojiPrefRecord = defaultPrefs();

function readPrefs(): EmojiPrefRecord {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PREFS_KEY) : null;
    if (!raw) return defaultPrefs();
    if (raw === cachedRaw) return cachedSnapshot;
    const parsed = JSON.parse(raw) as Partial<EmojiPrefRecord>;
    const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0;
    if (updatedAt <= 0) return defaultPrefs();
    cachedRaw = raw;
    cachedSnapshot = {
      top: Array.isArray(parsed.top) ? parsed.top.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 12) : [],
      recents: Array.isArray(parsed.recents) ? parsed.recents.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 60) : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 60) : [],
      updatedAt,
    };
    return cachedSnapshot;
  } catch {
    return defaultPrefs();
  }
}

function writePrefs(prefs: EmojiPrefRecord): void {
  try {
    if (typeof window === 'undefined') return;
    const raw = JSON.stringify(prefs);
    cachedRaw = raw;
    cachedSnapshot = prefs;
    window.localStorage.setItem(PREFS_KEY, raw);
    window.dispatchEvent(new Event('rizz-emoji-prefs-change'));
  } catch {
    // LocalStorage may be unavailable; prefs are best-effort.
  }
}

function subscribe(callback: () => void): (() => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener('rizz-emoji-prefs-change', handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('rizz-emoji-prefs-change', handler);
  };
}

export function useEmojiPreferences(): EmojiPrefRecord {
  return useSyncExternalStore(
    subscribe,
    readPrefs,
    defaultPrefs,
  );
}

export function recordEmojiUse(emoji: string, realmKey?: string): void {
  if (typeof emoji !== 'string' || emoji.length === 0) return;
  const prefs = readPrefs();
  const recents = [emoji, ...prefs.recents.filter((v) => v !== emoji)].slice(0, 60);
  const favorites = prefs.favorites;
  const top = computeTopEmojiList({
    ...prefs,
    recents,
    favorites,
  });
  writePrefs({ top, recents, favorites, updatedAt: Date.now() });
}

export function toggleEmojiFavorite(emoji: string): void {
  if (typeof emoji !== 'string' || emoji.length === 0) return;
  const prefs = readPrefs();
  const favorites = prefs.favorites.includes(emoji)
    ? prefs.favorites.filter((v) => v !== emoji)
    : [...prefs.favorites.filter((v) => v !== emoji), emoji];
  const top = computeTopEmojiList({ ...prefs, favorites });
  writePrefs({ top, recents: prefs.recents, favorites, updatedAt: Date.now() });
}

export function topEmojiForRealm(realmKey?: string): string[] {
  const prefs = readPrefs();
  return prefs.top;
}

function computeTopEmojiList(prefs: EmojiPrefRecord): string[] {
  const counts = new Map<string, number>();
  for (const emoji of prefs.recents) {
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  }
  for (const emoji of prefs.favorites) {
    counts.set(emoji, (counts.get(emoji) ?? 0) + 3);
  }
  const sorted = [...counts.entries()].sort((a, b) => {
    const delta = b[1] - a[1];
    if (delta !== 0) return delta;
    return b[0].localeCompare(a[0]);
  });
  return sorted.map((entry) => entry[0]).slice(0, 12);
}
