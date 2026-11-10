import { useEffect, useRef, type ReactNode } from "react";
import { CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One gesture, four surfaces. Realm channels, realm threads, group chats and
 * DMs all wrap their rows in this component, so the threshold, the drag feel,
 * the arrow and the spring back can never drift between them.
 */
export const SWIPE_REPLY = {
  /** Release past this many px and the reply is armed. */
  threshold: 64,
  /** Further than this the bubble rubber-bands instead of following 1:1. */
  maxDrag: 90,
  rubber: 0.18,
  /** Movement before the gesture commits to an axis. */
  axisLock: 8,
  /** The browser back gesture owns the first 20px of the left screen edge. */
  edgeGuard: 20,
  springMs: 250,
  popScale: 1.2,
  hapticMs: 10,
} as const;

type Axis = "none" | "x" | "y";

type SwipeableMessageProps = {
  /** Called once on release when the drag passed the threshold. */
  onReply: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function SwipeableMessage({
  onReply,
  disabled = false,
  className,
  children,
}: SwipeableMessageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({
    axis: "none" as Axis,
    startX: 0,
    startY: 0,
    offset: 0,
    armed: false,
    pointerId: -1,
  });
  const resetTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const suppressTimer = useRef<number | null>(null);

  const paint = (offset: number, armed: boolean) => {
    const content = contentRef.current;
    if (content) content.style.transform = `translate3d(${offset}px, 0, 0)`;
    const icon = iconRef.current;
    if (!icon) return;
    const progress = Math.min(offset / SWIPE_REPLY.threshold, 1);
    icon.style.opacity = String(progress);
    icon.style.transform = `translateY(-50%) scale(${
      armed ? SWIPE_REPLY.popScale : 0.6 + 0.4 * progress
    })`;
    icon.style.color = armed ? "var(--primary)" : "var(--muted-foreground)";
  };

  const settle = () => {
    const content = contentRef.current;
    const icon = iconRef.current;
    const reduce = reducedMotion();
    if (content) {
      content.style.transition = reduce ? "none" : `transform ${SWIPE_REPLY.springMs}ms ease-out`;
      content.style.transform = "translate3d(0, 0, 0)";
    }
    if (icon) {
      icon.style.transition = reduce
        ? "none"
        : `opacity ${SWIPE_REPLY.springMs}ms ease-out, transform ${SWIPE_REPLY.springMs}ms ease-out`;
      icon.style.opacity = "0";
      icon.style.transform = "translateY(-50%) scale(0.6)";
      icon.style.color = "var(--muted-foreground)";
    }
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(
      () => {
        resetTimer.current = null;
        if (content) {
          content.style.transition = "";
          content.style.willChange = "";
          content.style.transform = "";
        }
        if (icon) icon.style.transition = "";
      },
      reduce ? 0 : SWIPE_REPLY.springMs + 30,
    );
  };

  const endGesture = (pointerId: number, capture: boolean) => {
    const host = hostRef.current;
    if (host) {
      if (capture) {
        try {
          host.releasePointerCapture(pointerId);
        } catch {
          // The pointer may already be gone; nothing to release.
        }
      }
    }
    // Keep `data-swipe-active` until the same 350ms window that eats the click:
    // a pending 320ms long-press must see it and stand down.
    if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
    suppressTimer.current = window.setTimeout(() => {
      suppressClick.current = false;
      delete hostRef.current?.dataset.swipeActive;
    }, 350);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Leave the screen-edge back gesture alone.
    if (event.clientX < SWIPE_REPLY.edgeGuard) return;
    if ((event.target as HTMLElement).closest("input, textarea, [contenteditable='true']")) return;
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    const content = contentRef.current;
    if (content) {
      content.style.transition = "none";
      content.style.willChange = "transform";
    }
    gesture.current = {
      axis: "none",
      startX: event.clientX,
      startY: event.clientY,
      offset: 0,
      armed: false,
      pointerId: event.pointerId,
    };
    suppressClick.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (disabled || state.pointerId !== event.pointerId || state.axis === "y") return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (state.axis === "none") {
      if (Math.abs(dx) < SWIPE_REPLY.axisLock && Math.abs(dy) < SWIPE_REPLY.axisLock) return;
      // Vertical wins ties: a scroll must never be mistaken for a reply.
      if (Math.abs(dx) <= Math.abs(dy)) {
        state.axis = "y";
        return;
      }
      state.axis = "x";
      hostRef.current?.setPointerCapture?.(event.pointerId);
      if (hostRef.current) hostRef.current.dataset.swipeActive = "true";
    }

    // Only rightward drags arm the reply; a small left drift just sits at rest.
    if (event.cancelable) event.preventDefault();
    if (dx < 0) {
      state.offset = 0;
      paint(0, false);
      return;
    }
    let offset = dx;
    if (offset > SWIPE_REPLY.maxDrag) {
      offset = SWIPE_REPLY.maxDrag + (offset - SWIPE_REPLY.maxDrag) * SWIPE_REPLY.rubber;
    }
    const armed = offset >= SWIPE_REPLY.threshold;
    if (armed && !state.armed) {
      state.armed = true;
      try {
        navigator.vibrate?.(SWIPE_REPLY.hapticMs);
      } catch {
        // Vibration is a nicety; a device without it must not break the drag.
      }
    }
    state.offset = offset;
    suppressClick.current = offset > SWIPE_REPLY.axisLock;
    paint(offset, armed);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (state.pointerId !== event.pointerId) return;
    const wasHorizontal = state.axis === "x";
    const armed = state.offset >= SWIPE_REPLY.threshold;
    gesture.current.pointerId = -1;
    gesture.current.axis = "none";
    gesture.current.offset = 0;
    endGesture(event.pointerId, wasHorizontal);
    if (!wasHorizontal) return;
    suppressClick.current = true;
    if (armed && !disabled) onReply();
    settle();
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (state.pointerId !== event.pointerId) return;
    const wasHorizontal = state.axis === "x";
    gesture.current.pointerId = -1;
    gesture.current.axis = "none";
    gesture.current.offset = 0;
    endGesture(event.pointerId, wasHorizontal);
    if (wasHorizontal) settle();
  };

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
    },
    [],
  );

  return (
    <div
      ref={hostRef}
      data-swipe-reply=""
      className={cn("relative", className)}
      style={disabled ? undefined : { touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        ref={iconRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-1/2 z-0 -translate-y-1/2 opacity-0"
      >
        <CornerUpLeft className="h-5 w-5" strokeWidth={2.4} />
      </div>
      <div ref={contentRef} className="relative z-[1]">
        {children}
      </div>
    </div>
  );
}
