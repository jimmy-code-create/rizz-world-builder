import { useEffect, useRef, type ReactNode } from "react";
import { CornerUpLeft, CornerUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One gesture, four surfaces. Realm channels, realm threads, group chats and
 * DMs all wrap their rows in this component, so the threshold, the drag feel,
 * the arrow and the spring back can never drift between them.
 *
 * Discord's reply gesture is rightward, but the same physical drag leftward is
 * just as natural for a thumb on the other side of the phone. Both arms the
 * reply; the icon and rail mirror, and the browser's edge-back gesture is still
 * left alone. Everything is painted directly to the DOM during the drag — no
 * React state per pointermove — and the spring is CSS.
 */
export const SWIPE_REPLY = {
  /** Release past this many px and the reply is armed. */
  threshold: 62,
  /** Further than this the bubble rubber-bands instead of following 1:1. */
  maxDrag: 94,
  rubber: 0.16,
  /** Movement before the gesture commits to an axis. */
  axisLock: 7,
  /** The browser back gesture owns the first 22px of the left screen edge. */
  edgeGuard: 22,
  springMs: 240,
  popScale: 1.16,
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
  const railRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
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
    const host = hostRef.current;
    const content = contentRef.current;
    const rail = railRef.current;
    const badge = badgeRef.current;
    const label = labelRef.current;
    const distance = Math.abs(offset);
    const progress = Math.min(distance / SWIPE_REPLY.threshold, 1);
    const direction = offset >= 0 ? "right" : "left";

    if (host) {
      host.dataset.swipeDirection = direction;
      host.dataset.swipeArmed = armed ? "true" : "false";
    }
    if (content) content.style.transform = `translate3d(${offset}px, 0, 0)`;
    if (rail) rail.style.opacity = String(Math.min(1, progress * 1.35));
    if (badge) {
      badge.style.opacity = String(Math.min(1, progress * 1.5));
      badge.style.transform = `scale(${armed ? SWIPE_REPLY.popScale : 0.68 + 0.32 * progress})`;
    }
    if (label) {
      label.style.opacity = String(Math.max(0, (progress - 0.34) / 0.66));
      label.textContent = armed ? "Release to reply" : "Reply";
    }
  };

  const settle = () => {
    const host = hostRef.current;
    const content = contentRef.current;
    const rail = railRef.current;
    const badge = badgeRef.current;
    const label = labelRef.current;
    const reduce = reducedMotion();
    if (content) {
      content.style.transition = reduce ? "none" : `transform ${SWIPE_REPLY.springMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      content.style.transform = "translate3d(0, 0, 0)";
    }
    if (rail) {
      rail.style.transition = reduce ? "none" : `opacity ${SWIPE_REPLY.springMs}ms ease-out`;
      rail.style.opacity = "0";
    }
    if (badge) {
      badge.style.transition = reduce
        ? "none"
        : `opacity ${SWIPE_REPLY.springMs}ms ease-out, transform ${SWIPE_REPLY.springMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      badge.style.opacity = "0";
      badge.style.transform = "scale(0.6)";
    }
    if (label) {
      label.style.transition = reduce ? "none" : `opacity ${SWIPE_REPLY.springMs}ms ease-out`;
      label.style.opacity = "0";
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
        if (rail) rail.style.transition = "";
        if (badge) badge.style.transition = "";
        if (label) label.style.transition = "";
        if (host) {
          delete host.dataset.swipeDirection;
          host.dataset.swipeArmed = "false";
        }
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
    // Links, buttons, media controls and text fields own their own gestures.
    if (
      (event.target as HTMLElement).closest(
        "a, button, input, textarea, [data-interactive], [data-swipe-ignore], [contenteditable='true']",
      )
    ) {
      return;
    }
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
      const host = hostRef.current;
      state.axis = "x";
      host?.setPointerCapture?.(event.pointerId);
      if (host) host.dataset.swipeActive = "true";
    }

    if (event.cancelable) event.preventDefault();
    const distance = Math.abs(dx);
    const eased =
      distance > SWIPE_REPLY.maxDrag
        ? SWIPE_REPLY.maxDrag + (distance - SWIPE_REPLY.maxDrag) * SWIPE_REPLY.rubber
        : distance;
    const offset = dx < 0 ? -eased : eased;
    const armed = eased >= SWIPE_REPLY.threshold;
    if (armed && !state.armed) {
      state.armed = true;
      try {
        navigator.vibrate?.(SWIPE_REPLY.hapticMs);
      } catch {
        // Vibration is a nicety; a device without it must not break the drag.
      }
    }
    state.offset = offset;
    suppressClick.current = eased > SWIPE_REPLY.axisLock;
    paint(offset, armed);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (state.pointerId !== event.pointerId) return;
    const wasHorizontal = state.axis === "x";
    const armed = Math.abs(state.offset) >= SWIPE_REPLY.threshold;
    // Do not eat a normal tap after a couple of pixels of finger jitter.
    const dragged = Math.abs(state.offset) > SWIPE_REPLY.axisLock;
    gesture.current.pointerId = -1;
    gesture.current.axis = "none";
    gesture.current.offset = 0;
    endGesture(event.pointerId, wasHorizontal);
    if (!wasHorizontal) return;
    suppressClick.current = dragged;
    if (armed && !disabled) onReply();
    settle();
  };

  /**
   * Whatever ends a drag that we did not see the pointerup for — a scroll
   * taking the gesture, another element claiming the pointer — must put the
   * row back. Otherwise the row stays shifted and its arrow stays painted,
   * which is what a "floating reply bubble" really is.
   */
  const abortGesture = () => {
    const state = gesture.current;
    if (state.pointerId === -1) return;
    const wasHorizontal = state.axis === "x";
    const pointerId = state.pointerId;
    gesture.current.pointerId = -1;
    gesture.current.axis = "none";
    gesture.current.offset = 0;
    gesture.current.armed = false;
    endGesture(pointerId, wasHorizontal);
    if (wasHorizontal) settle();
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (gesture.current.pointerId !== event.pointerId) return;
    abortGesture();
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
      data-swipe-armed="false"
      className={cn("swipe-reply-host relative", className)}
      style={disabled ? undefined : { touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={abortGesture}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div ref={railRef} aria-hidden="true" className="swipe-reply-rail">
        <span ref={badgeRef} className="swipe-reply-badge">
          <CornerUpLeft className="swipe-reply-icon swipe-reply-icon--right" strokeWidth={2.4} />
          <CornerUpRight className="swipe-reply-icon swipe-reply-icon--left" strokeWidth={2.4} />
        </span>
        <span ref={labelRef} className="swipe-reply-label">
          Reply
        </span>
      </div>
      <div ref={contentRef} className="relative z-[1]">
        {children}
      </div>
    </div>
  );
}
