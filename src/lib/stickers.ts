import manifest from "../../public/stickers/manifest.json";

/**
 * Sticker catalog + a tiny in-memory cache.
 *
 * The manifest is bundled rather than fetched at runtime: it is 52 KB of static
 * data, and keeping it in the bundle removes a request that used to sit between
 * opening the sheet and showing anything. Media is still served from
 * `public/stickers` by the app (or Render's static handler).
 */
export type StickerPack = "noto" | "black-cat" | "kotya";

export type Sticker = {
  id: string;
  pack: StickerPack;
  label: string;
  src: string;
  poster?: string;
  animated: boolean;
};

export type StickerPackInfo = {
  id: StickerPack;
  label: string;
  /** Static thumbnail used by the pack pill. */
  icon: string;
  count: number;
};

export const STICKER_MANIFEST = manifest as Sticker[];

const byPack = new Map<StickerPack, Sticker[]>();
const packInfo = new Map<StickerPack, StickerPackInfo>();
const preloaded = new Set<string>();
const loadState = new Map<string, "loaded" | "failed">();

const PACK_META: Record<StickerPack, { label: string; order: number }> = {
  "black-cat": { label: "Black cat", order: 0 },
  noto: { label: "Noto", order: 1 },
  kotya: { label: "Kotya HD", order: 2 },
};

function entriesFor(pack: StickerPack): Sticker[] {
  const cached = byPack.get(pack);
  if (cached) return cached;
  const entries = STICKER_MANIFEST.filter((sticker) => sticker.pack === pack);
  byPack.set(pack, entries);
  return entries;
}

export const STICKER_PACKS: StickerPackInfo[] = (
  Object.keys(PACK_META) as StickerPack[]
)
  .sort((a, b) => PACK_META[a].order - PACK_META[b].order)
  .map((pack) => {
    const cached = packInfo.get(pack);
    if (cached) return cached;
    const entries = entriesFor(pack);
    const info: StickerPackInfo = {
      id: pack,
      label: PACK_META[pack].label,
      icon: entries[0]?.poster ?? entries[0]?.src ?? "",
      count: entries.length,
    };
    packInfo.set(pack, info);
    return info;
  });

export function stickersForPack(pack: StickerPack): Sticker[] {
  return entriesFor(pack);
}

/** `true` when the media has already painted once this session. */
export function stickerLoadState(src: string): "loaded" | "failed" | "unknown" {
  return loadState.get(src) ?? "unknown";
}

export function markStickerLoaded(src: string): void {
  loadState.set(src, "loaded");
}

export function markStickerFailed(src: string): void {
  loadState.set(src, "failed");
}

/**
 * Warm the first screenful of a pack when its pill appears. This is deliberately
 * capped: Black cat and Noto have 157/128 entries, and downloading every poster
 * up front would be worse than the lazy grid it is meant to accelerate.
 */
export function preloadStickerPack(pack: StickerPack): void {
  if (preloaded.has(pack) || typeof window === "undefined") return;
  preloaded.add(pack);
  for (const sticker of entriesFor(pack).slice(0, 12)) {
    const src = sticker.poster ?? sticker.src;
    if (!src || /\.(webm|mp4)$/i.test(src)) continue;
    const image = new window.Image();
    image.decoding = "async";
    image.src = src;
  }
}

export function isAnimatedSticker(sticker: Sticker): boolean {
  return sticker.animated && /\.(webm|mp4)$/i.test(sticker.src);
}

export function isVideoStickerSource(src: string | null | undefined): boolean {
  return Boolean(src && /\.(webm|mp4)(\?|#|$)/i.test(src));
}
