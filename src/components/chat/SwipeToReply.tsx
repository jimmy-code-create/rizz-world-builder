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
 *
 * Touch is tracked with native `touchstart`/`touchmove` listeners rather than
 * React's delegated pointer events. A chat transcript is a vertical scroller,
 * and on a real phone the browser claims a diagonal drag and fires
 * `pointercancel` before a delegated React handler ever sees the horizontal
 * commitment — the row then looks completely dead. A non-passive native
 * `touchmove` listener can call `preventDefault()` at the exact moment the
 * gesture turns horizontal, so the drag always belongs to the reply rail.
 * Mouse and pen keep using pointer events (they have no touch stream).
 */
export const SWIPE_REPLY = {
  /** Release past this many px and the reply is armed. */
  threshold: 62,
  /** Further than this the bubble rubber-bands instead of following 1:1. */
  maxDrag: 94,
  rubber: 0.16,
  /** Movement before the gesture commits to an axis. */
  axisLock: 7,
  /** A diagonal drag may lean this much vertically and still be a reply. */
  axisLean: 1.15,
  /** The browser back gesture owns the first 22px of the left screen edge. */
  edgeGuard: 22,
  springMs: 240,
  popScale: 1.16,
  hapticMs: 10,
} as const;

type Axis = "none" | "x" | "y";

type Gesture = {
  axis: Axis;
  startX: number;
  startY: number;
  offset: number;
  armed: boolean;
  pointerId: number;
  source: "pointer" | "touch" | null;
};

const IDLE_GESTURE: Gesture = {
  axis: "none",
  startX: 0,
  startY: 0,
  offset: 0,
  armed: false,
  pointerId: -1,
  source: null,
};

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

