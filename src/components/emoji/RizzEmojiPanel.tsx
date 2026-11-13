import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Image as ImageIcon, Search, Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { emojiToken, readRecentEmoji } from "@/lib/emoji-shared";
import { recordEmojiUse, useEmojiPreferences } from "@/lib/emoji-recents";
import { SMILEY_CHARS, searchSmileys } from "@/lib/smiley-data";
import { useAvailableEmojis } from "@/lib/emoji-available";
import { FluentEmoji } from "@/components/emoji/FluentEmoji";

/**
 * The emoji picker used by every composer: DMs, groups and realms.
 *
 * Two things make it fast, and both matter more than any animation:
 *
 *  1. Only the rows on screen are mounted. The smiley table is ~115 faces and
 *     a realm pack can be larger, but the DOM holds roughly one screenful at a
 *     time — the sheet opens in one frame instead of painting the whole set.
 *  2. Nothing is fetched to show a face. Microsoft Fluent artwork is addressed
 *     by Unicode codepoint, so a cell is one `<img loading="lazy">` that the
 *     browser loads when its row actually appears; the text glyph underneath is
 *     the instant fallback.
 *
 * The source chips on the row above the grid are how realm emoji get into a DM
 * or a group: "Smileys" is the Unicode set, "Realms" is every custom emoji the
 * viewer can use, grouped by realm.
 */

type Cell = {
  key: string;
  kind: "smiley" | "realm";
  name: string;
  token: string;
  char?: string;
  url?: string;
};

type Row =
  | { key: string; kind: "header"; label: string; count: number }
  | { key: string; kind: "cells"; cells: Cell[] };

const CELL_H = 48;
const HEAD_H = 26;
const OVERSCAN = 160;
const RECENT_LIMIT = 16;

function chunkRows(cells: Cell[], columns: number): Cell[][] {
  const rows: Cell[][] = [];
  for (let index = 0; index < cells.length; index += columns) {
    rows.push(cells.slice(index, index + columns));
  }
  return rows;
}

