import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchReactorProfiles, reactorsQueryKey, type ReactionGroup, type ReactionScope } from "@/lib/reactions";
import { reactionHaptic, triggerReactionBurst, triggerBurstOnElement } from "@/components/chat/ReactionBurst";
import type { ReactionPulse } from "@/lib/useChatReactions";
import {
  useReactorPeek,
  type ReactionTarget,
} from "@/components/reactions/ReactorPeek";

export type { ReactionPulse };

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
const LONG_PRESS_MS = 320;

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

/** One 24px chip with a 44px tap area, a spring pop and a count that rolls. */
function ReactionChip({
  emoji,
  count,
  mine,
  canReact,
  pulse,
  onToggle,
  onLongPress,
  label,
  peekTarget,
}: {
  emoji: string;
  count: number;
  mine: boolean;
  canReact: boolean;
  pulse: ReactionPulse | null;
  onToggle: () => Promise<boolean>;
  onLongPress: () => void;
  label: string;
  /** The same shared reactor peek every other surface uses. */
  peekTarget?: ReactionTarget | null;
}) {
  const controls = useAnimationControls();
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const [failed, setFailed] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const peek = useReactorPeek(peekTarget ?? null);

  useEffect(() => {
    if (!pulse || pulse.emoji !== emoji) return;
    if (pulse.kind === "remote") {
      // Someone else reacted to my message: a small pop and a light glow, no
      // burst, so it never pulls attention away from what I'm reading. The glow
      // is a one-off style swap, not an animated shadow.
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
    // The big burst only plays for my own reaction, over the chip's message.
    if (!mine) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) triggerReactionBurst({ x: rect.left + rect.width / 2, y: rect.top, emoji });
      reactionHaptic();
    }
    const ok = await onToggle();
    if (!ok) {
      // Saving failed: shrink away instead of leaving a lying chip on screen.
      setFailed(true);
      await controls.start({ scale: 0, opacity: 0, transition: { duration: 0.22, ease: "easeIn" } });
    }
  };

  return (
    <motion.button
      ref={(node: HTMLButtonElement | null) => {
        buttonRef.current = node;
        peek.anchorRef.current = node;
      }}
      type="button"
      aria-pressed={mine}
      aria-label={`${emoji} ${count}. ${label}`}
      aria-describedby={peek.describedBy}
      {...peek.triggerProps}
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
          // Hold longer, feel more: the shared haptic helper first, then the
          // shared peek. Long press shows who reacted everywhere reactions
          // exist; the "+N" chip still opens the full sheet.
          reactionHaptic(35);
          if (peek.openNow) peek.openNow();
          else onLongPress();
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
        peek.close?.();
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
      // The visible chip is 24px; the invisible ::after makes the tap area 44px
      // without adding any layout height.
      className={`relative flex h-6 shrink-0 select-none items-center gap-1 rounded-full border px-2 leading-none backdrop-blur-sm after:absolute after:inset-x-0 after:-inset-y-[10px] after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        mine
          ? "border-primary/60 bg-primary/20 text-foreground"
          : "border-white/12 bg-[#0c0812]/70 text-foreground/90"
      }`}
      style={{
        boxShadow: glowing
          ? "0 0 0 2px var(--brand-signal), 0 2px 12px -2px var(--brand-signal)"
          : mine
            ? "0 2px 10px -4px var(--brand-signal)"
            : "0 2px 8px -4px rgba(0,0,0,0.6)",
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
  );
}

/** Bottom sheet listing everybody who reacted, grouped per emoji. */
function ReactorsSheet({
  open,
  onOpenChange,
  scope,
  messageId,
  groups,
  reactorsFor,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ReactionScope;
  messageId: string;
  groups: ReactionGroup[];
  reactorsFor: (messageId: string, emoji: string) => string[];
  /** Toggles my reaction — the sheet's "Remove" button calls this. */
  onToggle: (emoji: string) => Promise<boolean>;
}) {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const userIds = open ? [...new Set(groups.flatMap((group) => reactorsFor(messageId, group.emoji)))] : [];
  const profiles = useQuery({
    queryKey: reactorsQueryKey(scope, messageId, `all:${groups.map((group) => group.emoji).join("")}`),
    queryFn: () => fetchReactorProfiles(userIds),
    enabled: open && userIds.length > 0,
    staleTime: 60_000,
  });

  const byId = new Map(
    (profiles.data ?? []).map((person: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => [person.id, person]),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="glass-strong z-[70] max-h-[70dvh] overflow-y-auto rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-lg">Reactions</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-4">
          {groups.map((group) => (
            <section key={group.emoji}>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <span aria-hidden="true" className="text-[15px]">{group.emoji}</span>
                <span className="text-muted-foreground">{group.count} {group.count === 1 ? "reaction" : "reactions"}</span>
              </h3>
              <div className="mt-1.5 space-y-1">
                {profiles.isLoading && <p className="px-1 text-xs text-muted-foreground">Loading…</p>}
                {reactorsFor(messageId, group.emoji).map((userId) => {
                  const person = byId.get(userId);
                  const name = person?.display_name || person?.username || "Someone";
                  const mine = userId === myId;
                  return (
                    <div key={`${group.emoji}-${userId}`} className="flex min-h-12 items-center gap-3 rounded-2xl px-1">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={person?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 truncate text-sm">{mine ? "You" : name}</span>
                      {mine && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            setRemovingKey(`${group.emoji}:${userId}`);
                            void onToggle(group.emoji).then(() => setRemovingKey(null));
                          }}
                          disabled={removingKey === `${group.emoji}:${userId}`}
                          className="ml-auto rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-60"
                        >
                          {removingKey === `${group.emoji}:${userId}` ? "Removing…" : "Remove"}
                        </button>
                      )}
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
              peekTarget={{
                emoji: group.emoji,
                count: group.count,
                source: { kind: "message", id: messageId },
                // Remove works here too: the peek's "Remove" action calls the
                // same store-backed toggle the chip uses (single source of truth).
                ...(group.mine
                  ? { remove: () => { void onToggle(group.emoji); } }
                  : {}),
              }}
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
              className="relative flex h-6 shrink-0 select-none items-center rounded-full border border-white/12 bg-[#0c0812]/70 px-2 text-[11px] font-semibold leading-none text-foreground/90 backdrop-blur-sm after:absolute after:inset-x-0 after:-inset-y-[10px] after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.6)" }}
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
        onToggle={onToggle}
      />
    </>
  );
}

export default ReactionChips;
