import { useEffect, useState } from "react";
import { Image, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type GifResult = {
  id: string;
  title: string;
  images: { fixed_width: { url: string; width: string; height: string } };
};

const GIF_MARKER = (url: string) => `![gif](${url})`;

export function GifPicker({ onSelect }: { onSelect: (marker: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiKey = import.meta.env.VITE_GIPHY_API_KEY?.trim();

  useEffect(() => {
    if (!open || !apiKey) return;
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
        setResults((payload.data ?? []).filter((gif: GifResult) => gif.images?.fixed_width?.url));
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(cause instanceof Error ? cause.message : "Couldn't load GIFs.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Add a GIF"
          title="Add a GIF"
          className="shrink-0 text-muted-foreground"
        >
          <Image className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="glass-strong w-[min(22rem,calc(100vw-2rem))] border-white/10 p-3"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search GIFs"
            aria-label="Search GIFs"
            className="pl-9"
          />
        </div>
        <div className="mt-3 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
          {loading && (
            <div className="col-span-3 flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading &&
            results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => {
                  onSelect(GIF_MARKER(gif.images.fixed_width.url));
                  setOpen(false);
                }}
                className="overflow-hidden rounded-lg bg-black/20 ring-offset-background transition hover:ring-2 hover:ring-[var(--rizz-pink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
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
          {!loading && !error && !results.length && apiKey && (
            <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">
              No GIFs found. Try another search.
            </p>
          )}
          {!apiKey && (
            <p className="col-span-3 py-5 text-center text-sm text-muted-foreground">
              Add VITE_GIPHY_API_KEY to the app environment to search GIFs.
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
      </PopoverContent>
    </Popover>
  );
}
