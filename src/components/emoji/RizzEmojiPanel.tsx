import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
} from "react";
import { Clock3, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EMOJI_CATEGORIES,
  EMOJI_DATA,
  searchUnicodeEmoji,
  type EmojiEntry,
} from "@/lib/emoji-data";
import {
  emojiToken,
  readRecentEmoji,
  searchEmoji,
  useJoinedEmoji,
  type SharedEmoji,
} from "@/lib/emoji-shared";
import { buildEmojiRealmSections, useJoinedRealms } from "@/lib/emoji-realms";
import { recordEmojiUse, useEmojiPreferences } from "@/lib/emoji-recents";
import { RealmEmojiImage } from "@/components/emoji/RealmEmojiImage";

type EmojiInput = string | { native?: string; unicode?: string; id?: string; shortcode?: string };

interface RizzEmojiPanelProps {
  open?: boolean;
  realmKey?: string;
  realmId?: string;
  realmName?: string;
  /** Controlled when the sheet owns the sticky search field. */
  query?: string;
  onQueryChange?: (query: string) => void;
  onPick?: (token: string, emoji: EmojiInput) => void;
  onEmoji?: (emoji: string) => void;
  onClose?: () => void;
  onManage?: () => void;
  mode?: "normal" | "reactions";
  className?: string;
  initialScrollTop?: number;
  onScrollTopChange?: (scrollTop: number) => void;
}

type UnicodeItem = {
  kind: "unicode";
  key: string;
  char: string;
  name: string;
  shortcode: string;
};

type RealmItem = {
  kind: "realm";
  key: string;
  emoji: SharedEmoji;
  name: string;
  realmId: string;
  realmName: string;
  realmIcon: string | null;
};

type EmojiItem = UnicodeItem | RealmItem;

type EmojiSection = {
  id: string;
  label: string;
  kind: "recent" | "realm" | "category" | "search";
  items: EmojiItem[];
  iconUrl?: string | null;
  iconChar?: string;
};

type RailItem = {
  id: string;
  label: string;
  kind: "recent" | "realm" | "category";
  iconUrl?: string | null;
  iconChar?: string;
};

type VirtualRow = {
  key: string;
  kind: "header" | "items";
  sectionId: string;
  sectionLabel: string;
  sectionCount: number;
  top: number;
  height: number;
  items: EmojiItem[];
};

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 30;
const STICKY_HEIGHT = 34;
const OVERSCAN = 3;
const CUSTOM_TOKEN = /^<:([a-z0-9_]{2,32}):([0-9a-fA-F-]{36})>$/i;
const CUSTOM_ID = /^[0-9a-fA-F-]{36}$/;

export function rememberEmojiPick(emoji: EmojiInput, realmId?: string): void {
  const token =
    typeof emoji === "string"
      ? emoji
      : emoji.native ||
        emoji.unicode ||
        (emoji.id
          ? emoji.shortcode
            ? `<:${emoji.shortcode}:${emoji.id}>`
            : emoji.id
          : "");
  if (token) recordEmojiUse(token, realmId);
}

function unicodeItem(entry: EmojiEntry): UnicodeItem {
  return {
    kind: "unicode",
    key: `u:${entry.char}`,
    char: entry.char,
    name: entry.name,
    shortcode: entry.name.replace(/\s+/g, "_"),
  };
}

