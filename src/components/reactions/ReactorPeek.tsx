import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchBlocked } from "@/lib/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Who reacted — one shared popover for every reaction chip in the app.
 *
 * Behaviour, per the design review:
 *  - ~250ms hover delay before it appears; once it is open, moving between
 *    chips swaps the content instantly (no flicker, no second timer).
 *  - Keyboard focus opens it too, and it is a real `role="tooltip"` wired up
 *    with `aria-describedby`.
 *  - Touch: a long press opens it; a normal tap still toggles your reaction.
 *  - Data is fetched lazily on first look, cached per item + emoji, kept fresh
 *    by a realtime subscription while it is open, and blocked users are hidden.
 *  - It sits above the chip by default, flips below when there is no room, is
 *    clamped to the viewport, and is pushed below chips that sit over a composer.
 */

export type Reactor = { userId: string; name: string; avatarUrl?: string | null };

export type ReactorSource =
  | { kind: "post"; id: string }
  | { kind: "comment"; id: string }
  | { kind: "message"; id: string }
  /** Reactors already in the payload — nothing to fetch (chat does this). */
  | { kind: "known"; reactors: Reactor[] };

export type ReactionTarget = { emoji: string; count: number; source: ReactorSource };

const TABLE = {
  post: "post_reactions",
  comment: "comment_reactions",
  message: "message_reactions",
} as const;

const ID_COLUMN = {
  post: "post_id",
  comment: "comment_id",
  message: "message_id",
} as const;

const MAX_SHOWN = 10;
const HOVER_DELAY = 250;
const LONG_PRESS_DELAY = 420;

const REACTION_NAMES: Record<string, string> = {
  "❤️": "Love",
  "😂": "Haha",
  "🔥": "Fire",
  "👍": "Nice",
  "😮": "Wow",
  "😢": "Sad",
  "🙏": "Thanks",
  "💀": "Gone",
  "✨": "Sparkle",
  "👏": "Applause",
  "🧠": "Big brain",
  "🎧": "Listening",
};

export function reactionName(emoji: string) {
  return REACTION_NAMES[emoji] ?? "Reaction";
}

function keyOf(target: ReactionTarget | null): string {
  if (!target) return "";
  const id = target.source.kind === "known" ? "known" : target.source.id;
  return `${target.source.kind}:${id}:${target.emoji}`;
}

type PeekContextValue = {
  open: (target: ReactionTarget, anchor: HTMLElement, immediate: boolean) => void;
  close: () => void;
  isOpen: boolean;
  describedBy: (key: string) => string | undefined;
};

const PeekContext = createContext<PeekContextValue | null>(null);

