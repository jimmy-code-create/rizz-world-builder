import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  Clock3,
  Heart,
  Image as ImageIcon,
  Plus,
  Loader2,
  Search,
  Smile,
  Sparkles,
  Sticker as StickerIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { FluentEmoji } from "@/components/emoji/FluentEmoji";
import { StickerMedia } from "@/components/chat/StickerMedia";
import { SMILEY_EMOJI, searchSmileys } from "@/lib/smiley-data";
import { isSingleEmoji } from "@/lib/unicode-emoji";
import { recordEmojiUse, toggleEmojiFavorite, useEmojiPreferences } from "@/lib/emoji-recents";
import { usePurify } from "@/lib/purify";
import { RizzLibrarySheet } from "@/components/chat/RizzLibrarySheet";
import { useAuth } from "@/lib/auth";
import { openPurifyPaywall } from "@/lib/purify-paywall";
import { useAvailableEmojis } from "@/lib/emoji-available";
import {
  STICKER_PACKS,
  preloadStickerPack,
  stickersForPack,
  type Sticker,
  type StickerPack,
} from "@/lib/stickers";

export type ChatPickerTab = "recent" | "emoji" | "gifs" | "stickers" | "favorites";
export type ChatPanelMode = "picker" | "attach";

export type ChatDockPanelProps = {
  mode: ChatPanelMode;
  tab: ChatPickerTab;
  onTabChange: (tab: ChatPickerTab) => void;
  disabled?: boolean;
  onPickEmoji: (token: string) => void;
  onSendMarker: (marker: string) => void;
  onManageEmoji?: () => void;
  recentPhotos?: { id: string; url: string }[];
  onPickRecentPhoto?: (url: string) => void;
  onPhotos: () => void;
  onCamera: () => void;
  onFiles: () => void;
  onSchedule?: () => void;
  onPoll?: () => void;
  scheduleDisabled?: boolean;
};

const TABS: Array<{ id: ChatPickerTab; label: string; icon: typeof Smile }> = [
  { id: "recent", label: "Recent", icon: Clock3 },
  { id: "emoji", label: "Emoji", icon: Smile },
  { id: "gifs", label: "GIFs", icon: ImageIcon },
  { id: "stickers", label: "Stickers", icon: StickerIcon },
  { id: "favorites", label: "Favorites", icon: Heart },
];

const CATEGORIES = ["Hi", "Love", "Haha", "Sad", "Yay", "Wow"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_TAGS: Record<Category, string[]> = {
  Hi: ["hello", "hi", "wave", "hey", "salute"],
  Love: ["love", "heart", "kiss", "blush", "adore", "crush"],
  Haha: ["laugh", "funny", "lol", "rofl", "giggle", "silly"],
  Sad: ["sad", "cry", "tear", "frown", "weary", "please"],
  Yay: ["party", "celebrate", "yay", "star", "confetti", "proud"],
  Wow: ["wow", "shock", "surprised", "amazed", "mind blown", "cool"],
};

const RECENTS_KEY = "rizz:chat-panel-recents:v1";
const LAST_TAB_KEY = "rizz:chat-panel-tab:v1";
const GIF_MARKER = (url: string) => `![gif](${url})`;
const STICKER_MARKER = (url: string) => `![sticker](${url})`;
const EMOJI_ROW_H = 44;
const MEDIA_ROW_H = 84;

type PanelCell =
  | { kind: "emoji"; key: string; token: string; name: string; char: string }
  | { kind: "realm"; key: string; token: string; name: string; url: string }
  | { kind: "gif"; key: string; marker: string; name: string; url: string }
  | { kind: "sticker"; key: string; marker: string; name: string; sticker: Sticker };

function chunk<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

function readPanelRecents(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writePanelRecents(values: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(values.slice(0, 48)));
  } catch {
    // Private mode can refuse storage.
  }
}

export function readLastChatPickerTab(): ChatPickerTab {
  try {
    const value = localStorage.getItem(LAST_TAB_KEY);
    return TABS.some((tab) => tab.id === value) ? (value as ChatPickerTab) : "emoji";
  } catch {
    return "emoji";
  }
}

