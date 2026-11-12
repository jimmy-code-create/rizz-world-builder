import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
} from "react";
import { Clock3, Loader2, Plus, Search, Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EMOJI_CATEGORIES,
  EMOJI_DATA,
  searchUnicodeEmoji,
  type EmojiEntry,
} from "@/lib/emoji-data";
import { emojiToken, readRecentEmoji, searchEmoji, type SharedEmoji } from "@/lib/emoji-shared";
import { recordEmojiUse, useEmojiPreferences } from "@/lib/emoji-recents";
import { RealmEmojiImage } from "@/components/emoji/RealmEmojiImage";
import { FluentEmoji } from "@/components/emoji/FluentEmoji";
import { useAvailableEmojis, useSavePrivateEmoji } from "@/lib/emoji-available";
import { buildEmojiRealmSections } from "@/lib/emoji-realms";
import { parseEmojiToken } from "@/lib/emoji-token";
import { toast } from "@/lib/toast";

/**
 * The emoji tab used by the composer sheet.
 *
 * One rule shapes everything here: the list is the same in a DM, in a realm and
 * in the feed composer. It comes from `/api/emojis/available`, which is asked
 * without a realm id, so the picker has no idea where it was opened and does
 * not need to.
 *
 * Layout: one header per section, sticky on the real header (no second overlay
 * header — that was drawing "RECENT 4" twice). Rows are virtualised per
 * section, so a 900-glyph unicode tab still mounts only what is on screen, and
 * every custom emoji sits in the same square cell with `object-fit: contain`,
 * which is what a tall screenshot needs to look like an emoji.
 */

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
  kind: "recent" | "private" | "realm" | "category" | "search";
  items: EmojiItem[];
  iconUrl?: string | null;
  iconChar?: string;
};

type RailItem = {
  id: string;
  label: string;
  kind: "recent" | "private" | "realm" | "category";
  iconUrl?: string | null;
  iconChar?: string;
};

type SectionLayout = {
  section: EmojiSection;
  top: number;
  rows: number;
  height: number;
};

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 32;
const STICKY_HEIGHT = HEADER_HEIGHT;
const OVERSCAN = 2;
const CUSTOM_TOKEN = /^<a?:([A-Za-z0-9_]+):([0-9a-fA-F-]{36})>$/;
const CUSTOM_ID = /^[0-9a-fA-F-]{36}$/;

export function rememberEmojiPick(emoji: EmojiInput, realmId?: string): void {
  const token =
    typeof emoji === "string"
      ? emoji
      : emoji.native ||
        emoji.unicode ||
        (emoji.id ? (emoji.shortcode ? `<:${emoji.shortcode}:${emoji.id}>` : emoji.id) : "");
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

// The unicode catalog is static. Building it once at module scope keeps the
// sheet's first paint free of ~1,000 object allocations on every open (the
// sheet unmounts when closed, so a component `useMemo` only cached one visit).
const UNICODE_BY_CHAR = new Map(EMOJI_DATA.map((entry) => [entry.char, entry]));
const UNICODE_SECTIONS: EmojiSection[] = EMOJI_CATEGORIES.filter(
  (category) => category.id !== "flags",
).map((category) => ({
  id: `unicode-${category.id}`,
  label: category.label,
  kind: "category" as const,
  items: EMOJI_DATA.filter((entry) => entry.category === category.category).map(unicodeItem),
  iconChar: category.icon,
}));

function realmItem(emoji: SharedEmoji, realmIcon: string | null): RealmItem {
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
    <span className="emoji-cell__badge" title={item.realmName} aria-hidden="true">
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
        <FluentEmoji glyph={item.char} size={96} priority />
      </span>
    );
  }
  return (
    <RealmEmojiImage
      url={item.emoji.url}
      shortcode={item.emoji.shortcode}
      animated={item.emoji.animated}
      eager
      className="emoji-media h-32 w-32"
      imageClassName="h-32 w-32 object-contain"
    />
  );
}

