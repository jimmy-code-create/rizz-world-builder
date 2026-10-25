import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CatEmojiPicker } from "@/components/emoji/CatEmojiPicker";
import { ReactionGlyph, ReactorsSheet } from "@/components/reactions/ReactorsSheet";
import { useAuth } from "@/lib/auth";
import {
  describeReactors,
  fetchItemReactors,
  reactionSourceKey,
  sortReactionGroups,
  QUICK_REACTIONS,
  MORE_REACTIONS,
  type ReactionItemSource,
} from "@/lib/reactions";

const MAX_VISIBLE = 12;
const HOVER_DELAY = 300;
const LONG_PRESS_MS = 450;
const RECENTS_KEY = "rizz:reaction-recents";
const SHORTCODES: Record<string, string> = {
  "❤️": ":heart:",
  "🔥": ":fire:",
  "😂": ":joy:",
  "😮": ":wow:",
  "😢": ":sad:",
  "👏": ":clap:",
  "😍": ":heart_eyes:",
  "🙌": ":raised_hands:",
  "💯": ":100:",
  "🎉": ":tada:",
  "🤔": ":thinking:",
  "💀": ":skull:",
  "✨": ":sparkles:",
  "👀": ":eyes:",
  "🫶": ":heart_hands:",
};

export function reactionShortcode(emoji: string): string {
  if (emoji.startsWith(":") && emoji.endsWith(":")) return emoji;
  return SHORTCODES[emoji] ?? emoji;
}

