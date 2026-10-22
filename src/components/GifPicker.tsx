import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Loader2, Search, Smile, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { PURIFY_PRICE_LABEL, usePurify } from "@/lib/purify";

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
type EmojiEntry = { emoji: string; name: string; group: string };

const GIF_MARKER = (url: string) => `![gif](${url})`;
const STICKER_MARKER = (url: string) => `![sticker](${url})`;
const STICKER_PACKS: { id: Sticker["pack"]; label: string }[] = [
  { id: "noto", label: "Noto" },
  { id: "black-cat", label: "Black cat" },
  { id: "kotya", label: "Kotya HD" },
];

const EMOJIS: EmojiEntry[] = [
  ...[
    ["😀", "grinning"],
    ["😃", "smiling"],
    ["😄", "laughing"],
    ["😁", "beaming"],
    ["😆", "squinting laugh"],
    ["😅", "sweat smile"],
    ["😂", "tears of joy"],
    ["🤣", "rolling laugh"],
    ["🥹", "holding back tears"],
    ["😊", "blush"],
    ["😇", "halo"],
    ["🙂", "slight smile"],
    ["🙃", "upside down"],
    ["😉", "wink"],
    ["😍", "heart eyes"],
    ["🥰", "hearts"],
    ["😘", "kiss"],
    ["😗", "kissing"],
    ["😋", "yum"],
    ["😛", "tongue"],
    ["😜", "wink tongue"],
    ["🤪", "silly"],
    ["😎", "cool"],
    ["🤓", "nerd"],
    ["🧐", "monocle"],
    ["🤔", "thinking"],
    ["🫡", "salute"],
    ["🤭", "gasp"],
    ["🤫", "shush"],
    ["🤗", "hug"],
    ["🫠", "melting"],
    ["😶", "speechless"],
    ["😏", "smirk"],
    ["😴", "sleep"],
    ["🥳", "party"],
    ["😭", "crying"],
    ["😤", "steam"],
    ["😡", "angry"],
    ["🤯", "mind blown"],
    ["💀", "skull"],
    ["👻", "ghost"],
    ["🤖", "robot"],
    ["👀", "eyes"],
    ["✨", "sparkles"],
  ].map(([emoji, name]) => ({ emoji, name, group: "Faces" })),
  ...[
    ["👋", "wave"],
    ["🤚", "raised hand"],
    ["✋", "stop"],
    ["🖖", "vulcan"],
    ["👌", "ok"],
    ["🤌", "pinched fingers"],
    ["🤏", "pinch"],
    ["✌️", "peace"],
    ["🤞", "fingers crossed"],
    ["🫰", "finger heart"],
    ["🤟", "love you"],
    ["🤘", "rock"],
    ["🤙", "call me"],
    ["👈", "left"],
    ["👉", "right"],
    ["👆", "up"],
    ["👇", "down"],
    ["☝️", "point up"],
    ["👍", "thumbs up"],
    ["👎", "thumbs down"],
    ["✊", "fist"],
    ["👊", "punch"],
    ["👏", "clap"],
    ["🙌", "celebrate"],
    ["🫶", "heart hands"],
    ["🙏", "please"],
    ["💪", "strong"],
    ["🦾", "bionic arm"],
  ].map(([emoji, name]) => ({ emoji, name, group: "Hands" })),
  ...[
    ["❤️", "red heart"],
    ["🧡", "orange heart"],
    ["💛", "yellow heart"],
    ["💚", "green heart"],
    ["💙", "blue heart"],
    ["💜", "purple heart"],
    ["🖤", "black heart"],
    ["🤍", "white heart"],
    ["🩷", "pink heart"],
    ["🩵", "light blue heart"],
    ["🩶", "grey heart"],
    ["💔", "broken heart"],
    ["❤️‍🔥", "heart on fire"],
    ["💕", "two hearts"],
    ["💞", "revolving hearts"],
    ["💘", "cupid"],
    ["💖", "sparkling heart"],
    ["💗", "growing heart"],
    ["💓", "beating heart"],
    ["💯", "hundred"],
    ["🔥", "fire"],
    ["⭐", "star"],
    ["🌟", "glowing star"],
    ["💫", "dizzy"],
    ["🎉", "party popper"],
    ["🎊", "confetti"],
    ["🏆", "trophy"],
    ["👑", "crown"],
    ["💎", "gem"],
    ["🌈", "rainbow"],
  ].map(([emoji, name]) => ({ emoji, name, group: "Vibes" })),
  ...[
    ["🐱", "cat"],
    ["🐈", "cat"],
    ["🐈‍⬛", "black cat"],
    ["🐶", "dog"],
    ["🐻", "bear"],
    ["🐼", "panda"],
    ["🦊", "fox"],
    ["🐸", "frog"],
    ["🐵", "monkey"],
    ["🦋", "butterfly"],
    ["🐧", "penguin"],
    ["🦄", "unicorn"],
    ["🐢", "turtle"],
    ["🐬", "dolphin"],
    ["🐯", "tiger"],
    ["🌸", "flower"],
    ["🌻", "sunflower"],
    ["🌙", "moon"],
    ["☀️", "sun"],
    ["🍀", "clover"],
  ].map(([emoji, name]) => ({ emoji, name, group: "Nature" })),
  ...[
    ["🍕", "pizza"],
    ["🍔", "burger"],
    ["🍟", "fries"],
    ["🍩", "donut"],
    ["🍓", "strawberry"],
    ["🍒", "cherries"],
    ["🍉", "watermelon"],
    ["🍪", "cookie"],
    ["☕", "coffee"],
    ["🧋", "boba"],
    ["🎂", "cake"],
    ["🚀", "rocket"],
    ["🎧", "headphones"],
    ["🎮", "game"],
    ["📸", "camera"],
    ["💸", "money"],
    ["💰", "cash"],
    ["💅", "nails"],
    ["🪩", "disco"],
    ["💌", "love letter"],
  ].map(([emoji, name]) => ({ emoji, name, group: "More" })),
];