/** Links, buttons, media controls and text fields own their own gestures. */
const ownsItsGesture = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== "function") return false;
  return Boolean(
    element.closest(
      "a, button, input, textarea, select, [data-interactive], [data-swipe-ignore], [contenteditable='true']",
    ),
  );
};

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
  const gesture = useRef<Gesture>({ ...IDLE_GESTURE });
  const resetTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const suppressTimer = useRef<number | null>(null);
  // The reply callback is usually an inline arrow in the route; keeping it in a
  // ref lets the native listeners bind once per `disabled` change instead of
  // rebinding on every message-list render.
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;

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
      content.style.transition = reduce
        ? "none"
        : `transform ${SWIPE_REPLY.springMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
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
    if (host && capture && pointerId >= 0) {
      try {
        host.releasePointerCapture(pointerId);
      } catch {
        // The pointer may already be gone; nothing to release.
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

  const begin = (x: number, y: number, pointerId: number, source: Gesture["source"]) => {
    if (disabled) return false;
    // Leave the screen-edge back gesture alone.
    if (x < SWIPE_REPLY.edgeGuard) return false;
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    gesture.current = {
      axis: "none",
      startX: x,
      startY: y,
      offset: 0,
      armed: false,
      pointerId,
      source,
    };
    suppressClick.current = false;
    return true;
  };

  /** Tracks a point. Returns true when the gesture has committed horizontally. */
  const track = (x: number, y: number) => {
    const state = gesture.current;
    if (disabled || !state.source || state.axis === "y") return false;
    const dx = x - state.startX;
    const dy = y - state.startY;

    if (state.axis === "none") {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < SWIPE_REPLY.axisLock && absY < SWIPE_REPLY.axisLock) return false;
      // Horizontal wins when it clearly leads, even with a little thumb lean.
      if (absX >= SWIPE_REPLY.axisLock && absX * SWIPE_REPLY.axisLean >= absY) {
        const host = hostRef.current;
        state.axis = "x";
        const content = contentRef.current;
        if (content) {
          content.style.transition = "none";
          content.style.willChange = "transform";
        }
        if (state.source === "pointer") {
          try {
            host?.setPointerCapture?.(state.pointerId);
          } catch {
            // Capture is an optimisation; bubbling still reaches the host.
          }
        }
        if (host) host.dataset.swipeActive = "true";
      } else if (absY >= SWIPE_REPLY.axisLock) {
        // A vertical drag is a scroll; never convert it into a reply later.
        state.axis = "y";
        return false;
      } else {
        return false;
      }
    }

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
    return true;
  };

  const finish = () => {
    const state = gesture.current;
    if (!state.source) return;
    const wasHorizontal = state.axis === "x";
    const armed = Math.abs(state.offset) >= SWIPE_REPLY.threshold;
    // Do not eat a normal tap after a couple of pixels of finger jitter.
    const dragged = Math.abs(state.offset) > SWIPE_REPLY.axisLock;
    const pointerId = state.pointerId;
    const wasPointer = state.source === "pointer";
    gesture.current = { ...IDLE_GESTURE };
    if (!wasHorizontal) {
      if (wasPointer) endGesture(pointerId, false);
      return;
    }
    endGesture(pointerId, wasPointer);
    suppressClick.current = dragged;
    if (armed && !disabled) onReplyRef.current();
    settle();
  };

  const abort = () => {
    const state = gesture.current;
    if (!state.source) return;
    const wasHorizontal = state.axis === "x";
    const pointerId = state.pointerId;
    const wasPointer = state.source === "pointer";
    gesture.current = { ...IDLE_GESTURE };
    endGesture(pointerId, wasPointer);
    if (wasHorizontal) settle();
  };

  // Touch: the only path that can prevent a scroll from claiming the gesture.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled) return;
    let touchId: number | null = null;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        if (touchId !== null) {
          touchId = null;
          abort();
        }
        return;
      }
      if (ownsItsGesture(event.target)) return;
      const touch = event.touches[0];
      if (touchId !== null) abort();
      touchId = begin(touch.clientX, touch.clientY, touch.identifier, "touch")
        ? touch.identifier
        : null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (touchId === null) return;
      const touch = Array.from(event.touches).find((item) => item.identifier === touchId);
      if (!touch) return;
      const horizontal = track(touch.clientX, touch.clientY);
      if (horizontal && event.cancelable) event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (touchId === null) return;
      // A lifted second finger must not end the drag that is still moving.
      if (Array.from(event.touches).some((item) => item.identifier === touchId)) return;
      touchId = null;
      finish();
    };

    const onTouchCancel = () => {
      if (touchId === null) return;
      touchId = null;
      abort();
    };

    host.addEventListener("touchstart", onTouchStart, { passive: true });
    host.addEventListener("touchmove", onTouchMove, { passive: false });
    host.addEventListener("touchend", onTouchEnd);
    host.addEventListener("touchcancel", onTouchCancel);
    return () => {
      host.removeEventListener("touchstart", onTouchStart);
      host.removeEventListener("touchmove", onTouchMove);
      host.removeEventListener("touchend", onTouchEnd);
      host.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [disabled]);

  // Mouse and pen: no touch stream, so pointer events are the natural path.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (ownsItsGesture(event.target)) return;
    begin(event.clientX, event.clientY, event.pointerId, "pointer");
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (!track(event.clientX, event.clientY)) return;
    if (event.cancelable) event.preventDefault();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (gesture.current.source !== "pointer") return;
    if (gesture.current.pointerId !== event.pointerId) return;
    finish();
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (gesture.current.source !== "pointer") return;
    if (gesture.current.pointerId !== event.pointerId) return;
    abort();
  };

  /**
   * Whatever ends a drag we never saw a pointerup for — a scroll taking the
   * gesture, another element claiming the pointer — must put the row back.
   * Otherwise it stays shifted with its rail painted.
   */
  const onLostPointerCapture = () => {
    if (gesture.current.source !== "pointer") return;
    abort();
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
      onLostPointerCapture={onLostPointerCapture}
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