function readRecents(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function rememberRecent(emoji: string) {
  if (typeof localStorage === "undefined") return;
  try {
    const next = [emoji, ...readRecents().filter((value) => value !== emoji)].slice(0, 6);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable; recents are a nicety.
  }
}

/**
 * The one reaction picker: recents, the six quick reactions, the cat emojis
 * and the wider grid. Shared by the row's add button and the post action row.
 */
export function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [recents, setRecents] = useState<string[]>(readRecents);
  const pick = (emoji: string) => {
    rememberRecent(emoji);
    setRecents(readRecents());
    onPick(emoji);
  };

  return (
    <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
      {recents.length > 0 && (
        <>
          <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Recent
          </p>
          <div className="flex flex-wrap gap-1 pb-2">
            {recents.map((emoji) => (
              <button
                key={`recent-${emoji}`}
                type="button"
                onClick={() => pick(emoji)}
                aria-label={`React with ${reactionShortcode(emoji)}`}
                className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-[var(--overlay-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ReactionGlyph emoji={emoji} size={22} />
              </button>
            ))}
          </div>
        </>
      )}

      <div className={`flex flex-wrap gap-1 ${recents.length > 0 ? "border-t border-border pt-2" : ""}`}>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={`quick-${emoji}`}
            type="button"
            onClick={() => pick(emoji)}
            aria-label={`React with ${emoji}`}
            className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-[var(--overlay-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="text-xl leading-none">{emoji}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 border-t border-border pt-2">
        <CatEmojiPicker size={24} onPick={pick} />
      </div>

      <div className="mt-2 grid grid-cols-8 gap-1 border-t border-border pt-2">
        {MORE_REACTIONS.map((emoji) => (
          <button
            key={`more-${emoji}`}
            type="button"
            onClick={() => pick(emoji)}
            aria-label={`React with ${emoji}`}
            className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-[var(--overlay-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="text-lg leading-none">{emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function canHover() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export type ReactionRowGroup = {
  emoji: string;
  count: number;
  mine: boolean;
  firstAt?: string | null;
};

/**
 * THE reaction row. Posts, comments, realm chat, group chat and DMs all render
 * this component, so a chip looks and behaves the same everywhere.
 *
 * - 32px chips, 44px tap areas, lime tint + border only when you reacted.
 * - Hover (mouse only, 300ms) shows who reacted; long press, right click or the
 *   "+N" chip opens <ReactorsSheet>.
 * - Tapping toggles through the surface's own RPC, optimistically, one request
 *   per emoji at a time; a failure shakes the chip instead of toasting.
 */
export function ReactionRow({
  source,
  groups,
  onToggle,
  align = "left",
  canReact = true,
  hidden = false,
  spacing = "inline",
  pulse = null,
  className = "",
}: {
  source: ReactionItemSource;
  groups: ReactionRowGroup[];
  onToggle: (emoji: string) => Promise<boolean | void> | void;
  align?: "left" | "right";
  canReact?: boolean;
  hidden?: boolean;
  spacing?: "inline" | "overlap" | "below";
  pulse?: { emoji: string; kind: "local" | "remote"; nonce: number } | null;
  className?: string;
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [failedEmoji, setFailedEmoji] = useState<string | null>(null);
  const [bumpEmoji, setBumpEmoji] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheet, setSheet] = useState<{ open: boolean; emoji: string | null }>({ open: false, emoji: null });
  // Mounted on first use only: a channel with 80 reacted messages must not
  // register 80 media-query listeners for sheets nobody opened.
  const [sheetMounted, setSheetMounted] = useState(false);
  const [tip, setTip] = useState<{ emoji: string; count: number; anchor: HTMLElement } | null>(null);

  const sorted = useMemo(() => sortReactionGroups(groups), [groups]);
  const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - visible.length;

  // Never leave the tooltip stuck: scroll, Escape, resize or any outside press
  // dismisses it. Touch never opens it in the first place.
  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", close, true);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", close, true);
    };
  }, [tip]);

  // Someone else reacted to my own message: a small pop, never a burst.
  useEffect(() => {
    if (!pulse?.emoji) return;
    setBumpEmoji(pulse.emoji);
    const timer = window.setTimeout(() => setBumpEmoji(null), 340);
    return () => window.clearTimeout(timer);
  }, [pulse?.nonce, pulse?.emoji]);

  const toggle = useCallback(
    async (emoji: string) => {
      if (!canReact || pending.has(emoji)) return;
      setPending((current) => new Set(current).add(emoji));
      try {
        const result = await onToggle(emoji);
        if (result === false) {
          setFailedEmoji(emoji);
          window.setTimeout(() => setFailedEmoji(null), 320);
          return false;
        }
        rememberRecent(emoji);
        return true;
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(emoji);
          return next;
        });
      }
    },
    [canReact, onToggle, pending],
  );

  const openSheet = useCallback((emoji: string | null) => {
    setSheetMounted(true);
    setSheet({ open: true, emoji });
  }, []);

  // "..." menu > "See reactions" (and anything else) can open this row's sheet
  // without prop-drilling through every surface.
  const sourceKey = reactionSourceKey(source);
  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key && detail.key === sourceKey) openSheet(null);
    };
    window.addEventListener("rizz:open-reactors", onRequest as EventListener);
    return () => window.removeEventListener("rizz:open-reactors", onRequest as EventListener);
  }, [sourceKey, openSheet]);

  if (hidden) return null;
  // The row only exists once someone reacted.
  if (!sorted.length) return null;

  const spacingClass =
    spacing === "overlap" ? "-mt-1.5" : spacing === "below" ? "mt-2" : "mt-1.5";

  return (
    <>
      <div
        className={`relative z-10 flex flex-wrap items-center gap-1 ${spacingClass} ${
          align === "right" ? "justify-end" : "justify-start"
        } ${className}`}
        data-reaction-row=""
      >
        {visible.map((group) => (
          <ReactionChip
            key={group.emoji}
            emoji={group.emoji}
            count={group.count}
            mine={group.mine}
            source={source}
            disabled={!canReact}
            pending={pending.has(group.emoji)}
            failed={failedEmoji === group.emoji}
            bump={bumpEmoji === group.emoji}
            onToggle={() => toggle(group.emoji)}
            onOpenSheet={() => openSheet(group.emoji)}
            onHover={(anchor) =>
              setTip((current) =>
                current?.emoji === group.emoji ? current : { emoji: group.emoji, count: group.count, anchor },
              )
            }
            onLeave={() => setTip((current) => (current?.emoji === group.emoji ? null : current))}
          />
        ))}

        {overflow > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={`Show ${overflow} more reaction${overflow === 1 ? "" : "s"}`}
            className="relative inline-flex h-8 shrink-0 select-none items-center rounded-lg border border-transparent bg-[var(--overlay-hover)] px-2 text-sm font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-[var(--overlay-active)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']"
          >
            +{overflow}
          </button>
        )}

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add reaction"
              title="Add reaction"
              onClick={(event) => event.stopPropagation()}
              className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--overlay-hover)] text-muted-foreground transition-colors hover:bg-[var(--overlay-active)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:-inset-y-1.5 after:inset-0 after:content-['']"
            >
              <SmilePlus className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align={align === "right" ? "end" : "start"}
            className="w-[min(20rem,calc(100vw-2rem))] p-2"
            onClick={(event) => event.stopPropagation()}
          >
            <ReactionPicker
              onPick={(emoji) => {
                setPickerOpen(false);
                void toggle(emoji);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {sheetMounted && (
        <ReactorsSheet
          open={sheet.open}
          onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
          source={source}
          groups={sorted.map((group) => ({ emoji: group.emoji, count: group.count }))}
          initialEmoji={sheet.emoji}
          onToggle={(emoji) => toggle(emoji)}
        />
      )}

      {tip && typeof document !== "undefined" && (
        <ReactionTooltip
          emoji={tip.emoji}
          count={tip.count}
          anchor={tip.anchor}
          sourceKey={reactionSourceKey(source)}
          source={source}
          viewerId={user?.id ?? null}
        />
      )}
    </>
  );
}

/** Hover/focus tooltip: the emoji, its shortcode and who reacted, in one line. */
function ReactionTooltip({
  emoji,
  count,
  anchor,
  source,
  sourceKey,
  viewerId,
}: {
  emoji: string;
  count: number;
  anchor: HTMLElement;
  source: ReactionItemSource;
  sourceKey: string;
  viewerId: string | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["reaction-people", sourceKey, emoji],
    queryFn: () => fetchItemReactors(source, { emoji, viewerId }),
    staleTime: 60_000,
  });

  useLayoutEffect(() => {
    const place = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = anchor.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      let top = rect.top - height - 8;
      if (top < 8) top = rect.bottom + 8;
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
      setPosition({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor, data, isLoading]);

  const names = (data ?? []).map((person) => (person.userId === viewerId ? "You" : person.name)).slice(0, 3);
  const summary = isLoading ? "Loading…" : describeReactors(names, data?.length ?? count);

  return createPortal(
    <div
      ref={panelRef}
      role="tooltip"
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        opacity: position ? 1 : 0,
      }}
      className="pointer-events-none z-[300] flex max-w-[min(18rem,calc(100vw-1rem))] items-center gap-2.5 rounded-xl border border-border bg-popover p-3 shadow-[var(--shadow-2)]"
    >
      <ReactionGlyph emoji={emoji} size={32} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">{reactionShortcode(emoji)}</p>
        <p className="truncate text-xs leading-snug text-muted-foreground">{summary}</p>
      </div>
    </div>,
    document.body,
  );
}

function ReactionChip({
  emoji,
  count,
  mine,
  source,
  disabled,
  pending,
  failed,
  bump,
  onToggle,
  onOpenSheet,
  onHover,
  onLeave,
}: {
  emoji: string;
  count: number;
  mine: boolean;
  source: ReactionItemSource;
  disabled: boolean;
  pending: boolean;
  failed: boolean;
  bump: boolean;
  onToggle: () => Promise<boolean | void>;
  onOpenSheet: () => void;
  onHover: (anchor: HTMLElement) => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const hoverTimer = useRef<number | null>(null);

  const clearPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  };
  const clearHover = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };

  useEffect(
    () => () => {
      clearPress();
      clearHover();
    },
    [],
  );

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={mine}
      aria-disabled={disabled || pending}
      aria-label={`${reactionShortcode(emoji)} ${count}`}
      data-source={source.kind}
      style={
        mine
          ? {
              background: "var(--overlay-selected)",
              borderColor: "color-mix(in srgb, var(--primary) 45%, transparent)",
              color: "var(--primary)",
            }
          : undefined
      }
      className={`relative inline-flex h-8 shrink-0 select-none items-center gap-1.5 rounded-lg px-2 leading-none transition-colors active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] ${
        mine
          ? "border"
          : "border border-transparent bg-[var(--overlay-hover)] text-foreground hover:bg-[var(--overlay-active)]"
      } ${failed ? "reaction-shake" : ""} ${bump ? "reaction-bump" : ""}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        longPressed.current = false;
        pressStart.current = { x: event.clientX, y: event.clientY };
        if (pressTimer.current) window.clearTimeout(pressTimer.current);
        pressTimer.current = window.setTimeout(() => {
          pressTimer.current = null;
          longPressed.current = true;
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            try {
              navigator.vibrate(20);
            } catch {
              // Haptics are a bonus.
            }
          }
          onOpenSheet();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(event) => {
        const start = pressStart.current;
        if (!start) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) clearPress();
      }}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch" || !canHover()) return;
        clearHover();
        hoverTimer.current = window.setTimeout(() => {
          if (ref.current) onHover(ref.current);
        }, HOVER_DELAY);
      }}
      onPointerLeave={() => {
        clearHover();
        clearPress();
        onLeave();
      }}
      onFocus={() => {
        if (!canHover()) return;
        clearHover();
        hoverTimer.current = window.setTimeout(() => {
          if (ref.current) onHover(ref.current);
        }, HOVER_DELAY);
      }}
      onBlur={() => {
        clearHover();
        onLeave();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenSheet();
      }}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        void onToggle();
      }}
    >
      <ReactionGlyph emoji={emoji} size={20} />
      <span
        key={count}
        className="text-sm font-semibold tabular-nums reaction-count-roll"
      >
        {count}
      </span>
    </button>
  );
}

export default ReactionRow;