export function ReactorPeekProvider({ children }: { children: ReactNode }) {
  const tooltipId = useId();
  const [peek, setPeek] = useState<{ target: ReactionTarget; anchor: HTMLElement } | null>(null);
  const [placement, setPlacement] = useState<CSSProperties>({ opacity: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(
    (target: ReactionTarget, anchor: HTMLElement, immediate: boolean) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (immediate || peek) setPeek({ target, anchor });
      else timerRef.current = setTimeout(() => setPeek({ target, anchor }), HOVER_DELAY);
    },
    [peek],
  );

  const close = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPeek(null);
  }, []);

  // Outside press and Escape both dismiss the peek.
  useEffect(() => {
    if (!peek) return;
    const onDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (panelRef.current?.contains(node) || peek.anchor.contains(node)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [peek, close]);

  // Position: above by default, below when there is no room, clamped sideways.
  useEffect(() => {
    if (!peek) return;
    const place = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = peek.anchor.getBoundingClientRect();
      const height = panel.offsetHeight;
      const width = panel.offsetWidth;
      const margin = 8;
      // A chip in the bottom strip of the screen is sitting over the composer:
      // always render below it so nothing covers the input.
      const overComposer = window.innerHeight - rect.bottom < 140;
      const fitsAbove = rect.top - height - margin > margin;
      const below = overComposer || !fitsAbove;
      const top = below ? rect.bottom + margin : rect.top - height - margin;
      const left = Math.min(
        Math.max(margin, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - margin,
      );
      setPlacement({ opacity: 1, top, left, position: "fixed" });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [peek]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const value: PeekContextValue = {
    open,
    close,
    isOpen: !!peek,
    describedBy: (key) => (peek && keyOf(peek.target) === key ? tooltipId : undefined),
  };

  return (
    <PeekContext.Provider value={value}>
      {children}
      {peek && (
        <div
          ref={panelRef}
          id={tooltipId}
          role="tooltip"
          style={placement}
          className="pointer-events-none fixed z-[300] w-[min(20rem,calc(100vw-1rem))] rounded-[10px] border border-border bg-popover p-3 shadow-[var(--shadow-2)] transition-opacity duration-150"
        >
          <PeekBody target={peek.target} />
        </div>
      )}
    </PeekContext.Provider>
  );
}

function PeekBody({ target }: { target: ReactionTarget }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useReactorList(target);
  const known = target.source.kind === "known" ? target.source.reactors : null;

  // Realtime: any change to this item's reactions refreshes the list while the
  // peek is open, so it never goes stale behind a fast-moving thread.
  useEffect(() => {
    if (target.source.kind === "known" || !user) return;
    const kind = target.source.kind;
    const id = target.source.id;
    const channel = supabase
      .channel(`reactors-${kind}-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE[kind], filter: `${ID_COLUMN[kind]}=eq.${id}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["reactors", kind, id, target.emoji] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [target.source, target.emoji, user, qc]);

  const reactors = known ?? data?.reactors ?? [];
  const total = known ? known.length : data?.total ?? target.count;
  const shown = reactors.slice(0, MAX_SHOWN);
  const others = Math.max(0, total - shown.length);

  return (
    <>
      <p className="flex items-center gap-2 pb-2">
        <span aria-hidden className="text-xl leading-none">
          {target.emoji}
        </span>
        <span className="font-display text-sm font-semibold">{reactionName(target.emoji)}</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{total}</span>
      </p>
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {isLoading && !known
          ? [0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-2 py-1">
                <span className="skeleton-shimmer h-6 w-6 shrink-0 rounded-full" />
                <span className="skeleton-shimmer h-3 w-24 rounded-full" />
              </div>
            ))
          : shown.map((reactor) => {
              const isYou = reactor.userId === user?.id;
              return (
                <div key={reactor.userId} className="flex items-center gap-2 py-0.5">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={reactor.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-secondary text-[10px] font-semibold">
                      {reactor.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {isYou ? "You" : reactor.name}
                  </span>
                </div>
              );
            })}
        {!isLoading && shown.length === 0 && (
          <p className="py-1 text-xs text-muted-foreground">No one yet — be the first.</p>
        )}
      </div>
      {others > 0 && (
        <p className="pt-2 text-[11px] text-muted-foreground">and {others} other{others === 1 ? "" : "s"}</p>
      )}
    </>
  );
}

function useReactorList(target: ReactionTarget) {
  const { user } = useAuth();
  const kind = target.source.kind;
  const id = kind === "known" ? "" : target.source.id;
  return useQuery({
    queryKey: ["reactors", kind, id, target.emoji, user?.id],
    enabled: kind !== "known" && !!user,
    staleTime: 15_000,
    queryFn: async (): Promise<{ total: number; reactors: Reactor[] }> => {
      if (kind === "known") return { total: target.count, reactors: [] };
      const { data, error } = await (supabase.from as any)(TABLE[kind])
        .select("user_id, created_at")
        .eq(ID_COLUMN[kind], id)
        .eq("emoji", target.emoji)
        .order("created_at", { ascending: true })
        .limit(60);
      if (error) throw error;
      const rows = (data ?? []) as { user_id: string }[];
      const blockedRows = user ? await fetchBlocked(user.id) : [];
      const blocked = new Set(blockedRows.map((row: { blocked_id: string }) => row.blocked_id));
      const ids = [...new Set(rows.map((row) => row.user_id))].filter((userId) => !blocked.has(userId));
      const ordered = ids.slice().sort((a, b) => {
        if (a === user?.id) return -1;
        if (b === user?.id) return 1;
        return 0;
      });
      if (ordered.length === 0) return { total: 0, reactors: [] };
      const { data: people, error: peopleError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ordered.slice(0, MAX_SHOWN));
      if (peopleError) throw peopleError;
      const byId = new Map(
        ((people ?? []) as { id: string; username: string | null; display_name: string | null; avatar_url: string | null }[]).map(
          (person) => [person.id, person],
        ),
      );
      const reactors: Reactor[] = ordered.slice(0, MAX_SHOWN).map((userId) => {
        const person = byId.get(userId);
        return {
          userId,
          name: person?.display_name || person?.username || "Someone",
          avatarUrl: person?.avatar_url,
        };
      });
      return { total: ids.length, reactors };
    },
  });
}

/**
 * Attach to any reaction chip. Spread `triggerProps` onto the chip element and
 * wrap its click handler in `guardClick` so a long press that opened the peek
 * does not also toggle the reaction.
 */
export function useReactorPeek(target: ReactionTarget | null) {
  const ctx = useContext(PeekContext);
  const anchorRef = useRef<HTMLElement | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekedRef = useRef(false);
  const key = keyOf(target);

  const clearLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  if (!ctx || !target) {
    return {
      anchorRef,
      triggerProps: {},
      describedBy: undefined,
      openNow: undefined,
      close: undefined,
      guardClick: (fn: () => void) => fn,
    };
  }

  const show = (immediate: boolean) => {
    const node = anchorRef.current;
    if (node) ctx.open(target, node, immediate || ctx.isOpen);
  };

  return {
    anchorRef,
    describedBy: ctx.describedBy(key),
    /** Opens straight away — used by surfaces that run their own long-press. */
    openNow: () => show(true),
    close: () => ctx.close(),
    triggerProps: {
      onPointerEnter: (event: ReactPointerEvent) => {
        if (event.pointerType === "touch") return;
        show(false);
      },
      onPointerLeave: (event: ReactPointerEvent) => {
        if (event.pointerType === "touch") return;
        ctx.close();
      },
      onFocus: () => show(true),
      onBlur: () => ctx.close(),
      onTouchStart: () => {
        clearLongPress();
        longPressRef.current = setTimeout(() => {
          peekedRef.current = true;
          show(true);
        }, LONG_PRESS_DELAY);
      },
      onTouchEnd: clearLongPress,
      onTouchMove: clearLongPress,
      onTouchCancel: clearLongPress,
    },
    guardClick: (fn: () => void) => () => {
      if (peekedRef.current) {
        peekedRef.current = false;
        return;
      }
      fn();
    },
  };
}

export default ReactorPeekProvider;
