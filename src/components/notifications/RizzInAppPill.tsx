"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  MessageCircle,
  AtSign,
  Smile,
  Gift,
  Mic,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { haptic } from "@/lib/haptics";
import { useRouter } from "@tanstack/react-router";

export type InAppNotification = {
  id: string;
  type: "dm" | "mention" | "reaction" | "paws_gift" | "voice_room";
  actor: string | null;
  body: string | null;
  target_url: string | null;
  avatar_url: string | null;
  created_at: string;
  is_test?: boolean;
};

// ---------------------------------------------------------------------------
// Pub/sub bridge: lets the service worker (via a message listener in __root.tsx)
// push a notification into the pill queue without the two modules importing
// each other. The pill component subscribes on mount.
// ---------------------------------------------------------------------------
const subscribers = new Set<(notification: InAppNotification) => void>();

export function subscribeToInAppNotifications(
  callback: (notification: InAppNotification) => void,
) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function dispatchInAppNotification(notification: InAppNotification) {
  subscribers.forEach((callback) => callback(notification));
}

const TYPE_ICON: Record<InAppNotification["type"], React.ElementType> = {
  dm: MessageCircle,
  mention: AtSign,
  reaction: Smile,
  paws_gift: Gift,
  voice_room: Mic,
};

const TYPE_LABEL: Record<InAppNotification["type"], string> = {
  dm: "Message",
  mention: "Mention",
  reaction: "Reaction",
  paws_gift: "Paws gift",
  voice_room: "Voice room",
};

/** Sound throttle: one chime per 1.5s max. */
let lastChimeAt = 0;
const CHIME_THROTTLE_MS = 1500;

/** Haptic pattern for a new in-app notification. */
const HAPTIC_PATTERN = [25, 40, 25];

function playChime(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastChimeAt < CHIME_THROTTLE_MS) return;
  lastChimeAt = now;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ac = new Ctor();
  if (ac.state === "suspended") {
    void ac.resume().catch(() => undefined);
  }
  const nowSec = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, nowSec);
  osc.frequency.exponentialRampToValueAtTime(1320, nowSec + 0.06);
  gain.gain.setValueAtTime(0.0001, nowSec);
  gain.gain.exponentialRampToValueAtTime(0.08, nowSec + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, nowSec + 0.06);
  osc.connect(gain).connect(ac.destination);
  osc.start(nowSec);
  osc.stop(nowSec + 0.09);
}

function transitionConfig(reducedMotion: boolean) {
  return reducedMotion
    ? { duration: 0.2 }
    : { type: "spring" as const, stiffness: 400, damping: 30 };
}

export function RizzInAppPill() {
  const router = useRouter();
  const [queue, setQueue] = useState<InAppNotification[]>([]);
  const [showing, setShowing] = useState<InAppNotification | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const dismissingRef = useRef(false);
  const pressStartRef = useRef<{ y: number; time: number } | null>(null);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Accept in-app notifications pushed by the service worker via postMessage.
  useEffect(() => {
    return subscribeToInAppNotifications((notification) => {
      setQueue((prev) => [...prev, notification]);
    });
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (showing && !pausedRef.current && !dismissingRef.current) {
      timerRef.current = setTimeout(dismissCurrent, 4000);
    }
  }, [showing, clearTimer, dismissCurrent]);

  const dismissCurrent = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    clearTimer();
    setShowing(null);
    // Let the exit animation finish before allowing the next pill.
    setTimeout(() => {
      dismissingRef.current = false;
    }, reducedMotion ? 200 : 300);
  }, [clearTimer, dismissingRef, reducedMotion, setShowing]);

  const showNext = useCallback(() => {
    clearTimer();
    if (queue.length === 0) {
      setShowing(null);
      return;
    }
    const next = queue[0];
    setQueue((prev) => prev.slice(1));
    setShowing(next);
    // Haptic + chime once per pill, chime throttled to once per 1.5s.
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(HAPTIC_PATTERN);
      } catch {
        // Vibration blocked by OS/browser; never breaks the tap.
      }
    }
    playChime();
    startTimer();
  }, [queue, clearTimer, startTimer, playChime]);

  useEffect(() => {
    if (!showing && queue.length > 0 && !dismissingRef.current) {
      showNext();
    }
    return clearTimer;
  }, [showing, queue, showNext, clearTimer]);

  const handleTap = useCallback(
    (event: React.MouseEvent, notification: InAppNotification) => {
      // Ignore taps that were really swipes.
      if (pressStartRef.current) {
        const deltaY = event.clientY - pressStartRef.current.y;
        if (deltaY < -20) {
          pressStartRef.current = null;
          dismissCurrent();
          return;
        }
        pressStartRef.current = null;
      }
      const url = notification.target_url;
      dismissCurrent();
      if (url && typeof url === "string" && url.startsWith("/")) {
        void router.navigate({ to: url }).catch(() => undefined);
      }
    },
    [dismissCurrent, router],
  );

  const handleDismiss = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      pressStartRef.current = null;
      dismissCurrent();
    },
    [dismissCurrent],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      pressStartRef.current = { y: event.clientY, time: Date.now() };
      pausedRef.current = true;
      clearTimer();
    },
    [clearTimer],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!pressStartRef.current) return;
      const deltaY = event.clientY - pressStartRef.current.y;
      const wasSwipe = deltaY < -20;
      pressStartRef.current = null;
      pausedRef.current = false;
      if (wasSwipe) {
        dismissCurrent();
        return;
      }
      startTimer();
    },
    [dismissCurrent, startTimer],
  );

  const handlePointerLeave = useCallback(() => {
    pausedRef.current = false;
    startTimer();
  }, [startTimer]);

  const handleMouseEnter = useCallback(() => {
    pausedRef.current = true;
    clearTimer();
  }, [clearTimer]);

  const handleMouseLeave = useCallback(() => {
    pausedRef.current = false;
    startTimer();
  }, [startTimer]);

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: "max(8px, env(safe-area-inset-top))",
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: "440px",
    pointerEvents: "none",
    zIndex: 200,
    display: "flex",
    justifyContent: "center",
  };

  if (!showing) return null;

  const Icon = TYPE_ICON[showing.type];
  const transition = transitionConfig(reducedMotion);
  const slide = reducedMotion ? 0 : -20;

  return createPortal(
    <div style={containerStyle} className="pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key="pill"
          initial={{ opacity: 0, y: slide }}
          animate={{ opacity: 1, y: 0, transition }}
          exit={{ opacity: 0, y: slide, transition }}
          onClick={(event) => handleTap(event, showing)}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-card/95 backdrop-blur-md px-3.5 py-2.5 text-left shadow-xl",
            !reducedMotion && "animate-in fade-in slide-in-from-top-4",
          )}
        >
          <div className="shrink-0 h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Icon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {showing.actor && (
                <span className="text-xs font-semibold text-foreground truncate">
                  @{showing.actor}
                </span>
              )}
              <Badge variant="outline" className="text-[10px] leading-none shrink-0">
                {TYPE_LABEL[showing.type]}
              </Badge>
              {showing.is_test && (
                <Badge variant="outline" className="text-[10px] leading-none shrink-0 text-muted-foreground border-white/20">
                  test
                </Badge>
              )}
            </div>
            {showing.body && (
              <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">
                {showing.body}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={handleDismiss}
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <ChevronRight className="shrink-0 h-4 w-4 text-muted-foreground ml-2" />
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