/** Section names in display order, derived from the emoji table. */
const EMOJI_GROUPS = Array.from(new Set(EMOJIS.map((item) => item.group)));

/** The quick-pick row above the sections. */
const TOP_EMOJIS = EMOJIS.slice(0, 12);

export function GifPicker({ onSelect }: { onSelect: (marker: string) => void }) {
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
  // Discord-style sections: the category strip below jumps to a section instead
  // of making the whole list one long scroll.
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const filteredEmojis = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? EMOJIS.filter((item) =>
          `${item.name} ${item.group} ${item.emoji}`.toLowerCase().includes(term),
        )
      : EMOJIS;
  }, [query]);
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

  // A bottom sheet, not a small popover: on a phone the picker gets the whole
  // width, a drag handle to dismiss it and a scrolling body, which is the part
  // of Discord's picker people actually use.
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("emoji_picker")}
          title={t("emoji_picker")}
          className="shrink-0 text-primary"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="glass-strong flex max-h-[82dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-white/10 p-0 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Emoji, GIFs and stickers</SheetTitle>
        <div className="flex shrink-0 justify-center pb-1 pt-2.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-1">
        <div
          className="mb-3 flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1"
          role="tablist"
          aria-label="Media type"
        >
          {(
            [
              ["emoji", "Emoji", Smile],
              ["gifs", "GIFs", Image],
              ["stickers", "Stickers", Sparkles],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => changeTab(value)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${
                tab === value
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab !== "gifs" || apiKey ? (
          <div className="relative mb-2.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(36);
              }}
              placeholder={
                tab === "emoji"
                  ? "Search emoji"
                  : tab === "stickers"
                    ? "Search this pack"
                    : "Search GIFs"
              }
              aria-label={`Search ${tab === "gifs" ? "GIFs" : tab}`}
              className="h-9 border-white/10 bg-black/20 pl-9 text-sm"
            />
          </div>
        ) : null}

        {tab === "emoji" && (
          <div className="flex min-h-0 flex-col">
            {!query && (
              <div className="mb-2">
                <p className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Top emoji
                </p>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {TOP_EMOJIS.map((item) => (
                    <button
                      key={`top-${item.name}`}
                      type="button"
                      onClick={() => {
                        onSelect(item.emoji);
                        setOpen(false);
                      }}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-lg transition hover:scale-110 hover:bg-white/10"
                      aria-label={`Add ${item.name} emoji`}
                      title={item.name}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-[45dvh] overflow-y-auto overscroll-contain pr-0.5" role="group" aria-label="Emoji">
              {EMOJI_GROUPS.map((group) => {
                const items = filteredEmojis.filter((item) => item.group === group);
                if (!items.length) return null;
                return (
                  <div
                    key={group}
                    ref={(node) => {
                      sectionRefs.current[group] = node;
                    }}
                  >
                    <p className="sticky top-0 z-10 bg-[#150f22]/95 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {group}
                    </p>
                    <div className="grid grid-cols-8 gap-0.5 sm:grid-cols-9">
                      {items.map((item, index) => (
                        <button
                          key={`${item.emoji}-${index}`}
                          type="button"
                          onClick={() => {
                            onSelect(item.emoji);
                            setOpen(false);
                          }}
                          className="grid aspect-square min-h-9 place-items-center rounded-lg text-[1.35rem] transition hover:scale-110 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Add ${item.name} emoji`}
                          title={item.name}
                        >
                          {item.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!filteredEmojis.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">No emoji found.</p>
              )}
            </div>

            <div className="mt-2 flex items-center gap-1 overflow-x-auto border-t border-white/5 pt-2">
              {EMOJI_GROUPS.map((group) => (
                <button
                  key={`jump-${group}`}
                  type="button"
                  onClick={() =>
                    sectionRefs.current[group]?.scrollIntoView({ block: "start", behavior: "smooth" })
                  }
                  className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                >
                  {group}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "gifs" && !allowed && (
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
        )}

        {tab === "gifs" && allowed && (
          <>
            {!apiKey ? (
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
                <div className="grid max-h-[45dvh] grid-cols-3 gap-2 overflow-y-auto">
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
                        onClick={() => {
                          onSelect(GIF_MARKER(gif.images.fixed_width.url));
                          setOpen(false);
                        }}
                        className="overflow-hidden rounded-lg bg-black/20 transition hover:ring-2 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Add GIF: ${gif.title || "animated GIF"}`}
                      >
                        <img
                          src={gif.images.fixed_width.url}
                          alt={gif.title || "GIF"}
                          width={Number(gif.images.fixed_width.width) || 200}
                          height={Number(gif.images.fixed_width.height) || 112}
                          loading="lazy"
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
                    <p
                      role="status"
                      className="col-span-3 py-5 text-center text-sm text-destructive"
                    >
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
          </>
        )}

        {tab === "stickers" && (
          <>
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
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    selectedPack === pack.id
                      ? "border-primary/50 bg-primary/15 text-foreground"
                      : "border-white/10 text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  {pack.label}
                </button>
              ))}
            </div>
            <div className="grid max-h-[45dvh] grid-cols-5 gap-1 overflow-y-auto overscroll-contain rounded-xl bg-black/10 p-1">
              {stickers.length > 0 &&
                filteredStickers.slice(0, visibleCount).map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => {
                      onSelect(STICKER_MARKER(sticker.src));
                      setOpen(false);
                    }}
                    className="group grid aspect-square place-items-center overflow-hidden rounded-xl p-1 transition hover:scale-105 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                        className="h-full w-full object-contain"
                      />
                    )}
                  </button>
                ))}
              {!stickers.length && !error && (
                <div className="col-span-5 flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!!stickers.length && !filteredStickers.length && (
                <p className="col-span-5 py-8 text-center text-sm text-muted-foreground">
                  No stickers found.
                </p>
              )}
              {error && (
                <p role="status" className="col-span-5 py-8 text-center text-sm text-destructive">
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
          </>
        )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
