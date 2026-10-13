import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useAuth } from "@/lib/auth";
import { fetchReactorProfiles, reactorsQueryKey, type ReactionGroup, type ReactionScope } from "@/lib/reactions";
import { reactionHaptic, triggerReactionBurst, triggerBurstOnElement } from "@/components/chat/ReactionBurst";
import type { ReactionPulse } from "@/lib/useChatReactions";

export type { ReactionPulse };

const EMOJI_NAMES: Record<string, string> = {
  "❤️": "heart",
  "🔥": "fire",
  "😂": "joy",
  "😮": "surprised",
  "😢": "cry",
  "👏": "applause",
  "😍": "heart eyes",
  "🙌": "raising hands",
  "💯": "hundred",
  "🥹": "pleading",
  "🎉": "tada",
  "🤔": "thinking",
  "😭": "loudly crying",
  "😅": "sweat smile",
  "🤣": "rofl",
  "😎": "cool",
  "🥰": "smiling with hearts",
  "😳": "flushed",
  "🙈": "see no evil",
  "💀": "skull",
  "👀": "eyes",
  "✨": "sparkles",
  "💖": "sparkling heart",
  "🤝": "handshake",
  "👑": "crown",
  "🫶": "heart hands",
  "🤯": "mind blown",
  "😴": "sleeping",
  "🤢": "nauseated",
  "🖤": "black heart",
  "👍": "thumbs up",
  "👎": "thumbs down",
};

/**
 * THE reaction chips for the whole app: DMs, groups and realm channels all
 * render this one component, so the three chats cannot drift apart again.
 *
 * Layout: the row sits directly under the bubble, aligned to the bubble's side,
 * and overlaps its bottom edge by 6px. Chips are 24px tall with 44px tap areas
 * (invisible padding) so they stay small and cute but easy to hit. Four chips
 * show, then a "+N" chip opens the full list.
 */
const MAX_VISIBLE_CHIPS = 4;
const LONG_PRESS_MS = 420;

/**
 * Fires a burst over a message, used by double tap. Pass the tap's viewport
 * coordinates when they are known so the burst pops right under the finger.
 */
export function burstOverMessage(messageId: string, emoji: string, at?: { x: number; y: number }) {
  if (at) {
    triggerReactionBurst({ x: at.x, y: at.y, emoji });
    return;
  }
  triggerBurstOnElement(document.getElementById(`msg-${messageId}`), emoji);
}

/**
 * Keeps the reading position when the chip row grows or shrinks, so adding a
 * reaction never scrolls the chat or makes it jump.
 */