/** A square cell for one custom emoji: never cropped, never tiny. */
function EmojiCellImage({ emoji }: { emoji: SharedEmoji }) {
  return (
    <RealmEmojiImage
      url={emoji.url}
      shortcode={emoji.shortcode}
      animated={emoji.animated}
      className="emoji-media"
      imageClassName="object-contain"
    />
  );
}

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
  onManage,
}: RizzEmojiPanelProps) {
  // ONE source in every context. A DM has no realm id; the answer must not
  // depend on where the sheet was opened, so nothing here reads the route.
  const available = useAvailableEmojis();
  const prefs = useEmojiPreferences();
  const savePrivate = useSavePrivateEmoji();

  const [localQuery, setLocalQuery] = useState("");
  const controlledSearch = query !== undefined;
  const searchValue = controlledSearch ? (query ?? "") : localQuery;
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
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const [naming, setNaming] = useState<{ url: string; file: File } | null>(null);
  const [name, setName] = useState("");

  /** id -> row, for recents and search, from the one cached list. */
  const emojiById = useMemo(() => {
    const map = new Map<string, SharedEmoji>();
    const payload = available.data;
    if (!payload) return map;
    for (const emoji of payload.private) {
      map.set(emoji.id, {
        id: emoji.id,
        realm_id: "",
        realm_name: "Private",
        realm_slug: "",
        shortcode: emoji.name,
        url: emoji.url,
        animated: Boolean(emoji.animated),
        external: true,
      });
    }
    for (const realm of payload.realms) {
      for (const emoji of realm.emojis) {
        map.set(emoji.id, {
          id: emoji.id,
          realm_id: realm.id,
          realm_name: realm.name,
          realm_slug: "",
          shortcode: emoji.name,
          url: emoji.url,
          animated: Boolean(emoji.animated),
          external: true,
        });
      }
    }
    return map;
  }, [available.data]);

  /**
   * Realm sections, empty ones removed. A realm with no custom emoji is not a
   * useful rail stop (that was the "shows 0" complaint); Private and the
   * unicode categories stay even when empty.
   */
  const realmSections = useMemo(() => {
    const payload = available.data;
    if (!payload) return [];
    const rows: SharedEmoji[] = [];
    for (const emoji of payload.private) {
      rows.push({
        id: emoji.id,
        realm_id: "",
        realm_name: "Private",
        realm_slug: "",
        shortcode: emoji.name,
        url: emoji.url,
        animated: Boolean(emoji.animated),
        external: true,
      });
    }
    for (const realm of payload.realms) {
      for (const emoji of realm.emojis) {
        rows.push({
          id: emoji.id,
          realm_id: realm.id,
          realm_name: realm.name,
          realm_slug: "",
          shortcode: emoji.name,
          url: emoji.url,
          animated: Boolean(emoji.animated),
          external: true,
        });
      }
    }
    const realms = payload.realms.map((realm) => ({
      id: realm.id,
      name: realm.name,
      slug: "",
      icon_url: realm.iconUrl,
    }));
    return buildEmojiRealmSections(rows, realms, realmId ?? null).filter(
      (section) => section.emoji.length > 0,
    );
  }, [available.data, realmId]);

  const privateRows = useMemo(
    () => realmSections.filter((section) => section.id === "").flatMap((section) => section.emoji),
    [realmSections],
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
      return;
    };

    // Recents are stored as `{ id, name, url }`-resolvable tokens, so they work
    // in every context — including an emoji from another realm, or a private
    // one, while the list itself is still loading.
    const recentTokens = [...prefs.recents, ...readRecentEmoji()];
    for (const token of recentTokens) {
      if (typeof token !== "string" || !token) continue;
      if (recentItems.length >= 32) break;
      const parsed = parseEmojiToken(token) ?? CUSTOM_TOKEN.exec(token);
      const id = parsed
        ? Array.isArray(parsed)
          ? parsed[2]
          : parsed.id
        : CUSTOM_ID.test(token)
          ? token
          : "";
      if (id) {
        const row = emojiById.get(id);
        if (row) pushRecent(realmItem(row, realmById.get(row.realm_id)?.icon ?? null));
        continue;
      }
      if (token.startsWith("ce:")) {
        const row = emojiById.get(token.slice(3));
        if (row) pushRecent(realmItem(row, realmById.get(row.realm_id)?.icon ?? null));
        continue;
      }
      const unicode = UNICODE_BY_CHAR.get(token);
      if (unicode) pushRecent(unicodeItem(unicode));
    }

    const realmSectionsForPanel: EmojiSection[] = realmSections
      .filter((section) => section.id !== "")
      .map((section) => ({
        id: section.id,
        label: section.name,
        kind: "realm" as const,
        items: section.emoji.map((emoji) => realmItem(emoji, section.iconUrl)),
        iconUrl: section.iconUrl,
      }));

    return [
      { id: "recent", label: "Recent", kind: "recent", items: recentItems },
      {
        id: "private",
        label: "Private",
        kind: "private",
        items: privateRows.map((emoji) => realmItem(emoji, null)),
      },
      ...realmSectionsForPanel,
      ...UNICODE_SECTIONS,
    ];
  }, [emojiById, prefs.recents, privateRows, realmById, realmSections]);

  // Searching the full Unicode catalogue is the only part of the sheet that
  // does real work on every keystroke. The field stays instant; the result set
  // can follow one frame later.
  const deferredSearch = useDeferredValue(searchValue);
  const trimmedQuery = deferredSearch.trim();
  const searching = trimmedQuery.length > 0;

  const searchSection = useMemo<EmojiSection | null>(() => {
    if (!searching) return null;
    const hits = searchEmoji(
      realmSections.flatMap((section) => section.emoji),
      trimmedQuery,
    )
      .slice(0, 120)
      .map((row) => realmItem(row, realmById.get(row.realm_id)?.icon ?? null));
    const unicodeHits = searchUnicodeEmoji(trimmedQuery, 180)
      .filter((entry) => entry.category !== "Flags")
      .map(unicodeItem);
    return {
      id: "search",
      label: "Search results",
      kind: "search",
      items: [...hits, ...unicodeHits],
    };
  }, [realmById, realmSections, searching, trimmedQuery]);

  /** Search replaces the sections; an empty query restores them. */
  const visibleSections = useMemo<EmojiSection[]>(() => {
    if (searchSection) return searchSection.items.length ? [searchSection] : [];
    // Private stays visible even when empty: it is where "add your own" lives.
    return sections.filter(
      (section) =>
        section.items.length > 0 || section.id === "private" || section.kind === "category",
    );
  }, [searchSection, sections]);

  const railItems = useMemo<RailItem[]>(() => {
    const realms: RailItem[] = realmSections
      .filter((section) => section.id !== "")
      .map((section) => ({
        id: section.id,
        label: section.name,
        kind: "realm" as const,
        iconUrl: section.iconUrl,
      }));
    const categories: RailItem[] = EMOJI_CATEGORIES.filter(
      (category) => category.id !== "flags",
    ).map((category) => ({
      id: `unicode-${category.id}`,
      label: category.label,
      kind: "category" as const,
      iconChar: category.icon,
    }));
    return [
      { id: "recent", label: "Recent", kind: "recent" },
      { id: "private", label: "Private", kind: "private" },
      ...realms,
      ...categories,
    ];
  }, [realmSections]);

  const columns = viewport.width >= 540 ? 9 : 8;

  /** Section offsets, measured from fixed row heights (flow layout). */
  const layout = useMemo<SectionLayout[]>(() => {
    const next: SectionLayout[] = [];
    let top = 0;
    for (const section of visibleSections) {
      const rows = Math.max(1, Math.ceil(section.items.length / columns));
      const height = HEADER_HEIGHT + rows * ROW_HEIGHT;
      next.push({ section, top, rows, height });
      top += height;
    }
    return next;
  }, [columns, visibleSections]);

  const totalHeight = layout.length
    ? layout[layout.length - 1].top + layout[layout.length - 1].height
    : 0;

  const activeMeta = useMemo(() => {
    if (searchSection) {
      return { label: "Search results", count: searchSection.items.length, id: "search" };
    }
    const hit = layout.find((entry) => entry.section.id === activeSection) ?? layout[0];
    return {
      label: hit?.section.label ?? "Emoji",
      count: hit?.section.items.length ?? 0,
      id: hit?.section.id ?? "recent",
    };
  }, [activeSection, layout, searchSection]);

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
      let current = layout[0];
      for (const entry of layout) {
        if (entry.top <= probe) current = entry;
        else break;
      }
      if (current && current.section.id !== activeSection) setActiveSection(current.section.id);
    },
    [activeSection, layout],
  );

  useEffect(() => {
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
      const entry = layout.find((item) => item.section.id === section);
      if (!element || !entry) return;
      element.scrollTo({ top: Math.max(0, entry.top), behavior: "smooth" });
      setActiveSection(section);
    },
    [layout],
  );

  useEffect(() => {
    if (searching || !pendingRail.current) return;
    const target = pendingRail.current;
    pendingRail.current = null;
    scrollToSection(target);
  }, [layout, scrollToSection, searching]);

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
      // A pending (not yet saved) emoji has a blob url and no usable id; the
      // token only makes sense once the server has assigned one.
      if (item.kind === "realm" && item.emoji.id.startsWith("pending-")) {
        toast.info("That emoji is still uploading.");
        return;
      }
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

  /* ------------------------------------------------------- private upload */

  const choosePrivate = (file: File | null | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
      toast.error("Emoji must be a PNG, JPG, GIF or WebP image.");
      return;
    }
    if (file.size > 256 * 1024) {
      toast.error("That image is larger than 256 KB — shrink it and try again.");
      return;
    }
    // Local preview at once; the picker shows the file we already have.
    setNaming({ url: URL.createObjectURL(file), file });
    setName("");
  };

  const submitPrivate = () => {
    if (!naming) return;
    const clean = name.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,32}$/.test(clean)) {
      toast.error("Names use a-z, 0-9 and _ (2 to 32 characters)");
      return;
    }
    const { file, url } = naming;
    setNaming(null);
    savePrivate.mutate(
      { file, name: clean },
      {
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Couldn't add that emoji"),
        onSuccess: () => toast.success(`:${clean}: added`),
      },
    );
    URL.revokeObjectURL(url);
  };

  /* ------------------------------------------------------------- render */

  const windowStart = viewport.top - OVERSCAN * ROW_HEIGHT;
  const windowEnd = viewport.top + viewport.height + OVERSCAN * ROW_HEIGHT;

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
          <span className="emoji-cell__glyph" aria-hidden="true">
            <FluentEmoji glyph={item.char} size={30} />
          </span>
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
        <EmojiCellImage emoji={item.emoji} />
        {item.realmId ? <RealmBadge item={item} /> : null}
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
              className="h-10 w-full rounded-[10px] border border-white/[0.08] bg-white/[0.04] pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-white/25"
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

      <div className="flex min-h-0 flex-1">
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
              ) : item.kind === "private" ? (
                <Smile className="h-4 w-4" aria-hidden="true" />
              ) : item.kind === "realm" ? (
                <RealmRailIcon url={item.iconUrl} name={item.label} />
              ) : (
                <span className="emoji-rail__icon" aria-hidden="true">
                  <FluentEmoji glyph={item.iconChar ?? "😀"} size={20} />
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
        <div style={{ height: totalHeight }}>
          {layout.map((entry) => {
            if (entry.top + entry.height < windowStart || entry.top > windowEnd) {
              // Keep the section's box so the scrollbar does not jump, but do
              // not mount a single cell of it.
              return (
                <div key={entry.section.id} style={{ height: entry.height }} aria-hidden="true" />
              );
            }
            const startRow = Math.max(
              0,
              Math.floor((windowStart - entry.top - HEADER_HEIGHT) / ROW_HEIGHT),
            );
            const endRow = Math.min(
              entry.rows,
              Math.ceil((windowEnd - entry.top - HEADER_HEIGHT) / ROW_HEIGHT) + 1,
            );
            const items = entry.section.items;
            const rows = chunk(items, columns).slice(startRow, endRow);
            const isPrivate = entry.section.kind === "private";
            if (isPrivate && !items.length) {
              return (
                <section key={entry.section.id} className="emoji-section">
                  <div className="emoji-section-head sticky top-0 z-20">
                    <span className="truncate">{entry.section.label}</span>
                    <button
                      type="button"
                      onClick={() => addInputRef.current?.click()}
                      className="emoji-section-add"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => addInputRef.current?.click()}
                    className="m-3 flex w-[calc(100%-1.5rem)] items-center gap-2.5 rounded-[10px] border border-dashed border-white/15 px-3 py-3 text-left text-[11px] leading-tight text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="block font-semibold text-foreground">Add your own emoji</span>
                      Use it in every chat, caption and comment.
                    </span>
                  </button>
                </section>
              );
            }
            return (
              <section key={entry.section.id} className="emoji-section">
                {/* One header per section, sticky on the real header. */}
                <div className="emoji-section-head sticky top-0 z-20">
                  <span className="truncate">{entry.section.label}</span>
                  {isPrivate ? (
                    <span className="flex shrink-0 items-center gap-1">
                      {onManage ? (
                        <button
                          type="button"
                          onClick={onManage}
                          className="emoji-section-manage"
                        >
                          Manage
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => addInputRef.current?.click()}
                        className="emoji-section-add"
                      >
                        <Plus className="h-3 w-3" /> Add
                      </button>
                    </span>
                  ) : (
                    <span className="shrink-0 tabular-nums text-muted-foreground/60">
                      {items.length}
                    </span>
                  )}
                </div>
                <div
                  className="relative"
                  style={{ height: Math.max(0, entry.height - HEADER_HEIGHT) }}
                >
                  {rows.map((row, index) => (
                    <div
                      key={`${entry.section.id}:${startRow + index}`}
                      className="rizz-emoji-grid absolute inset-x-0 px-2"
                      style={{
                        height: ROW_HEIGHT,
                        top: (startRow + index) * ROW_HEIGHT,
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      }}
                    >
                      {row.map(renderCell)}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {!visibleSections.length && (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              {searching ? "No emoji match that search." : "No custom emoji yet."}
            </div>
          )}
        </div>
      </div>
      </div>

      <input
        ref={addInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        aria-label="Choose an emoji image"
        onChange={(event) => {
          choosePrivate(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />

      {naming && (
        <div
          className="absolute inset-0 z-50 grid place-items-center bg-black/75 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Name your emoji"
        >
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#15171a] p-5 shadow-2xl">
            <img src={naming.url} alt="" className="h-20 w-20 rounded-xl object-contain" />
            <input
              value={name}
              onChange={(event) => setName(event.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
              placeholder="name (a-z, 0-9, _)"
              maxLength={32}
              autoFocus
              className="h-10 w-full rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-sm outline-none focus:border-white/25"
            />
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(naming.url);
                  setNaming(null);
                }}
                className="h-9 flex-1 rounded-full border border-white/10 text-xs font-semibold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPrivate}
                disabled={savePrivate.isPending}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {savePrivate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save emoji
              </button>
            </div>
          </div>
        </div>
      )}

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
                {preview.kind === "unicode" ? preview.name : `:${preview.emoji.shortcode}:`}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {preview.kind === "unicode" ? "Unicode emoji" : preview.realmName}
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

      {/* The active section's count, for screen readers only: the visual
          header is the section's own, never a second overlay row. */}
      <span className="sr-only" aria-live="polite">
        {activeMeta.label} {activeMeta.count}
      </span>
    </div>
  );
}

export type { RizzEmojiPanelProps };