export function writeLastChatPickerTab(tab: ChatPickerTab) {
  try {
    localStorage.setItem(LAST_TAB_KEY, tab);
  } catch {
    // Best effort.
  }
}

function VirtualGrid<T>({
  items,
  columns,
  rowHeight,
  renderCell,
}: {
  items: T[];
  columns: number;
  rowHeight: number;
  renderCell: (item: T) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(0);
  const [view, setView] = useState({ top: 0, height: 420 });
  const rows = useMemo(() => chunk(items, columns), [items, columns]);

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setView((current) =>
      current.top === element.scrollTop && current.height === element.clientHeight
        ? current
        : { top: element.scrollTop, height: element.clientHeight || 420 },
    );
  }, []);

  useEffect(() => {
    measure();
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, items.length, columns]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      setView({ top: element.scrollTop, height: element.clientHeight || 420 });
    });
  };

  const overscan = rowHeight * 4;
  const startRow = Math.max(0, Math.floor((view.top - overscan) / rowHeight));
  const endRow = Math.min(
    rows.length - 1,
    Math.ceil((view.top + view.height + overscan) / rowHeight),
  );

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="chat-dock-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div style={{ height: rows.length * rowHeight, position: "relative" }}>
        {rows.slice(startRow, endRow + 1).map((row, rowOffset) => {
          const rowIndex = startRow + rowOffset;
          return (
            <div
              key={rowIndex}
              className="absolute inset-x-0 grid gap-1 px-1"
              style={{
                top: rowIndex * rowHeight,
                height: rowHeight,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {row.map((item, columnIndex) => (
                <div key={rowIndex * columns + columnIndex} className="min-w-0">
                  {renderCell(item)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const EmojiButton = memo(function EmojiButton({
  cell,
  onPick,
  onFavorite,
}: {
  cell: Extract<PanelCell, { kind: "emoji" | "realm" }>;
  onPick: (token: string) => void;
  onFavorite: (token: string) => void;
}) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };
  useEffect(() => clear, []);
  return (
    <button
      type="button"
      className="chat-dock-emoji"
      aria-label={cell.kind === "realm" ? `:${cell.name}:` : `${cell.name} emoji`}
      title={cell.kind === "realm" ? `:${cell.name}:` : cell.name}
      onPointerDown={(event) => {
        longPressed.current = false;
        clear();
        origin.current = { x: event.clientX, y: event.clientY };
        timer.current = window.setTimeout(() => {
          longPressed.current = true;
          onFavorite(cell.token);
        }, 450);
      }}
      onPointerMove={(event) => {
        const start = origin.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(event) => {
        event.preventDefault();
        onFavorite(cell.token);
      }}
      onClick={() => {
        clear();
        if (!longPressed.current) onPick(cell.token);
        longPressed.current = false;
      }}
    >
      {cell.kind === "realm" ? (
        cell.url ? (
          <img src={cell.url} alt="" loading="lazy" decoding="async" className="h-7 w-7" />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded bg-secondary text-[10px] font-bold text-muted-foreground">
            :{cell.name.slice(0, 2)}:
          </span>
        )
      ) : (
        <span className="relative grid h-8 w-8 place-items-center">
          <FluentEmoji glyph={cell.char} size={28} />
          <span className="chat-dock-emoji__fallback">{cell.char}</span>
        </span>
      )}
    </button>
  );
});

const MediaButton = memo(function MediaButton({
  cell,
  onPick,
  onFavorite,
}: {
  cell: Extract<PanelCell, { kind: "gif" | "sticker" }>;
  onPick: (marker: string) => void;
  onFavorite: (marker: string) => void;
}) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };
  useEffect(() => clear, []);
  return (
    <button
      type="button"
      className="chat-dock-media"
      aria-label={cell.name}
      onPointerDown={(event) => {
        longPressed.current = false;
        clear();
        origin.current = { x: event.clientX, y: event.clientY };
        timer.current = window.setTimeout(() => {
          longPressed.current = true;
          onFavorite(cell.marker);
        }, 450);
      }}
      onPointerMove={(event) => {
        const start = origin.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(event) => {
        event.preventDefault();
        onFavorite(cell.marker);
      }}
      onClick={() => {
        clear();
        if (!longPressed.current) onPick(cell.marker);
        longPressed.current = false;
      }}
    >
      {cell.kind === "sticker" ? (
        <StickerMedia sticker={cell.sticker} />
      ) : (
        <img src={cell.url} alt="" loading="lazy" decoding="async" />
      )}
    </button>
  );
});

type GifResult = {
  id: string;
  title: string;
  images: { fixed_width: { url: string; width: string; height: string } };
};

const ChatDockPanelImpl = ({
  mode,
  tab,
  onTabChange,
  disabled = false,
  onPickEmoji,
  onSendMarker,
  onManageEmoji,
  recentPhotos = [],
  onPickRecentPhoto,
  onPhotos,
  onCamera,
  onFiles,
  onSchedule,
  onPoll,
  scheduleDisabled,
}: ChatDockPanelProps) => {
  const preferences = useEmojiPreferences();
  const { user } = useAuth();
  // GIFs are the one Purify-gated surface in this panel: emoji and stickers stay
  // free, so a member without Purify loses nothing they already had.
  const { allowed } = usePurify();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const term = deferredQuery.trim().toLowerCase();
  const [category, setCategory] = useState<Category | null>(null);
  // The emoji tab groups by emoji set (default, mine, each realm), never by
  // sticker feelings; those chips belong to GIFs and stickers only.
  const [emojiPack, setEmojiPack] = useState("default");
  // Horizontal swipe moves between the five tabs; the grids keep vertical scroll.
  const tabSwipe = useRef<{ x: number; y: number } | null>(null);
  const [pack, setPack] = useState<StickerPack>("noto");
  const [panelRecents, setPanelRecents] = useState<string[]>([]);
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState("");
  const gifKey = import.meta.env.VITE_GIPHY_API_KEY?.trim();

  useEffect(() => setPanelRecents(readPanelRecents()), []);
  useEffect(() => {
    if (mode !== "picker") return;
    setQuery("");
    setCategory(null);
  }, [mode, tab]);

  useEffect(() => {
    if (tab !== "stickers") return;
    preloadStickerPack(pack);
  }, [pack, tab]);

  const gifTerm = term || (tab === "gifs" && category ? CATEGORY_TAGS[category][0] : "");

  useEffect(() => {
    if (mode !== "picker" || tab !== "gifs") return;
    if (!gifKey) {
      setGifs([]);
      setGifLoading(false);
      setGifError("GIFs need VITE_GIPHY_API_KEY.");
      return;
    }
    setGifLoading(true);
    setGifError("");
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const endpoint = gifTerm
          ? "https://api.giphy.com/v1/gifs/search"
          : "https://api.giphy.com/v1/gifs/trending";
        const params = new URLSearchParams({
          api_key: gifKey,
          limit: "32",
          rating: "pg-13",
          ...(gifTerm ? { q: gifTerm } : {}),
        });
        const response = await fetch(`${endpoint}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("GIFs unavailable");
        const payload = await response.json();
        setGifs((payload.data ?? []).filter((gif: GifResult) => gif.images?.fixed_width?.url));
      } catch {
        if (controller.signal.aborted) return;
        setGifs([]);
        setGifError("Couldn't load GIFs.");
      } finally {
        if (!controller.signal.aborted) setGifLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [gifKey, mode, tab, gifTerm]);

  // Recents and favorites can hold any realm token, so the lookup is fetched
  // whenever the panel opens rather than only on the Emoji tab.
  const available = useAvailableEmojis(true);
  const realmEmojiUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const emoji of available.data?.private ?? []) map.set(emoji.id, emoji.url);
    for (const realm of available.data?.realms ?? []) {
      for (const emoji of realm.emojis) map.set(emoji.id, emoji.url);
    }
    return map;
  }, [available.data]);

  const emojiPacks = useMemo(() => {
    const packs: { id: string; label: string }[] = [
      { id: "recent", label: "Recent" },
      { id: "favorites", label: "Favourites" },
      { id: "default", label: "Default" },
    ];
    if ((available.data?.private ?? []).length > 0) packs.push({ id: "mine", label: "Mine" });
    for (const realm of available.data?.realms ?? []) {
      const row = realm as { id: string; name?: string | null; emojis?: unknown[] };
      if ((row.emojis ?? []).length > 0) packs.push({ id: `realm:${row.id}`, label: row.name ?? "Realm" });
    }
    return packs;
  }, [available.data]);

  const emojiCells = useMemo<PanelCell[]>(() => {
    let smileys = emojiPack === "default" ? (term ? searchSmileys(term) : SMILEY_EMOJI) : [];
    const cells: PanelCell[] = smileys.map((smiley) => ({
      kind: "emoji",
      key: `u:${smiley.char}`,
      token: smiley.char,
      name: smiley.name,
      char: smiley.char,
    }));
    for (const emoji of available.data?.private ?? []) {
      if (emojiPack !== "mine") continue;
      if (term && !emoji.name.toLowerCase().includes(term)) continue;
      cells.push({
        kind: "realm",
        key: `p:${emoji.id}`,
        token: `<:${emoji.name}:${emoji.id}>`,
        name: emoji.name,
        url: emoji.url,
      });
    }
    for (const realm of available.data?.realms ?? []) {
      if (emojiPack !== `realm:${realm.id}`) continue;
      for (const emoji of realm.emojis) {
        if (term && !emoji.name.toLowerCase().includes(term)) continue;
        cells.push({
          kind: "realm",
          key: `r:${emoji.id}`,
          token: `<:${emoji.name}:${emoji.id}>`,
          name: emoji.name,
          url: emoji.url,
        });
      }
    }
    return cells;
  }, [available.data, emojiPack, term]);

  const stickerCells = useMemo<PanelCell[]>(
    () =>
      stickersForPack(pack)
        .filter((sticker) => {
          const haystack = `${sticker.label} ${pack}`.toLowerCase();
          if (category) {
            const tags = CATEGORY_TAGS[category];
            if (!tags.some((tag) => haystack.includes(tag))) return false;
          }
          return !term || haystack.includes(term);
        })
        .map((sticker) => ({
          kind: "sticker",
          key: `s:${sticker.id}`,
          marker: STICKER_MARKER(sticker.src),
          name: sticker.label,
          sticker,
        })),
    [pack, term],
  );

  const gifCells = useMemo<PanelCell[]>(
    () =>
      gifs.map((gif) => ({
        kind: "gif",
        key: `g:${gif.id}`,
        marker: GIF_MARKER(gif.images.fixed_width.url),
        name: gif.title || "GIF",
        url: gif.images.fixed_width.url,
      })),
    [gifs],
  );

  const favoriteTokens = preferences.favorites;
  const favoriteCells = useMemo(
    () => cellFromMarkers(favoriteTokens, realmEmojiUrls),
    [favoriteTokens, realmEmojiUrls],
  );
  const recentTokens = useMemo(
    () =>
      [...preferences.recents, ...panelRecents]
        .filter((value, index, list) => list.indexOf(value) === index)
        .slice(0, 32),
    [panelRecents, preferences.recents],
  );
  const recentCells = useMemo(
    () => cellFromMarkers(recentTokens, realmEmojiUrls),
    [recentTokens, realmEmojiUrls],
  );

  const remember = (value: string) => {
    setPanelRecents((current) => {
      const next = [value, ...current.filter((item) => item !== value)].slice(0, 48);
      writePanelRecents(next);
      return next;
    });
  };

  const pickEmoji = (token: string) => {
    recordEmojiUse(token);
    remember(token);
    onPickEmoji(token);
  };

  const sendMarker = (marker: string) => {
    remember(marker);
    onSendMarker(marker);
  };

  const favorite = (value: string) => {
    toggleEmojiFavorite(value);
    toast.success(
      preferences.favorites.includes(value) ? "Removed from favorites" : "Added to favorites",
    );
  };

  const pick = (value: string) => {
    if (value.startsWith("![") || value.startsWith("<:")) {
      if (value.startsWith("<:")) pickEmoji(value);
      else sendMarker(value);
    } else {
      pickEmoji(value);
    }
  };

  const hasEmojiShape = (cells: PanelCell[]) =>
    cells.some((cell) => cell.kind === "emoji" || cell.kind === "realm");
  const gridFor = (cells: PanelCell[]) => (
    <VirtualGrid
      key={`${tab}:${pack}:${term}:${category ?? "all"}`}
      items={cells}
      columns={hasEmojiShape(cells) ? 8 : 4}
      rowHeight={hasEmojiShape(cells) ? EMOJI_ROW_H : MEDIA_ROW_H}
      renderCell={(cell) => <DockCell cell={cell} onPick={pick} onFavorite={favorite} />}
    />
  );

  return (
    <div
      className="chat-dock-panel flex h-full min-h-0 flex-col"
      aria-label={mode === "attach" ? "Attach" : "Emoji, GIFs and stickers"}
    >
      {mode === "picker" ? (
        <>
          <div className="flex shrink-0 items-center gap-2 px-2.5 pb-1.5 pt-2">
            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-secondary px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  tab === "gifs"
                    ? "Search GIFs"
                    : tab === "stickers"
                      ? "Search stickers"
                      : "Search emoji"
                }
                className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
                aria-label="Search emoji and stickers"
              />
            </label>
            {onManageEmoji && tab === "emoji" ? (
              <button
                type="button"
                onClick={onManageEmoji}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                aria-label="Manage emoji"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {tab === "emoji" && emojiPacks.length > 1 ? (
            <div className="chat-dock-chips shrink-0">
              {emojiPacks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setEmojiPack(item.id)}
                  className={cn("chat-dock-chip", emojiPack === item.id && "is-active")}
                >
                  {item.label}
                </button>
              ))}
              {onManageEmoji && (
                <button
                  type="button"
                  onClick={onManageEmoji}
                  className="chat-dock-chip"
                  aria-label="Add your own emoji"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
                </button>
              )}
            </div>
          ) : tab === "stickers" ? (
            <div className="chat-dock-chips shrink-0">
              {STICKER_PACKS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPack(item.id)}
                  className={cn("chat-dock-chip", pack === item.id && "is-active")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : tab === "gifs" ? (
            <div className="chat-dock-chips shrink-0">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory((current) => (current === item ? null : item))}
                  className={cn("chat-dock-chip", category === item && "is-active")}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "attach" ? (
        <RizzLibrarySheet
          userId={user?.id ?? null}
          recentPhotos={recentPhotos}
          onPickPhoto={(url) => onPickRecentPhoto?.(url)}
          onPhotos={onPhotos}
          onCamera={onCamera}
          onFiles={onFiles}
          onPoll={onPoll}
          onSchedule={onSchedule}
          scheduleDisabled={scheduleDisabled}
          disabled={disabled}
        />
      ) : (
        <>
          <div
            className="relative min-h-0 flex-1 overflow-hidden"
            onTouchStart={(event) => {
              const touch = event.touches[0];
              tabSwipe.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
            }}
            onTouchEnd={(event) => {
              const start = tabSwipe.current;
              tabSwipe.current = null;
              const touch = event.changedTouches[0];
              if (!start || !touch) return;
              const dx = touch.clientX - start.x;
              const dy = touch.clientY - start.y;
              if (Math.abs(dx) < 56 || Math.abs(dy) > Math.abs(dx)) return;
              const index = TABS.findIndex((item) => item.id === tab);
              if (index < 0) return;
              const next = TABS[(index + (dx < 0 ? 1 : TABS.length - 1)) % TABS.length];
              if (next && next.id !== tab) onTabChange(next.id);
            }}
          >
            {tab === "gifs" && (!allowed ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="text-[13px] font-semibold text-foreground">GIFs come with Purify</p>
                  <p className="text-[11.5px] leading-snug text-muted-foreground">
                    Emoji and stickers are always free. Purify unlocks the GIF search and bigger
                    uploads.
                  </p>
                  <button
                    type="button"
                    onClick={() => openPurifyPaywall("GIFs")}
                    className="mt-1 h-11 rounded-full bg-primary px-4 text-[12.5px] font-bold text-primary-foreground"
                  >
                    See Purify
                  </button>
                </div>
              ) : gifLoading ? (
                <div className="grid h-full place-items-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : gifError ? (
                <PanelEmpty
                  icon={<ImageIcon className="h-5 w-5" />}
                  title="GIFs unavailable"
                  hint={gifError}
                />
              ) : gifCells.length ? (
                gridFor(gifCells)
              ) : (
                <PanelEmpty
                  icon={<ImageIcon className="h-5 w-5" />}
                  title="No GIFs found"
                  hint="Try another search."
                />
              ))}
            {tab !== "gifs" &&
              (tab === "recent" ? (
                recentCells.length ? (
                  gridFor(recentCells)
                ) : (
                  <PanelEmpty
                    icon={<Clock3 className="h-5 w-5" />}
                    title="Nothing recent yet"
                    hint="Emoji and stickers you pick show up here."
                  />
                )
              ) : tab === "favorites" ? (
                favoriteCells.length ? (
                  gridFor(favoriteCells)
                ) : (
                  <PanelEmpty
                    icon={<Heart className="h-5 w-5" />}
                    title="No favorites yet"
                    hint="Hold an emoji or sticker to save it."
                  />
                )
              ) : tab === "stickers" ? (
                stickerCells.length ? (
                  gridFor(stickerCells)
                ) : (
                  <PanelEmpty
                    icon={<StickerIcon className="h-5 w-5" />}
                    title="No stickers in this pack"
                    hint="Try another pack above."
                  />
                )
              ) : (
                gridFor(
                  tab === "emoji" && emojiPack === "recent"
                    ? recentCells.filter((cell) => cell.kind === "emoji" || cell.kind === "realm")
                    : tab === "emoji" && emojiPack === "favorites"
                      ? favoriteCells.filter((cell) => cell.kind === "emoji" || cell.kind === "realm")
                      : emojiCells,
                )
              ))}
          </div>
          <div className="relative z-10 grid shrink-0 grid-cols-5 gap-0.5 border-t border-border bg-background px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={cn("chat-dock-tab", active && "is-active")}
                  aria-label={item.label}
                  aria-pressed={active}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 1.9} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

function DockCell({
  cell,
  onPick,
  onFavorite,
}: {
  cell: PanelCell;
  onPick: (value: string) => void;
  onFavorite: (value: string) => void;
}) {
  if (cell.kind === "emoji" || cell.kind === "realm") {
    return <EmojiButton cell={cell} onPick={onPick} onFavorite={onFavorite} />;
  }
  return <MediaButton cell={cell} onPick={onPick} onFavorite={onFavorite} />;
}


function PanelEmpty({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-secondary text-muted-foreground">
          {icon}
        </span>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function cellFromMarkers(values: string[], realmEmojiUrls?: Map<string, string>): PanelCell[] {
  const out: PanelCell[] = [];
  for (const value of values) {
    if (value.startsWith("![sticker](")) {
      const url = value.slice(11, -1);
      out.push({
        kind: "sticker",
        key: `st:${url}`,
        marker: value,
        name: "Sticker",
        sticker: {
          id: url,
          pack: "noto",
          label: "Sticker",
          src: url,
          animated: /\.(webm|mp4)(\?|#|$)/i.test(url),
        },
      });
    } else if (value.startsWith("![gif](")) {
      const url = value.slice(7, -1);
      out.push({ kind: "gif", key: `g:${url}`, marker: value, name: "GIF", url });
    } else if (value.startsWith("<:")) {
      const match = /^<:([^:]+):([^>]+)>$/.exec(value);
      if (match) {
        out.push({
          kind: "realm",
          key: `r:${match[2]}`,
          token: value,
          name: match[1],
          url: realmEmojiUrls?.get(match[2]) ?? "",
        });
      }
    } else if (isSingleEmoji(value)) {
      out.push({ kind: "emoji", key: `e:${value}`, token: value, name: value, char: value });
    }
  }
  return out;
}

export const ChatDockPanel = memo(ChatDockPanelImpl);
export default ChatDockPanel;