function useReactionRowAnchor(ref: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const reserved = (element: HTMLElement) => {
      const margin = Number.parseFloat(window.getComputedStyle(element).marginTop || "0");
      return element.getBoundingClientRect().height + (Number.isFinite(margin) ? margin : 0);
    };

    let previous = reserved(node);
    const observer = new ResizeObserver(() => {
      const next = reserved(node);
      const delta = next - previous;
      previous = next;
      if (!delta) return;

      // Only compensate when the reader is parked at the bottom of the chat:
      // anywhere else the browser's own scroll anchoring already holds place.
      let scroller: HTMLElement | null = node.parentElement;
      while (scroller) {
        const style = window.getComputedStyle(scroller);
        if (/(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight) break;
        scroller = scroller.parentElement;
      }
      if (!scroller) return;
      const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      if (distanceFromBottom > 32) return;
      scroller.scrollTop += delta;
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
}

/** Hover popover content listing reactors with "You" at top, capped at 8-10. */
function ReactorHoverPopover({
  emoji,
  messageId,
  scope,
  userIds,
  currentUserId,
}: {
  emoji: string;
  messageId: string;
  scope: ReactionScope;
  userIds: string[];
  currentUserId?: string;
}) {
  const profiles = useQuery({
    queryKey: reactorsQueryKey(scope, messageId, emoji),
    queryFn: () => fetchReactorProfiles(userIds),
    enabled: userIds.length > 0,
    staleTime: 60_000,
  });

  const emojiName = EMOJI_NAMES[emoji] ?? "";
  const byId = new Map(
    (profiles.data ?? []).map((person: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => [
      person.id,
      person,
    ]),
  );

  // Reorder userIds so current user is shown first
  const sortedIds = [...userIds].sort((a, b) => {
    if (a === currentUserId) return -1;
    if (b === currentUserId) return 1;
    return 0;
  });

  const maxDisplay = 8;
  const displayed = sortedIds.slice(0, maxDisplay);
  const remaining = sortedIds.length - displayed.length;

  return (
    <div className="w-[210px] select-none text-left p-1">
      <div className="flex items-center gap-1.5 border-b border-border/70 pb-2 mb-2">
        <span className="text-lg leading-none" aria-hidden="true">{emoji}</span>
        <span className="text-xs font-semibold capitalize text-foreground truncate">
          {emojiName || "Reaction"}
        </span>
        <span className="ml-auto text-[11px] font-medium text-muted-foreground tabular-nums">
          {userIds.length}
        </span>
      </div>

      {profiles.isLoading && (
        <div className="py-2 text-center text-xs text-muted-foreground animate-pulse">
          Loading…
        </div>
      )}

      {profiles.isError && (
        <div className="py-1 text-xs text-muted-foreground">
          {userIds.length} {userIds.length === 1 ? "reaction" : "reactions"}
        </div>
      )}

      {profiles.data && (
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
          {displayed.map((id) => {
            const isMe = id === currentUserId;
            const person = byId.get(id);
            const name = isMe ? "You" : (person?.display_name || person?.username || "Someone");
            const handle = person?.username ? `@${person.username}` : null;

            return (
              <div key={id} className="flex items-center gap-2 py-0.5">
                <Avatar className="h-5 w-5 shrink-0 rounded-full border border-border">
                  <AvatarImage src={person?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 truncate text-xs">
                  <span className={`font-medium ${isMe ? "text-primary font-semibold" : "text-foreground"}`}>
                    {name}
                  </span>
                  {!isMe && handle && (
                    <span className="ml-1 text-[10px] text-muted-foreground">{handle}</span>
                  )}
                </div>
              </div>
            );
          })}

          {remaining > 0 && (
            <div className="pt-1 text-[11px] font-medium text-muted-foreground">
              and {remaining} other{remaining === 1 ? "" : "s"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One 24px chip with a 44px tap area, a spring pop, roll count, and desktop hover card. */
function ReactionChip({
  emoji,
  count,
  mine,
  canReact,
  pulse,
  onToggle,
  onLongPress,
  label,
  messageId,
  scope,
  reactors,
  currentUserId,
}: {
  emoji: string;
  count: number;
  mine: boolean;
  canReact: boolean;
  pulse: ReactionPulse | null;
  onToggle: () => Promise<boolean>;
  onLongPress: () => void;
  label: string;
  messageId: string;
  scope: ReactionScope;
  reactors: string[];
  currentUserId?: string;
}) {
  const controls = useAnimationControls();
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const [failed, setFailed] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pulse || pulse.emoji !== emoji) return;
    if (pulse.kind === "remote") {
      setGlowing(true);
      const timer = window.setTimeout(() => setGlowing(false), 460);
      void controls.start({ scale: [1, 1.14, 1], transition: { duration: 0.42, ease: "easeOut" } });
      return () => window.clearTimeout(timer);
    }
    void controls.start({ scale: [0.6, 1.15, 1], transition: { type: "spring", stiffness: 620, damping: 18 } });
  }, [pulse?.nonce, pulse?.emoji, pulse?.kind, controls, emoji]);

  useEffect(
    () => () => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
    },
    [],
  );

  const handleActivate = async () => {
    if (!canReact) {
      toast.error("Only owners and moderators can add reactions here");
      return;
    }
    if (!mine) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) triggerReactionBurst({ x: rect.left + rect.width / 2, y: rect.top, emoji });
      reactionHaptic();
    }
    const ok = await onToggle();
    if (!ok) {
      setFailed(true);
      await controls.start({ scale: 0, opacity: 0, transition: { duration: 0.22, ease: "easeIn" } });
    }
  };

  return (
    <HoverCard openDelay={250} closeDelay={150}>
      <HoverCardTrigger asChild>
        <motion.button
          ref={buttonRef}
          type="button"
          aria-pressed={mine}
          aria-label={`${emoji} ${count}. ${label}`}
          initial={failed ? false : { scale: 0.6, opacity: 0 }}
          animate={failed ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 620, damping: 20 }}
          whileTap={{ scale: 0.94 }}
          onPointerDown={() => {
            longPressed.current = false;
            if (pressTimer.current) window.clearTimeout(pressTimer.current);
            pressTimer.current = window.setTimeout(() => {
              pressTimer.current = null;
              longPressed.current = true;
              onLongPress();
            }, LONG_PRESS_MS);
          }}
          onPointerUp={() => {
            if (pressTimer.current) {
              window.clearTimeout(pressTimer.current);
              pressTimer.current = null;
            }
          }}
          onPointerLeave={() => {
            if (pressTimer.current) {
              window.clearTimeout(pressTimer.current);
              pressTimer.current = null;
            }
          }}
          onPointerCancel={() => {
            if (pressTimer.current) {
              window.clearTimeout(pressTimer.current);
              pressTimer.current = null;
            }
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            onLongPress();
          }}
          onClick={(event) => {
            if (longPressed.current) {
              longPressed.current = false;
              event.preventDefault();
              return;
            }
            void handleActivate();
          }}
          className={`relative flex h-6 shrink-0 select-none items-center gap-1 rounded-full border px-2 leading-none transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-[10px] after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            mine
              ? "border-primary/50 bg-primary/15 text-foreground font-semibold"
              : "border-border/80 bg-card/90 text-foreground/90 hover:bg-muted"
          }`}
          style={{
            boxShadow: glowing
              ? "0 0 0 2px var(--primary)"
              : undefined,
          }}
        >
          <span className="text-[13px]" aria-hidden="true">
            {emoji}
          </span>
          <motion.span
            key={count}
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 26 }}
            className="text-[11px] font-semibold tabular-nums"
          >
            {count}
          </motion.span>
        </motion.button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={6}
        className="w-auto p-2 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-50"
      >
        <ReactorHoverPopover
          emoji={emoji}
          messageId={messageId}
          scope={scope}
          userIds={reactors}
          currentUserId={currentUserId}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

function ReactorsSheet({
  open,
  onOpenChange,
  scope,
  messageId,
  groups,
  reactorsFor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ReactionScope;
  messageId: string;
  groups: ReactionGroup[];
  reactorsFor: (messageId: string, emoji: string) => string[];
}) {
  const userIds = open ? [...new Set(groups.flatMap((group) => reactorsFor(messageId, group.emoji)))] : [];
  const profiles = useQuery({
    queryKey: reactorsQueryKey(scope, messageId, `all:${groups.map((group) => group.emoji).join("")}`),
    queryFn: () => fetchReactorProfiles(userIds),
    enabled: open && userIds.length > 0,
    staleTime: 60_000,
  });

  const byId = new Map(
    (profiles.data ?? []).map((person: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => [
      person.id,
      person,
    ]),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card text-card-foreground border-border z-[70] max-h-[75dvh] overflow-y-auto rounded-t-3xl border-t pb-[max(env(safe-area-inset-bottom),1rem)] sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-[380px] sm:w-full sm:rounded-2xl sm:border sm:border-border sm:p-6 sm:shadow-2xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-lg font-bold">Reactions</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-4">
          {groups.map((group) => (
            <section key={group.emoji}>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <span aria-hidden="true" className="text-[15px]">
                  {group.emoji}
                </span>
                <span className="text-muted-foreground text-xs">
                  {group.count} {group.count === 1 ? "reaction" : "reactions"}
                </span>
              </h3>
              <div className="mt-1.5 space-y-1">
                {profiles.isLoading && (
                  <p className="px-1 text-xs text-muted-foreground animate-pulse">Loading…</p>
                )}
                {reactorsFor(messageId, group.emoji).map((userId) => {
                  const person = byId.get(userId);
                  const name = person?.display_name || person?.username || "Someone";
                  return (
                    <div key={`${group.emoji}-${userId}`} className="flex min-h-10 items-center gap-3 rounded-xl px-1 hover:bg-muted/40">
                      <Avatar className="h-7 w-7 rounded-full border border-border">
                        <AvatarImage src={person?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-muted text-[10px] font-bold text-muted-foreground">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 truncate text-sm font-medium">{name}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ReactionChips({
  scope,
  messageId,
  groups,
  reactorsFor,
  align = "left",
  canReact = true,
  hidden = false,
  pulse = null,
  onToggle,
}: {
  scope: ReactionScope;
  messageId: string;
  groups: ReactionGroup[];
  reactorsFor: (messageId: string, emoji: string) => string[];
  align?: "left" | "right";
  /** The channel's "who can add reactions" setting, enforced server-side too. */
  canReact?: boolean;
  /** Unsent or deleted messages never show or accept reactions. */
  hidden?: boolean;
  pulse?: ReactionPulse | null;
  onToggle: (emoji: string) => Promise<boolean>;
}) {
  const { user } = useAuth();
  const rowRef = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  useReactionRowAnchor(rowRef);

  // Unsent/deleted messages drop their chips entirely and cannot be reacted to.
  if (hidden) return null;

  const hasChips = groups.length > 0;
  const visible = groups.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = groups.length - visible.length;
  const pulseFor = (emoji: string) => (pulse && pulse.messageId === messageId && pulse.emoji === emoji ? pulse : null);

  return (
    <>
      {/* Always mounted, even with no chips, so the anchor can absorb the very
          first reaction without moving the chat. */}
      <div
        ref={rowRef}
        data-testid={`reaction-row-${messageId}`}
        className={`relative z-10 flex flex-wrap items-center gap-1 ${
          align === "right" ? "justify-end" : "justify-start"
        } ${hasChips ? "-mt-1.5 min-h-[18px]" : "h-0"}`}
      >
        <AnimatePresence initial={false}>
          {visible.map((group) => (
            <ReactionChip
              key={`${group.emoji}`}
              emoji={group.emoji}
              count={group.count}
              mine={group.mine}
              canReact={canReact}
              pulse={pulseFor(group.emoji)}
              label="Tap to toggle, long press to see who reacted."
              messageId={messageId}
              scope={scope}
              reactors={reactorsFor(messageId, group.emoji)}
              currentUserId={user?.id}
              onToggle={() => onToggle(group.emoji)}
              onLongPress={() => setSheetOpen(true)}
            />
          ))}
          {overflow > 0 && (
            <motion.button
              key="overflow"
              type="button"
              aria-label={`Show ${overflow} more reaction${overflow === 1 ? "" : "s"}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 620, damping: 20 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setSheetOpen(true)}
              className="relative flex h-6 shrink-0 select-none items-center rounded-full border border-border bg-card/90 px-2 text-[11px] font-semibold leading-none text-foreground/90 backdrop-blur-sm after:absolute after:inset-x-0 after:-inset-y-[10px] after:content-[''] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              +{overflow}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <ReactorsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        scope={scope}
        messageId={messageId}
        groups={groups}
        reactorsFor={reactorsFor}
      />
    </>
  );
}

export default ReactionChips;
