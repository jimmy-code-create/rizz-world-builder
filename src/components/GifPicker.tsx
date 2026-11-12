import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type UIEvent as ReactUIEvent,
} from "react";
import { Image as ImageIcon, Loader2, Search, Smile, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { PURIFY_PRICE_LABEL, usePurify } from "@/lib/purify";
import { StickerMedia } from "@/components/chat/StickerMedia";
import {
  STICKER_PACKS,
  preloadStickerPack,
  stickersForPack,
  type Sticker,
  type StickerPack,
} from "@/lib/stickers";
import { cn } from "@/lib/utils";
import "./emoji/picker.css";

// The Unicode catalogue is ~750 entries and only the emoji tab needs it. Loading
// it with the composer put that parse on every chat screen; warming the chunk
// while the app is idle keeps the first open instant without paying for it up
// front.
const loadEmojiPanel = () => import("@/components/emoji/RizzEmojiPanel");
const RizzEmojiPanel = lazy(() =>
  loadEmojiPanel().then((module) => ({ default: module.RizzEmojiPanel })),
);

function EmojiPanelSkeleton() {
  return (
    <div className="grid grid-cols-8 gap-0 px-2 pt-3" aria-label="Loading emoji">
      {Array.from({ length: 48 }, (_, index) => (
        <div key={index} className="grid h-10 place-items-center">
          <span className="h-6 w-6 rounded-full bg-white/[0.055]" />
        </div>
      ))}
    </div>
  );
}

type GifResult = {
  id: string;
  title: string;
  images: { fixed_width: { url: string; width: string; height: string } };
};

type PickerTab = "emoji" | "gifs" | "stickers";
type SnapPoint = "half" | "full";

const TABS: Array<{ id: PickerTab; label: string; icon: typeof Smile }> = [
  { id: "emoji", label: "Emoji", icon: Smile },
  { id: "gifs", label: "GIFs", icon: ImageIcon },
  { id: "stickers", label: "Stickers", icon: Sparkles },
];

const GIF_MARKER = (url: string) => `![gif](${url})`;
const STICKER_MARKER = (url: string) => `![sticker](${url})`;

const SEARCH_PLACEHOLDER: Record<PickerTab, string> = {
  emoji: "Find the perfect emoji",
  gifs: "Search GIFs",
  stickers: "Search this pack",
};

const STICKER_ROW_HEIGHT = 108;
const STICKER_OVERSCAN = 3;

function chunk<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function PackIcon({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/[0.06] text-[10px] font-bold uppercase text-muted-foreground">
        {label.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="rizz-sticker-pack__icon"
    />
  );
}

function GifTile({ gif, onPick }: { gif: GifResult; onPick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onPick}
      className="rizz-gif-tile relative aspect-[4/3] transition-transform active:scale-95"
      aria-label={gif.title || "GIF"}
    >
      {failed ? (
        <span className="grid h-full w-full place-items-center text-muted-foreground">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : (
        <img
          src={gif.images.fixed_width.url}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </button>
  );
}

/**
 * The composer's emoji / GIF / sticker sheet.
 *
 * The sheet starts full-height and can be dragged to half or closed from the
 * handle. Only the handle captures the gesture, so the grids below keep their
 * native momentum scrolling. Tabs slide a single lime pill; each tab remembers
 * its own search and scroll position.
 */
export function GifPicker({
  onSelect,
  realmId,
  realmName,
  onCustomEmoji,
  triggerClassName,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  hideTrigger = false,
  initialTab = "emoji",
  keepOpenOnPick = false,
}: {
  onSelect: (marker: string) => void;
  /**
   * Chat composers insert at the caret and want the sheet to stay up, the way
   * Discord does, so several emoji can be added without reopening it. A post
   * composer that appends to its text keeps the old close-on-pick behaviour.
   */
  keepOpenOnPick?: boolean;
  realmId?: string;
  realmName?: string;
  onCustomEmoji?: () => void;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  initialTab?: PickerTab;
}) {
  const { allowed } = usePurify();
  const { t } = useI18n();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (setControlledOpen ?? (() => {})) : setInternalOpen;

  const [tab, setTab] = useState<PickerTab>(initialTab);

  const [queries, setQueries] = useState<Record<PickerTab, string>>({
    emoji: "",
    gifs: "",
    stickers: "",
  });
  const query = queries[tab];
  const setQuery = (next: string) => setQueries((current) => ({ ...current, [tab]: next }));

  const [snap, setSnap] = useState<SnapPoint>("full");
  // The drag offset is written straight to the sheet element instead of state:
  // a React render per pointermove is what made the sheet feel sticky on a
  // phone. Only the start and the end of a drag touch React.
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startY: number; startSnap: SnapPoint } | null>(null);
  const dragYRef = useRef(0);
  const dragFrame = useRef(0);

  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState("");
  const [gifAttempt, setGifAttempt] = useState(0);
  const apiKey = import.meta.env.VITE_GIPHY_API_KEY?.trim();

  const [selectedPack, setSelectedPack] = useState<StickerPack>("noto");
  const [listView, setListView] = useState({ top: 0, height: 480 });
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listFrame = useRef(0);
  // Horizontal swipe between Emoji / GIFs / Stickers. Only a clear sideways
  // gesture counts: a vertical drag still belongs to the list underneath.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const scrollPositions = useRef<Record<PickerTab, number>>({
    emoji: 0,
    gifs: 0,
    stickers: 0,
  });

  const tabIndex = Math.max(
    0,
    TABS.findIndex((item) => item.id === tab),
  );

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setSnap("full");
    dragYRef.current = 0;
    setDragging(false);
    if (sheetRef.current) sheetRef.current.style.transform = "";
  }, [initialTab, open]);

  useEffect(() => {
    let cancelled = false;
    const warm = () => {
      if (!cancelled) void loadEmojiPanel();
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 2200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const timer = window.setTimeout(warm, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!open || tab !== "stickers") return;
    preloadStickerPack(selectedPack);
  }, [open, selectedPack, tab]);

  useEffect(() => {
    if (!open || tab !== "gifs" || !apiKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setGifLoading(true);
      setGifError("");
      try {
        const endpoint = query.trim()
          ? "https://api.giphy.com/v1/gifs/search"
          : "https://api.giphy.com/v1/gifs/trending";
        const params = new URLSearchParams({
          api_key: apiKey,
          limit: "24",
          rating: "pg-13",
          ...(query.trim() ? { q: query.trim() } : {}),
        });
        const res = await fetch(`${endpoint}?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("GIPHY search is unavailable.");
        const payload = await res.json();
        setGifResults(
          (payload.data ?? []).filter((gif: GifResult) => gif.images?.fixed_width?.url),
        );
      } catch (cause) {
        if (controller.signal.aborted) return;
        setGifResults([]);
        setGifError("Couldn't load GIFs.");
      } finally {
        if (!controller.signal.aborted) setGifLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, gifAttempt, open, query, tab]);

  const packStickers = useMemo(() => stickersForPack(selectedPack), [selectedPack]);
  const filteredStickers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return packStickers;
    return packStickers.filter((sticker) =>
      `${sticker.label} ${selectedPack}`.toLowerCase().includes(term),
    );
  }, [packStickers, query, selectedPack]);

  const stickerRows = useMemo(() => chunk(filteredStickers, 3), [filteredStickers]);
  const stickerTotal = stickerRows.length * STICKER_ROW_HEIGHT;

  const stickerStart = Math.max(
    0,
    Math.floor(listView.top / STICKER_ROW_HEIGHT) - STICKER_OVERSCAN,
  );
  const stickerEnd = Math.min(
    stickerRows.length - 1,
    Math.ceil((listView.top + listView.height) / STICKER_ROW_HEIGHT) + STICKER_OVERSCAN,
  );

  const saveScroll = useCallback((nextTab: PickerTab, value: number) => {
    scrollPositions.current[nextTab] = value;
  }, []);

  const handleListScroll = useCallback(
    (event: ReactUIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      saveScroll(tab, element.scrollTop);
      if (listFrame.current) return;
      listFrame.current = window.requestAnimationFrame(() => {
        listFrame.current = 0;
        const next = { top: element.scrollTop, height: element.clientHeight || 480 };
        setListView((current) =>
          current.top === next.top && current.height === next.height ? current : next,
        );
      });
    },
    [saveScroll, tab],
  );

  useLayoutEffect(() => {
    const element = listScrollRef.current;
    if (!element) return;
    element.scrollTop = scrollPositions.current[tab];
    setListView({ top: element.scrollTop, height: element.clientHeight || 480 });
  }, [tab, open]);

  useEffect(() => {
    if (tab === "emoji") return;
    const element = listScrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setListView((current) => {
        const next = { top: element.scrollTop, height: element.clientHeight || 480 };
        return current.top === next.top && current.height === next.height ? current : next;
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [tab]);

  const closeAnd = (marker: string) => {
    onSelect(marker);
    if (!keepOpenOnPick) setOpen(false);
  };

  const beginSwipe = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const endSwipe = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const index = TABS.findIndex((item) => item.id === tab);
    const next = TABS[Math.min(TABS.length - 1, Math.max(0, index + (dx < 0 ? 1 : -1)))];
    if (next && next.id !== tab) setTab(next.id);
  };

  const choosePack = (pack: StickerPack) => {
    setSelectedPack(pack);
    if (listScrollRef.current) {
      listScrollRef.current.scrollTop = 0;
      saveScroll("stickers", 0);
      setListView((current) => ({ ...current, top: 0 }));
    }
    preloadStickerPack(pack);
  };

  const paintDrag = (offset: number) => {
    const element = sheetRef.current;
    if (!element) return;
    // Trailing-edge frame throttle: at most one style write per painted frame.
    if (dragFrame.current) return;
    dragFrame.current = window.requestAnimationFrame(() => {
      dragFrame.current = 0;
      element.style.transform = offset > 0 ? `translateY(${offset}px)` : "";
    });
  };

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, startSnap: snap };
    dragYRef.current = 0;
    setDragging(true);
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const next = Math.max(0, event.clientY - dragRef.current.startY);
    dragYRef.current = next;
    paintDrag(next);
  };

  const finishDrag = () => {
    const started = dragRef.current;
    if (!started) return;
    dragRef.current = null;
    setDragging(false);
    const distance = dragYRef.current;
    const element = sheetRef.current;
    if (dragFrame.current) {
      window.cancelAnimationFrame(dragFrame.current);
      dragFrame.current = 0;
    }
    if (element) {
      // Hand the position back to CSS: the snap change animates from here.
      element.style.transform = "";
    }
    dragYRef.current = 0;

    if (distance > 140) {
      if (started.startSnap === "full") setSnap("half");
      else setOpen(false);
      return;
    }
    if (distance < -44 && started.startSnap === "half") setSnap("full");
  };

  const sheetStyle: CSSProperties = {
    height: snap === "full" ? "min(86dvh, 720px)" : "min(52dvh, 450px)",
    transition: dragging ? "none" : "height 180ms cubic-bezier(0.22, 1, 0.36, 1)",
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          dragYRef.current = 0;
          setDragging(false);
          if (sheetRef.current) sheetRef.current.style.transform = "";
        }
        setOpen(next);
      }}
    >
      {!hideTrigger && (
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("emoji_picker")}
            className={`shrink-0 text-primary ${triggerClassName ?? ""}`}
          >
            <Smile className="h-5 w-5" />
          </Button>
        </SheetTrigger>
      )}

      <SheetContent
        ref={sheetRef}
        side="bottom"
        hideClose
        style={sheetStyle}
        className="flex flex-col gap-0 overflow-hidden rounded-t-[26px] border-t border-white/[0.08] bg-[#0e0f10] p-0 shadow-[0_-18px_50px_-18px_rgba(0,0,0,0.8)]"
      >
        <SheetTitle className="sr-only">Emoji, GIFs and stickers</SheetTitle>

        <div
          className="sheet-drag-handle flex shrink-0 touch-none cursor-grab justify-center py-2.5 active:cursor-grabbing"
          role="slider"
          tabIndex={0}
          aria-label="Resize emoji picker"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={snap === "full" ? 1 : 0}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") setSnap("full");
            if (event.key === "ArrowDown") setSnap("half");
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-end gap-1 px-4">
          <div className="rizz-seg min-w-0 flex-1" role="tablist" aria-label="Picker tabs">
            <span
              className="rizz-seg__indicator"
              style={{ transform: `translateX(${tabIndex * 100}%)` }}
              aria-hidden="true"
            />
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className="rizz-seg__btn"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 px-4 py-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={SEARCH_PLACEHOLDER[tab]}
              aria-label={SEARCH_PLACEHOLDER[tab]}
              className="h-10 w-full rounded-[10px] border border-white/[0.08] bg-white/[0.04] pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-white/25"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div
          key={tab}
          className="rizz-tab flex min-h-0 flex-1 flex-col overflow-hidden"
          onTouchStart={beginSwipe}
          onTouchEnd={endSwipe}
          onTouchCancel={() => {
            swipeStart.current = null;
          }}
        >
          {tab === "emoji" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <Suspense fallback={<EmojiPanelSkeleton />}>
                <RizzEmojiPanel
                  realmId={realmId}
                  realmName={realmName}
                  query={query}
                  onQueryChange={setQuery}
                  onPick={(token) => closeAnd(token)}
                  onClose={() => setOpen(false)}
                  onManage={onCustomEmoji}
                  initialScrollTop={scrollPositions.current.emoji}
                  onScrollTopChange={(value) => saveScroll("emoji", value)}
                />
              </Suspense>
            </div>
          ) : tab === "gifs" ? (
            <div
              ref={listScrollRef}
              className="rizz-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-2"
              onScroll={handleListScroll}
            >
              {!allowed ? (
                <div className="my-auto flex flex-col items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
                  <Sparkles className="mb-2 h-7 w-7 text-primary" />
                  <p className="text-sm font-semibold text-foreground">GIFs require Purify</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unlock unlimited GIFs and premium perks
                  </p>
                  <Link
                    to="/purify"
                    className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    Get Purify • {PURIFY_PRICE_LABEL}
                  </Link>
                </div>
              ) : !apiKey ? (
                <div className="my-auto px-6 py-10 text-center text-sm text-muted-foreground">
                  GIF search isn't configured on this build.
                </div>
              ) : gifLoading ? (
                <div className="grid grid-cols-2 gap-2" aria-label="Loading GIFs">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div
                      key={index}
                      className="sticker-shimmer aspect-[4/3] rounded-xl border border-white/5"
                    />
                  ))}
                </div>
              ) : gifError ? (
                <div className="my-auto flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <p className="text-sm text-muted-foreground">{gifError}</p>
                  <button
                    type="button"
                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                    onClick={() => setGifAttempt((attempt) => attempt + 1)}
                  >
                    Try again
                  </button>
                </div>
              ) : gifResults.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {gifResults.map((gif) => (
                    <GifTile
                      key={gif.id}
                      gif={gif}
                      onPick={() => closeAnd(GIF_MARKER(gif.images.fixed_width.url))}
                    />
                  ))}
                </div>
              ) : (
                <div className="my-auto px-6 py-10 text-center text-sm text-muted-foreground">
                  No GIFs found.
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {STICKER_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => choosePack(pack.id)}
                    className={cn(
                      "rizz-sticker-pack",
                      selectedPack === pack.id && "rizz-sticker-pack--active",
                    )}
                    aria-pressed={selectedPack === pack.id}
                  >
                    <PackIcon src={pack.icon} label={pack.label} />
                    <span>{pack.label}</span>
                  </button>
                ))}
              </div>

              <div
                ref={listScrollRef}
                className="rizz-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
                onScroll={handleListScroll}
              >
                {filteredStickers.length ? (
                  <div className="relative" style={{ height: stickerTotal }}>
                    {stickerRows.slice(stickerStart, stickerEnd + 1).map((row, rowOffset) => {
                      const rowIndex = stickerStart + rowOffset;
                      return (
                        <div
                          key={`${selectedPack}:${rowIndex}`}
                          className="absolute inset-x-0 top-0 grid grid-cols-3 gap-2"
                          style={{
                            height: STICKER_ROW_HEIGHT,
                            transform: `translateY(${rowIndex * STICKER_ROW_HEIGHT}px)`,
                          }}
                        >
                          {row.map((sticker) => (
                            <StickerTile
                              key={sticker.id}
                              sticker={sticker}
                              onPick={() => closeAnd(STICKER_MARKER(sticker.src))}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No stickers match that search.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StickerTile({ sticker, onPick }: { sticker: Sticker; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="sticker-card h-[100px] w-full"
      aria-label={sticker.label}
    >
      <StickerMedia sticker={sticker} />
    </button>
  );
}
