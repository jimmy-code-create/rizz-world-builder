import { useEffect, useMemo, useState } from "react";
import { Image, Loader2, Search, Smile, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { PURIFY_PRICE_LABEL, usePurify } from "@/lib/purify";
import { RizzEmojiPanel } from "@/components/emoji/RizzEmojiPanel";
import { useStickyPickerHeight } from "@/lib/picker-keyboard-height";
import { cn } from "@/lib/utils";

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
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  hideTrigger = false,
  initialTab = "emoji",
}: {
  onSelect: (marker: string) => void;
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
  const [query, setQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedPack, setSelectedPack] = useState<Sticker["pack"]>("noto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiKey = import.meta.env.VITE_GIPHY_API_KEY?.trim();
  const pickerHeight = useStickyPickerHeight();

  useEffect(() => {
    if (!open || stickers.length) return;
    let cancelled = false;
    fetch("/stickers/manifest.json")
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => {
        if (!cancelled) setStickers(items as Sticker[]);
      })
      .catch(() => {});
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
        const res = await fetch(`${endpoint}?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("GIPHY search is unavailable.");
        const payload = await res.json();
        setGifResults((payload.data ?? []).filter((g: GifResult) => g.images?.fixed_width?.url));
      } catch (cause) {
        if (controller.signal.aborted) return;
        setGifResults([]);
        setError("Couldn't load GIFs.");
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
      .filter((s) => s.pack === selectedPack)
      .filter((s) => !term || `${s.label} ${selectedPack}`.toLowerCase().includes(term));
  }, [query, selectedPack, stickers]);

  const closeAnd = (marker: string) => {
    onSelect(marker);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("emoji_picker")}
            className={cn("shrink-0 text-primary", triggerClassName)}
          >
            <Smile className="h-5 w-5" />
          </Button>
        </SheetTrigger>
      )}
      <SheetContent
        side="bottom"
        style={{ height: `min(${pickerHeight}px, 80dvh)` }}
        className="glass-strong flex flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#121212]/95 p-0 backdrop-blur-xl [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Emoji, GIFs and stickers</SheetTitle>

        {/* Drag handle */}
        <div className="flex justify-center py-2">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Pill Tabs Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-1">
          <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                  tab === id
                    ? "bg-primary font-semibold text-black shadow-sm"
                    : "text-muted-foreground hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Contents */}
        {tab === "emoji" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <RizzEmojiPanel
              realmId={realmId}
              realmName={realmName}
              onEmoji={(char) => closeAnd(char)}
              onPick={(token) => closeAnd(token)}
              onClose={() => setOpen(false)}
              onManage={onCustomEmoji}
            />
          </div>
        ) : tab === "gifs" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search GIFs"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            {!allowed ? (
              <div className="my-auto flex flex-col items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
                <Sparkles className="mb-2 h-7 w-7 text-primary" />
                <p className="text-sm font-semibold text-white">GIFs require Purify</p>
                <p className="mt-1 text-xs text-muted-foreground">Unlock unlimited GIFs and premium perks</p>
                <Link
                  to="/purify"
                  className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-black"
                >
                  Get Purify • {PURIFY_PRICE_LABEL}
                </Link>
              </div>
            ) : loading ? (
              <div className="flex flex-1 items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gifResults.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => closeAnd(GIF_MARKER(gif.images.fixed_width.url))}
                    className="overflow-hidden rounded-xl border border-white/10 transition-transform active:scale-95"
                  >
                    <img
                      src={gif.images.fixed_width.url}
                      alt={gif.title}
                      className="h-28 w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3">
            {/* Sticker Pack selector */}
            <div className="mb-3 flex gap-1.5">
              {STICKER_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPack(pack.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selectedPack === pack.id
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-muted-foreground hover:text-white",
                  )}
                >
                  {pack.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {filteredStickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => closeAnd(STICKER_MARKER(sticker.src))}
                  className="flex aspect-square items-center justify-center rounded-xl border border-white/5 bg-white/5 p-2 transition-transform hover:scale-110 active:scale-95"
                >
                  <img src={sticker.src} alt={sticker.label} className="h-14 w-14 object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