export type RizzEmojiPanelProps = {
  /** Kept for callers that still pass it; the panel reads every realm. */
  realmKey?: string;
  realmId?: string;
  realmName?: string;
  /** Controlled when the sheet owns the search field. */
  query?: string;
  onQueryChange?: (query: string) => void;
  onPick?: (token: string, emoji: string) => void;
  /** Legacy single-callback form: only used when `onPick` is absent. */
  onEmoji?: (emoji: string) => void;
  onClose?: () => void;
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
  const [source, setSource] = useState<"smileys" | "realms">("smileys");
  // Only fetch realm packs once someone asks for them: opening the picker on
  // smileys must cost zero requests.
  const available = useAvailableEmojis(source === "realms");
  const [localQuery, setLocalQuery] = useState("");
  const [storedRecents, setStoredRecents] = useState<string[]>([]);
  const [viewport, setViewport] = useState({ top: 0, height: 460, width: 400 });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(0);

  const controlledSearch = query !== undefined;
  const searchValue = controlledSearch ? (query ?? "") : localQuery;
  const term = searchValue.trim().toLowerCase();

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

  const columns = viewport.width >= 560 ? 10 : viewport.width >= 440 ? 9 : 8;

  const smileyCells = useMemo<Cell[]>(
    () =>
      searchSmileys(term).map((entry) => ({
        key: `u:${entry.char}`,
        kind: "smiley",
        name: entry.name,
        token: entry.char,
        char: entry.char,
      })),
    [term],
  );

  /** Every custom emoji the viewer may use, grouped by where it comes from. */
  const realmGroups = useMemo(() => {
    const payload = available.data;
    if (!payload) return [] as Array<{ key: string; label: string; cells: Cell[] }>;
    const groups: Array<{ key: string; label: string; cells: Cell[] }> = [];
    const matches = (name: string) => !term || name.toLowerCase().includes(term);
    const privateCells: Cell[] = payload.private
      .filter((emoji) => matches(emoji.name))
      .map((emoji) => ({
        key: `p:${emoji.id}`,
        kind: "realm" as const,
        name: emoji.name,
        token: emojiToken({ id: emoji.id, shortcode: emoji.name }),
        url: emoji.url,
      }));
    if (privateCells.length) groups.push({ key: "private", label: "Your emoji", cells: privateCells });
    for (const realm of payload.realms) {
      const cells: Cell[] = realm.emojis
        .filter((emoji) => matches(emoji.name))
        .map((emoji) => ({
          key: `r:${emoji.id}`,
          kind: "realm" as const,
          name: emoji.name,
          token: emojiToken({ id: emoji.id, shortcode: emoji.name }),
          url: emoji.url,
        }));
      if (cells.length) groups.push({ key: realm.id, label: realm.name, cells });
    }
    return groups;
  }, [available.data, term]);

  const hasRealmEmoji = useMemo(
    () =>
      (available.data?.private.length ?? 0) > 0 ||
      (available.data?.realms.some((realm) => realm.emojis.length > 0) ?? false),
    [available.data],
  );

  // One flat row list, so the window maths stays the same for a smiley table
  // and for realms with headers between packs.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (source === "smileys") {
      if (!term && recents.length) {
        out.push({ key: "recent", kind: "header", label: "Recent", count: recents.length });
        for (const cells of chunkRows(
          recents.map<Cell>((char) => ({
            key: `recent:${char}`,
            kind: "smiley",
            name: "recent",
            token: char,
            char,
          })),
          columns,
        )) {
          out.push({ key: `recent-${out.length}`, kind: "cells", cells });
        }
      }
      out.push({
        key: "smileys",
        kind: "header",
        label: term ? "Results" : "Smileys",
        count: smileyCells.length,
      });
      for (const cells of chunkRows(smileyCells, columns)) {
        out.push({ key: `smileys-${out.length}`, kind: "cells", cells });
      }
      return out;
    }
    for (const group of realmGroups) {
      out.push({ key: `h:${group.key}`, kind: "header", label: group.label, count: group.cells.length });
      for (const cells of chunkRows(group.cells, columns)) {
        out.push({ key: `${group.key}-${out.length}`, kind: "cells", cells });
      }
    }
    return out;
  }, [columns, realmGroups, recents, smileyCells, source, term]);

  /** Row offsets from fixed heights, so the window is arithmetic, not layout. */
  const layout = useMemo(() => {
    let top = 0;
    return rows.map((row) => {
      const height = row.kind === "header" ? HEAD_H : CELL_H * Math.ceil(row.cells.length / columns);
      const entry = { row, top, height };
      top += height;
      return entry;
    });
  }, [columns, rows]);

  const totalHeight = layout.length ? layout[layout.length - 1].top + layout[layout.length - 1].height : 0;

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setViewport((current) => {
      const next = {
        top: element.scrollTop,
        height: element.clientHeight || current.height,
        width: element.clientWidth || current.width,
      };
      return next.top === current.top && next.height === current.height && next.width === current.width
        ? current
        : next;
    });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = initialScrollTop;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(element);
    return () => observer.disconnect();
    // The remembered position only applies to the first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = 0;
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, term]);

  const pick = useCallback(
    (cell: Cell) => {
      recordEmojiUse(cell.token, realmId);
      // Exactly one callback per tap: the old picker fired both, which inserted
      // the same emoji twice into the composer.
      if (onPick) onPick(cell.token, cell.token);
      else onEmoji?.(cell.token);
    },
    [onEmoji, onPick, realmId],
  );

  const windowStart = viewport.top - OVERSCAN;
  const windowEnd = viewport.top + viewport.height + OVERSCAN;

  const renderCell = (cell: Cell) => (
    <button
      key={cell.key}
      type="button"
      className={cn("emoji-cell emoji-cell--smiley", cell.kind === "realm" && "emoji-cell--realm")}
      aria-label={cell.kind === "realm" ? `:${cell.name}:` : `${cell.name} emoji`}
      title={cell.kind === "realm" ? `:${cell.name}:` : cell.name}
      onClick={() => pick(cell)}
    >
      {cell.kind === "realm" && cell.url ? (
        <img
          src={cell.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-8 w-8 object-contain"
        />
      ) : (
        // The system glyph paints in the first frame; the Fluent artwork sits
        // on top and simply covers it once decoded. No blank cell, no waiting
        // on the CDN before the grid is usable.
        <span className="emoji-face" aria-hidden="true">
          <span className="emoji-face__glyph">{cell.char}</span>
          {cell.char ? (
            <span className="emoji-face__art">
              <FluentEmoji glyph={cell.char} size={27} />
            </span>
          ) : null}
        </span>
      )}
    </button>
  );

  return (
    <div className={cn("rizz-picker relative flex h-full min-h-0 flex-col", className)} data-mode={mode}>
      <div className="flex shrink-0 items-center gap-1.5 px-3 pb-1.5">
        <button
          type="button"
          onClick={() => setSource("smileys")}
          aria-pressed={source === "smileys"}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors",
            source === "smileys"
              ? "bg-white/[0.1] text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Smile className="h-3.5 w-3.5" aria-hidden="true" /> Smileys
        </button>
        <button
          type="button"
          onClick={() => setSource("realms")}
          aria-pressed={source === "realms"}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors",
            source === "realms"
              ? "bg-white/[0.1] text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Realms
          {hasRealmEmoji ? (
            <span className="ml-0.5 rounded-full bg-white/[0.08] px-1.5 text-[10px] tabular-nums text-muted-foreground">
              {realmGroups.reduce((sum, group) => sum + group.cells.length, 0)}
            </span>
          ) : null}
        </button>
      </div>

      {!controlledSearch && (
        <div className="shrink-0 px-3 pb-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={searchValue}
              onChange={(event) => setLocalQuery(event.target.value)}
              placeholder={source === "smileys" ? "Search smileys" : "Search realm emoji"}
              aria-label="Search emoji"
              className="h-9 w-full rounded-[10px] border border-white/[0.08] bg-white/[0.04] pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-white/25"
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
        className="rizz-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
        onScroll={() => {
          const element = scrollRef.current;
          if (element) onScrollTopChange?.(element.scrollTop);
          if (frameRef.current) return;
          frameRef.current = window.requestAnimationFrame(() => {
            frameRef.current = 0;
            measure();
          });
        }}
      >
        <div style={{ height: totalHeight }} className="relative">
          {layout.map(({ row, top, height }) => {
            if (top + height < windowStart || top > windowEnd) return null;
            if (row.kind === "header") {
              return (
                <div
                  key={row.key}
                  className="emoji-smiley-head absolute inset-x-0"
                  style={{ top, height: HEAD_H }}
                >
                  <span className="flex items-center gap-1.5">
                    {row.key === "recent" ? (
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Smile className="h-3 w-3" aria-hidden="true" />
                    )}
                    {row.label}
                  </span>
                  <span className="emoji-smiley-count">{row.count}</span>
                </div>
              );
            }
            return (
              <div
                key={row.key}
                className="rizz-emoji-grid absolute inset-x-0"
                style={{
                  top,
                  height,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gridAutoRows: `${CELL_H}px`,
                }}
              >
                {row.cells.map(renderCell)}
              </div>
            );
          })}

          {source === "realms" && !realmGroups.length && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {available.isLoading
                ? "Loading realm emoji…"
                : term
                  ? "No realm emoji matches that search."
                  : "No realm emoji yet — add one from a realm's emoji sheet."}
            </p>
          )}
          {source === "smileys" && !smileyCells.length && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No smiley matches “{searchValue.trim()}”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
