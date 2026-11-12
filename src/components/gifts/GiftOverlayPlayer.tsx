"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { playGiftSound } from "@/lib/gift-sound";
import type { Gift } from "@/lib/gift-catalog";
import { subscribeToGiftDrops, type GiftDrop } from "@/lib/gift-drop-bridge";

const RocketLaunch = lazy(() =>
  import("./RocketLaunch").then((module) => ({ default: module.RocketLaunch })),
);

const DISMISS_MS = 5600;

/** Vibration pattern per tier — stronger for bigger flexes. */
const VIBRATE_BY_TIER: Record<Gift["tier"], number | number[]> = {
  drip: [12],
  supercars: [28, 36, 28],
  millionaire: [50, 24, 50],
  "god-flex": [12, 46, 12, 46, 12],
};

function transitionConfig(reducedMotion: boolean) {
  return reducedMotion
    ? { duration: 0.2 }
    : { type: "spring" as const, stiffness: 380, damping: 32 };
}

/**
 * GiftOverlayPlayer — one self-contained full-screen gift takeover.
 *
 * Every catalog gift now launches the same RIZZ rocket. The overlay subscribes
 * to the gift-drop bridge, queues drops so they never overlap, plays the launch
 * sound and haptic, and pauses while the viewer is touching it.
 */
export function GiftOverlayPlayer() {
  const [queue, setQueue] = useState<GiftDrop[]>([]);
  const [showing, setShowing] = useState<GiftDrop | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    setShowing(null);
    setTimeout(
      () => {
        setDismissing(false);
      },
      reducedMotion ? 180 : 280,
    );
  }, [dismissing, reducedMotion]);

  // Subscribe to gift drops from anywhere in the app.
  useEffect(() => {
    return subscribeToGiftDrops((drop) => {
      setQueue((prev) => [...prev, drop]);
    });
  }, []);

  // Warm the takeover on idle so the first gift never waits on a network hop.
  useEffect(() => {
    const preload = () => void import("./RocketLaunch");
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preload, { timeout: 2200 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const timer = setTimeout(preload, 1400);
    return () => clearTimeout(timer);
  }, []);

  // Show the next queued gift when none is currently showing.
  useEffect(() => {
    if (!showing && queue.length > 0 && !dismissing) {
      const next = queue[0];
      setQueue((prev) => prev.slice(1));
      setShowing(next);
    }
  }, [showing, queue, dismissing]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!showing) return;
    playGiftSound(showing.gift.sound);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(VIBRATE_BY_TIER[showing.gift.tier]);
      } catch {
        // Vibration blocked by OS/browser; never breaks the flex.
      }
    }
  }, [showing]);

  useEffect(() => {
    if (!showing) return;
    timerRef.current = setTimeout(dismiss, DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showing, dismiss]);

  const handlePause = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleResume = useCallback(() => {
    if (showing && !dismissing && !timerRef.current) {
      timerRef.current = setTimeout(dismiss, DISMISS_MS);
    }
  }, [showing, dismissing, dismiss]);

  if (!showing) return null;

  const { gift, sender, receiver, message } = showing;
  const transition = transitionConfig(reducedMotion);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[300]">
      <AnimatePresence mode="wait">
        <motion.div
          key="rizz-rocket-gift"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition }}
          exit={{ opacity: 0, transition }}
          onMouseEnter={handlePause}
          onMouseLeave={handleResume}
          onPointerDown={handlePause}
          onPointerUp={handleResume}
          onPointerCancel={handleResume}
          className="pointer-events-auto absolute inset-0 overflow-hidden bg-[#07030d]"
        >
          <Suspense fallback={<div className="absolute inset-0 bg-[#07030d]" />}>
            <RocketLaunch
              gift={gift}
              sender={sender}
              receiver={receiver}
              message={message}
              reducedMotion={reducedMotion}
              onClose={dismiss}
            />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
