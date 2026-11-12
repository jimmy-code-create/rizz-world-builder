import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Search, Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { readRecentEmoji } from "@/lib/emoji-shared";
import { recordEmojiUse, useEmojiPreferences } from "@/lib/emoji-recents";
import { SMILEY_CHARS, SMILEY_EMOJI, searchSmileys } from "@/lib/smiley-data";

/**
 * The emoji tab of the composer sheet: smileys, and only smileys.
 *
 * The old panel carried the whole Unicode catalogue (750 glyphs in nine
 * sections), every joined realm's custom pack and a preview overlay. Opening it
 * meant building ~800 items, measuring nine virtualised sections and firing a
 * network request per visible face. This is one flat table of faces instead:
 * no query, no sections to measure, no image requests. A cell is a text glyph,
 * so the first frame is the finished frame — that is the whole lag fix.
 *
 * What a pick returns is unchanged (a raw glyph), so every composer keeps
 * working without knowing the panel got simpler.
 */

const RECENT_LIMIT = 16;

export type RizzEmojiPanelProps = {
  /** Kept for callers that still pass it; the panel no longer reads a realm. */
  realmKey?: string;
  realmId?: string;
  realmName?: string;
  /** Controlled when the sheet owns the sticky search field. */
  query?: string;
  onQueryChange?: (query: string) => void;
  onPick?: (token: string, emoji: string) => void;
  /** Legacy single-callback form: only used when `onPick` is absent. */
  onEmoji?: (emoji: string) => void;
  onClose?: () => void;
  /** Kept for the sheet's menu affordance; the panel shows only smileys. */
  onManage?: () => void;
  mode?: "normal" | "reactions";
  className?: string;
  initialScrollTop?: number;
  onScrollTopChange?: (scrollTop: number) => void;
};

export function RizzEmojiPanel({
  realmId,
  query,
  onQueryChange,
  onPick,
  onEmoji,
  mode = "normal",
  className,
  initialScrollTop = 0,
  onScrollTopChange,
}: RizzEmojiPanelProps) {
  const prefs = useEmojiPreferences();
  const [localQuery, setLocalQuery] = useState("");
  const [storedRecents, setStoredRecents] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const controlledSearch = query !== undefined;
  const searchValue = controlledSearch ? (query ?? "") : localQuery;
  const term = searchValue.trim().toLowerCase();

  // Both stores are written on every pick; reading them on mount keeps the
  // recent row honest without a subscription on the hot path.
  useEffect(() => {
    setStoredRecents(readRecentEmoji());
  }, [prefs.updatedAt]);

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const token of [...prefs.recents, ...storedRecents]) {
      if (!SMILEY_CHARS.has(token) || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
      if (out.length >= RECENT_LIMIT) break;
    }
    return out;
  }, [prefs.recents, storedRecents]);

  // 100-ish faces filter in well under a frame, so the field stays local and
  // instant: no debounce, no deferred value, no worker.
  const results = useMemo(() => searchSmileys(term), [term]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = initialScrollTop;
    // Only the remembered position matters; the sheet remounts on each open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = useCallback(
    (char: string) => {
      recordEmojiUse(char, realmId);
      // Exactly one callback per tap. Calling both used to insert the same
      // emoji twice in the composer (two `onSelect` calls, one draft append).
      if (onPick) onPick(char, char);
      else onEmoji?.(char);
    },
    [onEmoji, onPick, realmId],
  );

  const renderCell = (char: string, name: string) => (
    <button
      key={char}
      type="button"
      className="emoji-cell emoji-cell--smiley"
      aria-label={`${name} emoji`}
      title={name}
      onClick={() => pick(char)}
    >
      <span className="emoji-cell__glyph" aria-hidden="true">
        {char}
      </span>
    </button>
  );

  const heading = term ? "Results" : "Smileys";
  const shown = term ? results.length : SMILEY_EMOJI.length;

  return (
    <div
      className={cn("rizz-picker relative flex h-full min-h-0 flex-col", className)}
      data-mode={mode}
    >
      {!controlledSearch && (
        <div className="shrink-0 px-4 pb-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={searchValue}
              onChange={(event) => setLocalQuery(event.target.value)}
              placeholder="Search smileys"
              aria-label="Search smileys"
              className="h-10 w-full rounded-[10px] border border-white/[0.08] bg-white/[0.04] pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-white/25"
              autoFocus={mode === "reactions"}
            />
            {searchValue && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                onClick={() => setLocalQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="rizz-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
        onScroll={(event) => onScrollTopChange?.(event.currentTarget.scrollTop)}
      >
        {!term && recents.length > 0 && (
          <section className="emoji-smiley-group" aria-label="Recent smileys">
            <div className="emoji-smiley-head">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3 w-3" aria-hidden="true" /> Recent
              </span>
            </div>
            <div className="rizz-emoji-grid rizz-emoji-grid--smileys">
              {recents.map((char) => renderCell(char, "recent"))}
            </div>
          </section>
        )}

        <section className="emoji-smiley-group" aria-label={heading}>
          <div className="emoji-smiley-head">
            <span className="flex items-center gap-1.5">
              <Smile className="h-3 w-3" aria-hidden="true" /> {heading}
            </span>
            <span className="emoji-smiley-count">{shown}</span>
          </div>
          {results.length ? (
            <div className="rizz-emoji-grid rizz-emoji-grid--smileys">
              {results.map((entry) => renderCell(entry.char, entry.name))}
            </div>
          ) : (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No smiley matches “{searchValue.trim()}”.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
