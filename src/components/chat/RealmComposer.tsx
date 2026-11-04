import { useEffect, useMemo, useState } from "react";
import { Image, Loader2, Search, Smile, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { PURIFY_PRICE_LABEL, usePurify } from "@/lib/purify";
import { rememberEmojiPick, RizzEmojiPanel } from "@/components/emoji/RizzEmojiPanel";
import { useStickyPickerHeight } from "@/lib/picker-keyboard-height";
import { cn } from "@/lib/utils";

/**
 * The composer's media picker.
 *
 * One sheet, three tabs. The header is a pill segmented control whose active
 * indicator slides (a transform, not a re-layout), one search field serves all
 * three tabs, and the emoji tab is the realm-aware `RizzEmojiPanel` with its own
 * section rail. GIFs and stickers keep the behaviour they always had.
 *
 * The trigger is unchanged, so every composer that already mounts this picker
 * keeps its exact row: only the panel behind it was rebuilt.
 */

type GifResult = {
  id: string;
  title: string;
  images: { fixed_width: { url: string; width: string; height: string } };
};

type Sticker = {
  id: string;
  pack: "noto" | "black-cat" | "kotya";
  label: string;
  src: string;
  poster?: string;
  animated: boolean;
};

type PickerTab = "emoji" | "gifs" | "stickers";

const TABS: Array<{ id: PickerTab; label: string; icon: typeof Smile }> = [
  { id: "emoji", label: "Emoji", icon: Smile },
  { id: "gifs", label: "GIFs", icon: Image },
  { id: "stickers", label: "Stickers", icon: Sparkles },
];

const GIF_MARKER = (url: string) => `![gif](${url})`;
const STICKER_MARKER = (url: string) => `![sticker](${url})`;
const STICKER_PACKS: { id: Sticker["pack"]; label: string }[] = [
  { id: "noto", label: "Noto" },
  { id: "black-cat", label: "Black cat" },
  { id: "kotya", label: "Kotya HD" },
];

const SEARCH_PLACEHOLDER: Record<PickerTab, string> = {
  emoji: "Find the perfect emoji",
  gifs: "Search GIFs",
  stickers: "Search this pack",
};

export function GifPicker({
  onSelect,
  realmId,
  realmName,
  onCustomEmoji,
  triggerClassName,
}: {
  onSelect: (marker: string) => void;
  /** A realm passes its id so its own emoji show up in this picker. */
  realmId?: string;
  realmName?: string;
  /** Opens the realm's emoji manager (add, upload, remove) for moderators. */
  onCustomEmoji?: () => void;
  /** Match the trigger to the composer it sits in (a 44px row, a 36px row). */
  triggerClassName?: string;
}) {
  // GIFs are a Purify feature; emoji and stickers stay free for everyone.
  const { allowed } = usePurify();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>("emoji");
  const [query, setQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedPack, setSelectedPack] = useState<Sticker["pack"]>("noto");
  const [visibleCount, setVisibleCount] = useState(36);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiKey = import.meta.env.VITE_GIPHY_API_KEY?.trim();
  const pickerHeight = useStickyPickerHeight();
  // Tab changes animate; the tablist measures its own width once per open.
  const indicatorIndex = Math.max(0, TABS.findIndex((entry) => entry.id === tab));

  useEffect(() => {
    if (!open || stickers.length) return;
    let cancelled = false;
    fetch("/stickers/manifest.json")
      .then((response) => {
        if (!response.ok) throw new Error("Sticker packs could not be loaded.");
        return response.json() as Promise<Sticker[]>;
      })
      .then((items) => {
        if (!cancelled) setStickers(items);
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Sticker packs could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, stickers.length]);

  useEffect(() => {
    if (!open || tab !== "gifs" || !apiKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const endpoint = query.trim()
          ? "https://api.giphy.com/v1/gifs/search"
          : "https://api.giphy.com/v1/gifs/trending";
        const params = new URLSearchParams({
          api_key: apiKey,
          limit: "18",
          rating: "pg-13",
          ...(query.trim() ? { q: query.trim() } : {}),
        });
        const response = await fetch(`${endpoint}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("GIPHY search is unavailable. Please try again.");
        const payload = await response.json();
        setGifResults(
          (payload.data ?? []).filter((gif: GifResult) => gif.images?.fixed_width?.url),
        );
      } catch (cause) {
        if (controller.signal.aborted) return;
        setGifResults([]);
        setError(cause instanceof Error ? cause.message : "Couldn't load GIFs.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, open, query, tab]);

  const filteredStickers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return stickers
      .filter((sticker) => sticker.pack === selectedPack)
      .filter(
        (sticker) => !term || `${sticker.label} ${selectedPack}`.toLowerCase().includes(term),
      );
  }, [query, selectedPack, stickers]);

  const changeTab = (next: PickerTab) => {
    setTab(next);
    setQuery("");
    setError("");
    setVisibleCount(36);
  };

  const pickEmoji = (token: string, emoji: Parameters<typeof rememberEmojiPick>[0]) => {
    // The picker stays open: a message is usually a few emoji, not one.
    onSelect(token);
    rememberEmojiPick(emoji, realmId);
  };

  const closeAnd = (marker: string) => {
    onSelect(marker);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("emoji_picker")}
          title={t("emoji_picker")}
          className={`shrink-0 text-primary ${triggerClassName ?? ""}`}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        data-picker="rizz"
        // Same height as the last keyboard, so swapping the picker in does not
        // move the composer or the message list.
        style={{ height: `min(${pickerHeight}px, 82dvh)` }}
        className="rizz-picker glass-strong flex flex-col gap-0 overflow-hidden rounded-t-3xl border-white/10 p-0 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Emoji, GIFs and stickers</SheetTitle>
        <div className="rizz-picker__handle" aria-hidden="true">
          <span />
        </div>

        <div className="rizz-picker__head">
          <div className="rizz-seg" role="tablist" aria-label="Media type">
            <span
              aria-hidden="true"
              className="rizz-seg__indicator"
              style={{
                width: `${100 / TABS.length}%`,
                transform: `translateX(${indicatorIndex * 100}%)`,
              }}
            />
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => changeTab(id)}
                className={cn("rizz-seg__btn", tab === id && "rizz-seg__btn--active")}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <div className="rizz-search">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(36);
              }}
              placeholder={SEARCH_PLACEHOLDER[tab]}
              aria-label={`Search ${tab === "gifs" ? "GIFs" : tab}`}
              enterKeyHint="search"
              className="rizz-search__input"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="rizz-search__clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {tab === "emoji" && (
          <RizzEmojiPanel
            open={open}
            realmId={realmId}
            realmName={realmName}
            query={query}
            onPick={pickEmoji}
            onManage={
              onCustomEmoji
                ? () => {
                    setOpen(false);
                    // Let the sheet's exit animation start before a dialog opens.
                    window.setTimeout(onCustomEmoji, 90);
                  }
                : undefined
            }
            className="rizz-picker__body"
          />
        )}

        {tab === "gifs" && (
          <div className="rizz-picker__body overflow-y-auto overscroll-contain px-3 pb-4">
            {!allowed ? (
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-8 text-center">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
                <p className="text-sm font-semibold">GIFs come with Purify</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Emoji and sticker packs stay free. Unlock GIFs for {PURIFY_PRICE_LABEL}.
                </p>
                <Link
                  to="/purify"
                  className="mt-3 inline-flex min-h-9 items-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
                >
                  Get Purify
                </Link>
              </div>
            ) : !apiKey ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                <Image className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-semibold">Search GIFs</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Add VITE_GIPHY_API_KEY to your app environment to browse trending GIFs. Your
                  sticker packs work without it.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {loading && (
                    <div className="col-span-3 flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!loading &&
                    gifResults.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        onClick={() => closeAnd(GIF_MARKER(gif.images.fixed_width.url))}
                        className="overflow-hidden rounded-lg bg-black/20 transition-transform duration-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Add GIF: ${gif.title || "animated GIF"}`}
                      >
                        <img
                          src={gif.images.fixed_width.url}
                          alt={gif.title || "GIF"}
                          width={Number(gif.images.fixed_width.width) || 200}
                          height={Number(gif.images.fixed_width.height) || 112}
                          loading="lazy"
                          decoding="async"
                          className="aspect-video h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  {!loading && !error && !gifResults.length && (
                    <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">
                      No GIFs found. Try another search.
                    </p>
                  )}
                  {error && (
                    <p role="status" className="col-span-3 py-5 text-center text-sm text-destructive">
                      {error}
                    </p>
                  )}
                </div>
                <a
                  href="https://giphy.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-right text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Powered by GIPHY
                </a>
              </>
            )}
          </div>
        )}

        {tab === "stickers" && (
          <div className="rizz-picker__body overflow-y-auto overscroll-contain px-3 pb-4">
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1" aria-label="Sticker packs">
              {STICKER_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  aria-pressed={selectedPack === pack.id}
                  onClick={() => {
                    setSelectedPack(pack.id);
                    setVisibleCount(36);
                    setQuery("");
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    selectedPack === pack.id
                      ? "border-primary/50 bg-primary/15 text-foreground"
                      : "border-white/10 text-muted-foreground hover:bg-white/5",
                  )}
                >
                  {pack.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/10 p-1 sm:grid-cols-5">
              {stickers.length > 0 &&
                filteredStickers.slice(0, visibleCount).map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => closeAnd(STICKER_MARKER(sticker.src))}
                    className="group grid aspect-square place-items-center overflow-hidden rounded-xl p-1 transition-transform duration-100 hover:scale-105 hover:bg-white/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Add ${sticker.label}`}
                    title={sticker.label}
                  >
                    {sticker.animated ? (
                      <video
                        src={sticker.src}
                        poster={sticker.poster}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="none"
                        aria-label={sticker.label}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <img
                        src={sticker.src}
                        alt={sticker.label}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                      />
                    )}
                  </button>
                ))}
              {!stickers.length && !error && (
                <div className="col-span-4 flex justify-center py-10 sm:col-span-5">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!!stickers.length && !filteredStickers.length && (
                <p className="col-span-4 py-8 text-center text-sm text-muted-foreground sm:col-span-5">
                  No stickers found.
                </p>
              )}
              {error && (
                <p role="status" className="col-span-4 py-8 text-center text-sm text-destructive sm:col-span-5">
                  {error}
                </p>
              )}
            </div>
            {filteredStickers.length > visibleCount && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 w-full text-xs"
                onClick={() => setVisibleCount((count) => count + 36)}
              >
                Show more stickers
              </Button>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">
              {filteredStickers.length} {filteredStickers.length === 1 ? "sticker" : "stickers"} ·{" "}
              {STICKER_PACKS.find((pack) => pack.id === selectedPack)?.label}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