function realmItem(
  emoji: SharedEmoji,
  realmIcon: string | null,
): RealmItem {
  return {
    kind: "realm",
    key: `r:${emoji.id}`,
    emoji,
    name: emoji.shortcode,
    realmId: emoji.realm_id,
    realmName: emoji.realm_name || "Realm",
    realmIcon,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function RealmRailIcon({ url, name }: { url?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const initial = (name || "R").trim().charAt(0).toUpperCase();

  if (!url || failed) {
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-foreground">
        {initial}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-7 w-7 rounded-full object-cover"
    />
  );
}

function RealmBadge({ item }: { item: RealmItem }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.realmIcon]);
  const initial = item.realmName.trim().charAt(0).toUpperCase() || "R";
  return (
    <span
      className="emoji-cell__badge"
      title={item.realmName}
      aria-hidden="true"
    >
      {item.realmIcon && !failed ? (
        <img
          src={item.realmIcon}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        initial
      )}
    </span>
  );
}

function PreviewMedia({ item }: { item: EmojiItem }) {
  if (item.kind === "unicode") {
    return (
      <span className="emoji-preview__glyph" aria-hidden="true">
        {item.char}
      </span>
    );
  }
  return (
    <RealmEmojiImage
      url={item.emoji.url}
      shortcode={item.emoji.shortcode}
      animated={item.emoji.animated}
      eager
      className="h-32 w-32"
      imageClassName="max-h-32 max-w-32"
    />
  );
}

/**
 * The emoji tab used by the composer sheet.
 *
 * Order is deliberate: Recent, every joined realm (even a realm with no custom
 * emoji yet gets a rail stop), then the unicode categories. Realm rows carry
 * their own header count and a small realm badge in search results. The grid is
 * virtualised by row and the rail follows the scroll position, so opening the
 * sheet on a low-end phone does not mount 900+ buttons at once.
 */
export function RizzEmojiPanel({
  realmKey,
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
  const joined = useJoinedEmoji();
  const joinedRealms = useJoinedRealms();
  const prefs = useEmojiPreferences();
  const [localQuery, setLocalQuery] = useState("");
  const controlledSearch = query !== undefined;
  const searchValue = controlledSearch ? query ?? "" : localQuery;
  const setSearchValue = useCallback(
    (next: string) => {
      if (controlledSearch) onQueryChange?.(next);
      else setLocalQuery(next);
    },
    [controlledSearch, onQueryChange],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(0);
  const [viewport, setViewport] = useState({ top: 0, height: 480, width: 420 });
  const [activeSection, setActiveSection] = useState("recent");
  const [preview, setPreview] = useState<EmojiItem | null>(null);
  const pressTimer = useRef<number | null>(null);
  const suppressedClick = useRef<string | null>(null);
  const pendingRail = useRef<string | null>(null);
  const previousQuery = useRef(searchValue);

  const emojiById = useMemo(() => {
    const map = new Map<string, SharedEmoji>();
    for (const row of joined.data ?? []) map.set(row.id, row);
    return map;
  }, [joined.data]);

  const unicodeByChar = useMemo(() => {
    const map = new Map<string, EmojiEntry>();
    for (const entry of EMOJI_DATA) map.set(entry.char, entry);
    return map;
  }, []);

  const realmSections = useMemo(
    () =>
      buildEmojiRealmSections(
        joined.data ?? [],
        joinedRealms.data ?? [],
        realmId ?? null,
      ),
    [joined.data, joinedRealms.data, realmId],
  );

  const realmById = useMemo(() => {
    const map = new Map<string, { name: string; icon: string | null }>();
    for (const section of realmSections) {
      map.set(section.id, { name: section.name, icon: section.iconUrl });
    }
    return map;
  }, [realmSections]);

  const sections = useMemo<EmojiSection[]>(() => {
    const recentItems: EmojiItem[] = [];
    const seenRecent = new Set<string>();
    const pushRecent = (item: EmojiItem) => {
      if (seenRecent.has(item.key)) return;
      seenRecent.add(item.key);
      recentItems.push(item);
    };

    // New tokens are stored as `<:name:id>` (and older pickers stored a bare
    // emoji id or unicode glyph). Resolve all three so "Recent" keeps working
    // across the picker versions shipped to the same device.
    const recentTokens = [...prefs.recents, ...readRecentEmoji()];
    for (const token of recentTokens) {
      if (typeof token !== "string" || !token) continue;
      const custom = CUSTOM_TOKEN.exec(token);
      if (custom) {
        const row = emojiById.get(custom[2]);
        if (row) pushRecent(realmItem(row, realmById.get(row.realm_id)?.icon ?? null));
        continue;
      }
      if (CUSTOM_ID.test(token)) {
        const row = emojiById.get(token);
        if (row) pushRecent(realmItem(row, realmById.get(row.realm_id)?.icon ?? null));
        continue;
      }
      if (token.startsWith("ce:")) {
        const row = emojiById.get(token.slice(3));
        if (row) pushRecent(realmItem(row, realmById.get(row.realm_id)?.icon ?? null));
        continue;
      }
      const unicode = unicodeByChar.get(token);
      if (unicode) pushRecent(unicodeItem(unicode));
      if (recentItems.length >= 32) break;
    }

    const realmSectionsForPanel: EmojiSection[] = realmSections.map((section) => {
      const items = section.emoji.map((emoji) =>
        realmItem(emoji, section.iconUrl),
      );
      return {
        id: section.id,
        label: section.name,
        kind: "realm",
        items,
        iconUrl: section.iconUrl,
      };
    });

    const categories: EmojiSection[] = EMOJI_CATEGORIES.map((category) => {
      const items = EMOJI_DATA.filter(
        (entry) => entry.category === category.category,
      ).map(unicodeItem);
      return {
        id: `unicode-${category.id}`,
        label: category.label,
        kind: "category",
        items,
        iconChar: category.icon,
      };
    });

    return [
      { id: "recent", label: "Recent", kind: "recent", items: recentItems },
      ...realmSectionsForPanel,
      ...categories,
    ];
  }, [emojiById, prefs.recents, realmById, realmSections, unicodeByChar]);

  const trimmedQuery = searchValue.trim();
  const searching = trimmedQuery.length > 0;

  const searchSection = useMemo<EmojiSection | null>(() => {
    if (!searching) return null;
    const realmHits = searchEmoji(
      realmSections.flatMap((section) => section.emoji),
      trimmedQuery,
    )
      .slice(0, 120)
      .map((row) =>
        realmItem(row, realmById.get(row.realm_id)?.icon ?? null),
      );
    const unicodeHits = searchUnicodeEmoji(trimmedQuery, 180).map(unicodeItem);
    return {
      id: "search",
      label: "Search results",
      kind: "search",
      items: [...realmHits, ...unicodeHits],
    };
  }, [realmById, realmSections, searching, trimmedQuery]);

  const visibleSections = useMemo(
    () => (searchSection ? [searchSection] : sections),
    [searchSection, sections],
  );

  const railItems = useMemo<RailItem[]>(() => {
    const realms: RailItem[] = realmSections.map((section) => ({
      id: section.id,
      label: section.name,
      kind: "realm",
      iconUrl: section.iconUrl,
    }));
    const categories: RailItem[] = EMOJI_CATEGORIES.map((category) => ({
      id: `unicode-${category.id}`,
      label: category.label,
      kind: "category",
      iconChar: category.icon,
    }));
    return [
      { id: "recent", label: "Recent", kind: "recent" },
      ...realms,
      ...categories,
    ];
  }, [realmSections]);

  const columns = viewport.width >= 540 ? 9 : 8;

  const rows = useMemo<VirtualRow[]>(() => {
    const next: VirtualRow[] = [];
    let top = 0;
    for (const section of visibleSections) {
      next.push({
        key: `${section.id}:header`,
        kind: "header",
        sectionId: section.id,
        sectionLabel: section.label,
        sectionCount: section.items.length,
        top,
        height: HEADER_HEIGHT,
        items: [],
      });
      top += HEADER_HEIGHT;
      chunk(section.items, columns).forEach((items, index) => {
        next.push({
          key: `${section.id}:row:${index}`,
          kind: "items",
          sectionId: section.id,
          sectionLabel: section.label,
          sectionCount: section.items.length,
          top,
          height: ROW_HEIGHT,
          items,
        });
        top += ROW_HEIGHT;
      });
    }
    return next;
  }, [columns, visibleSections]);

  const totalHeight = rows.length ? rows[rows.length - 1].top + rows[rows.length - 1].height : 0;

  const sectionHeaders = useMemo(
    () => rows.filter((row) => row.kind === "header"),
    [rows],
  );

  const activeMeta = useMemo(() => {
    if (searchSection) {
      return { label: "Search results", count: searchSection.items.length, id: "search" };
    }
    const match =
      sectionHeaders.find((header) => header.sectionId === activeSection) ??
      sectionHeaders[0];
    return {
      label: match?.sectionLabel ?? "Emoji",
      count: match?.sectionCount ?? 0,
      id: match?.sectionId ?? "recent",
    };
  }, [activeSection, searchSection, sectionHeaders]);

  const updateViewport = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setViewport({
      top: element.scrollTop,
      height: element.clientHeight || 480,
      width: element.clientWidth || 420,
    });
  }, []);

  const updateActive = useCallback(
    (top: number) => {
      const probe = top + STICKY_HEIGHT + 4;
      let current = sectionHeaders[0];
      for (const header of sectionHeaders) {
        if (header.top <= probe) current = header;
        else break;
      }
      if (current && current.sectionId !== activeSection) {
        setActiveSection(current.sectionId);
      }
    },
    [activeSection, sectionHeaders],
  );

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = initialScrollTop;
    updateViewport();
    updateActive(element.scrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScrollTop]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateViewport());
    observer.observe(element);
    return () => observer.disconnect();
  }, [updateViewport]);

  useEffect(() => {
    if (previousQuery.current === searchValue) return;
    previousQuery.current = searchValue;
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = 0;
      onScrollTopChange?.(0);
      updateViewport();
    }
  }, [onScrollTopChange, searchValue, updateViewport]);

  const scrollToSection = useCallback(
    (section: string) => {
      const element = scrollRef.current;
      const header = sectionHeaders.find((row) => row.sectionId === section);
      if (!element || !header) return;
      element.scrollTo({
        top: Math.max(0, header.top - STICKY_HEIGHT),
        behavior: "smooth",
      });
      setActiveSection(section);
    },
    [sectionHeaders],
  );

  useEffect(() => {
    if (searching || !pendingRail.current) return;
    const target = pendingRail.current;
    pendingRail.current = null;
    scrollToSection(target);
  }, [rows, scrollToSection, searching]);

  const handleScroll = useCallback(
    (event: ReactUIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      onScrollTopChange?.(element.scrollTop);
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;
        setViewport((current) => {
          const next = {
            top: element.scrollTop,
            height: element.clientHeight || current.height,
            width: element.clientWidth || current.width,
          };
          return next.top === current.top &&
            next.height === current.height &&
            next.width === current.width
            ? current
            : next;
        });
        updateActive(element.scrollTop);
      });
    },
    [onScrollTopChange, updateActive],
  );

  const pick = useCallback(
    (item: EmojiItem) => {
      const token = item.kind === "unicode" ? item.char : emojiToken(item.emoji);
      rememberEmojiPick(token, realmId ?? (item.kind === "realm" ? item.realmId : undefined));
      onPick?.(token, token);
      onEmoji?.(token);
      setPreview(null);
    },
    [onEmoji, onPick, realmId],
  );

  const startPreview = useCallback((item: EmojiItem) => {
    suppressedClick.current = item.key;
    setPreview(item);
    navigator.vibrate?.(8);
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  useEffect(() => () => cancelPress(), [cancelPress]);

  const beginPress = (event: ReactPointerEvent, item: EmojiItem) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelPress();
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      startPreview(item);
    }, 420);
  };

  const endPress = () => cancelPress();

  const onCellClick = (item: EmojiItem) => {
    if (suppressedClick.current === item.key) {
      suppressedClick.current = null;
      return;
    }
    pick(item);
  };

  const goToRail = (id: string) => {
    if (searching) {
      pendingRail.current = id;
      setSearchValue("");
      return;
    }
    scrollToSection(id);
  };

  const start = Math.max(
    0,
    rows.findIndex((row) => row.top + row.height >= viewport.top - OVERSCAN * ROW_HEIGHT),
  );
  const end = rows.reduce(
    (last, row, index) =>
      row.top <= viewport.top + viewport.height + OVERSCAN * ROW_HEIGHT ? index : last,
    start,
  );
  const visibleRows = rows.slice(start, end + 1);

  const renderCell = (item: EmojiItem) => {
    if (item.kind === "unicode") {
      return (
        <button
          key={item.key}
          type="button"
          className="emoji-cell"
          aria-label={`${item.name} emoji`}
          onPointerDown={(event) => beginPress(event, item)}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(event) => {
            event.preventDefault();
            startPreview(item);
          }}
          onClick={() => onCellClick(item)}
        >
          <span className="emoji-cell__glyph">{item.char}</span>
        </button>
      );
    }

    return (
      <button
        key={item.key}
        type="button"
        className="emoji-cell emoji-cell--realm"
        aria-label={`:${item.emoji.shortcode}: from ${item.realmName}`}
        title={`:${item.emoji.shortcode}: · ${item.realmName}`}
        onPointerDown={(event) => beginPress(event, item)}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(event) => {
          event.preventDefault();
          startPreview(item);
        }}
        onClick={() => onCellClick(item)}
      >
        <RealmEmojiImage
          url={item.emoji.url}
          shortcode={item.emoji.shortcode}
          animated={item.emoji.animated}
          className="h-8 w-8"
          imageClassName="max-h-8 max-w-8"
        />
        <RealmBadge item={item} />
      </button>
    );
  };

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
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Find the perfect emoji"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              autoFocus={mode === "reactions"}
            />
            {searchValue && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                onClick={() => setSearchValue("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="emoji-rail shrink-0" role="tablist" aria-label="Emoji categories">
        {railItems.map((item) => {
          const selected = !searching && activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={item.label}
              aria-label={item.label}
              className={cn("emoji-rail__btn", selected && "emoji-rail__btn--active")}
              onClick={() => goToRail(item.id)}
            >
              {item.kind === "recent" ? (
                <Clock3 className="h-4 w-4" aria-hidden="true" />
              ) : item.kind === "realm" ? (
                <RealmRailIcon url={item.iconUrl} name={item.label} />
              ) : (
                <span className="emoji-rail__icon" aria-hidden="true">
                  {item.iconChar}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="rizz-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={handleScroll}
      >
        <div className="relative" style={{ height: STICKY_HEIGHT + totalHeight }}>
          <div className="emoji-section-head emoji-section-head--sticky sticky top-0 z-20 flex h-[34px] items-center justify-between gap-3 px-4">
            <span className="truncate">{activeMeta.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground/70">
              {activeMeta.count}
            </span>
          </div>

          {visibleRows.map((row) => {
            if (row.kind === "header") {
              return (
                <div
                  key={row.key}
                  className="emoji-section-head absolute inset-x-0 top-0 flex h-[30px] items-center justify-between gap-3 px-4"
                  style={{ transform: `translateY(${STICKY_HEIGHT + row.top}px)` }}
                >
                  <span className="truncate">{row.sectionLabel}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground/70">
                    {row.sectionCount}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={row.key}
                className="rizz-emoji-grid absolute inset-x-0 top-0 px-3"
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${STICKY_HEIGHT + row.top}px)`,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {row.items.map(renderCell)}
              </div>
            );
          })}

          {!visibleSections.some((section) => section.items.length > 0) && (
            <div className="absolute inset-x-0 top-[34px] px-6 py-10 text-center text-sm text-muted-foreground">
              {searching
                ? "No emoji match that search."
                : "No custom emoji in your realms yet."}
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div
          className="emoji-preview absolute inset-0 z-50 grid place-items-center bg-black/75 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Emoji preview"
          onClick={() => setPreview(null)}
        >
          <div
            className="emoji-preview__card relative flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#15171a] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
              aria-label="Close preview"
              onClick={() => setPreview(null)}
            >
              <X className="h-4 w-4" />
            </button>
            <PreviewMedia item={preview} />
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-semibold text-foreground">
                {preview.kind === "unicode"
                  ? preview.name
                  : `:${preview.emoji.shortcode}:`}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {preview.kind === "unicode"
                  ? "Unicode emoji"
                  : preview.realmName}
              </p>
            </div>
            <button
              type="button"
              className="mt-1 h-9 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              onClick={() => pick(preview)}
            >
              Insert emoji
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { RizzEmojiPanelProps };
