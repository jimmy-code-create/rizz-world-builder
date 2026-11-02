import { useEffect, useMemo, useState } from "react";
import { Clock3, Search, Smile } from "lucide-react";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import {
  CAT_EMOJI_MANIFEST,
  type CatEmojiEntry,
  type CatEmojiName,
} from "@/components/emoji/cat-emoji-manifest";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The RIZZ emoji pack: twelve cat faces drawn in the app's dark-and-lime
 * palette. They travel as shortcodes (`:cat_love:`), so the same glyph renders
 * in a post reaction, a comment, a Reel and a message without a round trip —
 * `AnimatedEmoji` and `renderTextWithCatEmoji` already resolve the shortcode.
 *
 * This is the one picker every surface uses. It carries the search field and
 * the recents row, so there is one definition of "recent" for the whole app
 * instead of four lists that drift.
 */

const RECENT_KEY = "rizz:emoji:recent";
const RECENT_LIMIT = 6;

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((code): code is string => CAT_EMOJI_MANIFEST.some((e) => e.shortcode === code))
      : [];
  } catch {
    return [];
  }
}

function remember(shortcode: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [shortcode, ...readRecents().filter((code) => code !== shortcode)].slice(
      0,
      RECENT_LIMIT,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the picker still works, it just forgets.
  }
}

function matches(entry: CatEmojiEntry, term: string): boolean {
  if (!term) return true;
  const haystack =
    `${entry.name} ${entry.label} ${entry.tags.join(" ")} ${entry.shortcode}`.toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function Grid({
  entries,
  onPick,
  size = 30,
  columns = 6,
}: {
  entries: readonly CatEmojiEntry[];
  onPick: (shortcode: string) => void;
  size?: number;
  columns?: number;
}) {
  return (
    <div
      role="listbox"
      aria-label="RIZZ emoji"
      className="grid gap-0.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {entries.map((entry) => (
        <button
          key={entry.shortcode}
          type="button"
          role="option"
          aria-selected={false}
          aria-label={entry.label}
          title={`${entry.label} — ${entry.shortcode}`}
          onClick={() => onPick(entry.shortcode)}
          className="grid aspect-square min-h-9 place-items-center rounded-lg transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <CatEmoji name={entry.name as CatEmojiName} size={size} animate="hover" />
        </button>
      ))}
    </div>
  );
}

/**
 * The panel itself: search, recents, then the whole pack. `compact` trims the
 * padding so it can sit inside an existing reaction popover.
 */
export function RizzEmojiPanel({
  onPick,
  compact = false,
  autoFocus = false,
  columns,
}: {
  onPick: (shortcode: string) => void;
  compact?: boolean;
  autoFocus?: boolean;
  columns?: number;
}) {
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(() => readRecents());

  useEffect(() => {
    if (compact) return;
    setRecents(readRecents());
  }, [compact]);

  const filtered = useMemo(
    () => CAT_EMOJI_MANIFEST.filter((entry) => matches(entry, query.trim())),
    [query],
  );
  const recentEntries = useMemo(
    () =>
      recents
        .map((code) => CAT_EMOJI_MANIFEST.find((entry) => entry.shortcode === code))
        .filter((entry): entry is CatEmojiEntry => Boolean(entry))
        .filter((entry) => matches(entry, query.trim())),
    [recents, query],
  );

  const pick = (shortcode: string) => {
    remember(shortcode);
    setRecents(readRecents());
    onPick(shortcode);
  };

  return (
    <div className={cn("w-full", compact ? "space-y-1.5" : "space-y-2.5")}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the RIZZ pack"
          aria-label="Search RIZZ emoji"
          autoFocus={autoFocus}
          className={cn("glass border-white/10 pl-8", compact ? "h-8 text-xs" : "h-9 text-sm")}
        />
      </div>

      {recentEntries.length > 0 && !query && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <Clock3 className="h-3 w-3" /> Recent
          </p>
          <Grid entries={recentEntries} onPick={pick} size={compact ? 26 : 28} columns={6} />
        </div>
      )}

      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <Smile className="h-3 w-3" /> The pack
        </p>
        {filtered.length > 0 ? (
          <Grid entries={filtered} onPick={pick} size={compact ? 26 : 30} columns={columns ?? 6} />
        ) : (
          <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">
            No cat matches “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A ready-made trigger for surfaces that do not already own a popover. The
 * reaction pills keep their own chrome; this is for the "+" in a tray.
 */
export function RizzEmojiTrigger({
  onPick,
  label = "Open the RIZZ emoji pack",
  className,
  align = "end",
}: {
  onPick: (shortcode: string) => void;
  label?: string;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          className={cn("h-8 w-8 rounded-full text-muted-foreground", className)}
        >
          <CatEmoji name="cat_wave" size={18} animate="hover" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-[19rem] border-white/10 bg-[var(--brand-ink-2,#131315)] p-2.5 shadow-xl"
      >
        <div className="mb-2 flex items-center gap-2 border-b border-white/5 pb-2">
          <CatEmoji name="cat_love" size={22} animate="hover" />
          <p className="font-display text-xs font-bold">RIZZ emoji</p>
        </div>
        <RizzEmojiPanel
          autoFocus
          onPick={(shortcode) => {
            onPick(shortcode);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
