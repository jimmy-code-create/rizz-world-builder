"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { playGiftSound } from "@/lib/gift-sound";
import type { Gift } from "@/lib/gift-catalog";
import {
  subscribeToGiftDrops,
  type GiftDrop,
} from "@/lib/gift-drop-bridge";

const DISMISS_MS = 3500;

/** Vibration pattern per tier — stronger for bigger flexes. */
const VIBRATE_BY_TIER: Record<Gift["tier"], number | number[]> = {
  drip: [10],
  supercars: [25, 40, 25],
  millionaire: [50, 25, 50],
  "god-flex": [10, 50, 10, 50, 10],
};

function transitionConfig(reducedMotion: boolean) {
  return reducedMotion
    ? { duration: 0.2 }
    : { type: "spring" as const, stiffness: 400, damping: 30 };
}

/** ---------- drive-by: vehicle sweeps right -> left ---------- */
function DriveByFlex({
  gift,
  sender,
  receiver,
  message,
}: {
  gift: Gift;
  sender: string;
  receiver: string;
  message: string | null;
}) {
  const isSupercar = gift.tier === "supercars" || gift.tier === "millionaire";
  const isBugatti = gift.slug === "bugatti-chiron";
  const sweep = { duration: 2.6, ease: "linear" as const };

  return (
    <motion.div className="fixed inset-0 z-[300] pointer-events-none">
      {/* Cinema dim for Bugatti */}
      {isBugatti && (
        <div
          className="absolute inset-0 bg-black/60 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(168,139,250,0.15),transparent_70%)] pointer-events-none"
        />
      )}
      {/* Tire smoke particles */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 pointer-events-none"
          style={{
            width: 120 + i * 40,
            height: 120 + i * 40,
            x: "120vw",
            opacity: 0,
          }}
          animate={{
            x: "-120vw",
            opacity: [0, 0.35, 0],
            scale: [0.5, 1, 0.5],
            transition: { ...sweep, delay: i * 0.15 },
          }}
        />
      ))}
      {/* The vehicle */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[128px] pointer-events-none filter drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        style={{ x: "120vw" }}
        animate={{
          x: "-120vw",
          ...(isSupercar
            ? { rotate: [ -3, 0, 3, 0 ], transition: { repeat: Infinity, duration: 0.4, ease: "linear" } }
            : { rotate: [ -3, 0, 3, 0 ], transition: sweep }),
        }}
      >
        {gift.emoji}
      </motion.div>
      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-auto"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
          Flex Drop
        </span>
        <h2 className="text-[20px] font-black text-white leading-tight">
          @{sender} gifted{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-[#c9ff3d]">
            {gift.name}
          </span>{" "}
          to @{receiver}
        </h2>
        {message && (
          <p className="text-[12px] text-white/60 leading-relaxed max-w-md text-center">
            “{message}”
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

/** ---------- jet-flyover: plane across top with smoke trail ---------- */
function JetFlyover({
  gift,
  sender,
  receiver,
}: {
  gift: Gift;
  sender: string;
  receiver: string;
}) {
  return (
    <motion.div className="fixed inset-0 z-[300] pointer-events-none">
      {/* Smoke trail circles */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 rounded-full bg-[#94a3b8]/20 pointer-events-none"
          style={{ width: 60 + i * 30, height: 60 + i * 30, x: "-120vw", opacity: 0 }}
          animate={{
            x: "200vw",
            opacity: [0, 0.4, 0],
            transition: { duration: 3, ease: "linear", delay: i * 0.2 },
          }}
        />
      ))}
      {/* The jet */}
      <motion.div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[96px] pointer-events-none filter drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        style={{ x: "-120vw", rotate: -15 }}
        animate={{
          x: "200vw",
          rotate: [ -15, 0, 15 ],
          transition: { duration: 3, ease: "linear" },
        }}
      >
        {gift.emoji}
      </motion.div>
      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
          Millionaire Flex
        </span>
        <h2 className="text-[20px] font-black text-white leading-tight">
          @{sender} gifted{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-[#f472b6]">
            {gift.name}
          </span>{" "}
          to @{receiver}
        </h2>
      </motion.div>
    </motion.div>
  );
}

/** ---------- yacht-fireworks: water splash + confetti ---------- */
function YachtFireworks({
  gift,
  sender,
  receiver,
}: {
  gift: Gift;
  sender: string;
  receiver: string;
}) {
  return (
    <motion.div className="fixed inset-0 z-[300] pointer-events-none">
      {/* Water splash at bottom */}
      <motion.div
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 0.6 }}
        exit={{ opacity: 0 }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[40vh] w-full bg-blue-500/10 rounded-t-[50%] pointer-events-none"
      />
      {/* Champagne cork pop */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[80px] pointer-events-none"
      >
        🍾
      </motion.div>
      {/* Golden confetti */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <motion.div
          key={i}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-full bg-[#fde047] pointer-events-none"
          style={{
            width: 6 + (i % 3) * 4,
            height: 6 + (i % 3) * 4,
            x: (i - 5) * 30,
            y: (i - 5) * 20,
            opacity: 0,
          }}
          animate={{
            x: (i - 5) * 120,
            y: (i - 5) * 100 - 100,
            opacity: [0, 0.8, 0],
            transition: { duration: 1.5, delay: i * 0.05 },
          }}
        />
      ))}
      {/* The yacht */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[112px] pointer-events-none filter drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        {gift.emoji}
      </motion.div>
      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
          God Flex
        </span>
        <h2 className="text-[20px] font-black text-white leading-tight">
          @{sender} gifted{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-[#fde047]">
            {gift.name}
          </span>{" "}
          to @{receiver}
        </h2>
      </motion.div>
    </motion.div>
  );
}

/** ---------- chain-sparkle: diamond center with sparkle beams ---------- */
function ChainSparkle({
  gift,
  sender,
  receiver,
  message,
}: {
  gift: Gift;
  sender: string;
  receiver: string;
  message: string | null;
}) {
  return (
    <motion.div className="fixed inset-0 z-[300] pointer-events-none">
      {/* Sparkle beams */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[2px] w-[40px] bg-[#c9ff3d]/40 pointer-events-none"
          style={{ rotate: i * 45, opacity: 0, transformOrigin: "center" }}
          animate={{
            opacity: [0, 0.8, 0],
            scaleX: [0.5, 1.5, 0.5],
            transition: {
              duration: 1.2,
              delay: i * 0.08,
              repeat: Infinity,
            },
          }}
        />
      ))}
      {/* The diamond */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: 1,
          scaleX: [ 0.8, 1, 0.8 ],
          opacity: [ 0.7, 1, 0.7 ],
          transition: { repeat: Infinity, duration: 2, ease: "easeInOut" },
        }}
        exit={{ opacity: 0 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[112px] pointer-events-none filter drop-shadow-[0_0_40px_rgba(201,255,61,0.5)]"
      >
        {gift.emoji}
      </motion.div>
      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
          Drip Flex
        </span>
        <h2 className="text-[20px] font-black text-white leading-tight">
          @{sender} gifted{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-[#c9ff3d]">
            {gift.name}
          </span>{" "}
          to @{receiver}
        </h2>
        {message && (
          <p className="text-[12px] text-white/60 leading-relaxed max-w-md text-center">
            “{message}”
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

function renderFlexContent({
  gift,
  sender,
  receiver,
  message,
}: {
  gift: Gift;
  sender: string;
  receiver: string;
  message: string | null;
}) {
  switch (gift.animation) {
    case "drive-by":
      return <DriveByFlex gift={gift} sender={sender} receiver={receiver} message={message} />;
    case "jet-flyover":
      return <JetFlyover gift={gift} sender={sender} receiver={receiver} />;
    case "yacht-fireworks":
      return <YachtFireworks gift={gift} sender={sender} receiver={receiver} />;
    case "chain-sparkle":
      return <ChainSparkle gift={gift} sender={sender} receiver={receiver} message={message} />;
    default:
      return <DriveByFlex gift={gift} sender={sender} receiver={receiver} message={message} />;
  }
}

/**
 * GiftOverlayPlayer — self-contained full-screen flex overlay.
 *
 * Subscribes to the gift-drop bridge on mount, shows one gift at a time,
 * plays sound + haptic, auto-dismisses after 3.5s (pause on hover/touch),
 * and supports prefers-reduced-motion (fade only). Mount it once in the
 * app root after client hydration; trigger drops from anywhere via
 * dispatchGiftDrop(slug, sender, receiver, message).
 */
export function GiftOverlayPlayer() {
  const [queue, setQueue] = useState<GiftDrop[]>([]);
  const [showing, setShowing] = useState<GiftDrop | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissingRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Subscribe to gift drops from anywhere in the app.
  useEffect(() => {
    return subscribeToGiftDrops((drop) => {
      setQueue((prev) => [...prev, drop]);
    });
  }, []);

  // Show the next queued gift when none is currently showing.
  useEffect(() => {
    if (!showing && queue.length > 0 && !dismissingRef.current) {
      const next = queue[0];
      setQueue((prev) => prev.slice(1));
      setShowing(next);
    }
  }, [showing, queue, dismissingRef]);

  // Detect reduced motion.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Play sound + haptic when a gift starts showing.
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

  // Auto-dismiss timer.
  useEffect(() => {
    if (!showing) return;
    timerRef.current = setTimeout(dismiss, DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showing]);

  const dismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setShowing(null);
    setTimeout(() => {
      dismissingRef.current = false;
    }, reducedMotion ? 200 : 300);
  }, [reducedMotion]);

  const handlePause = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleResume = useCallback(() => {
    if (showing && !dismissingRef.current && !timerRef.current) {
      timerRef.current = setTimeout(dismiss, DISMISS_MS);
    }
  }, [showing, dismiss]);

  if (!showing) return null;

  const { gift, sender, receiver, message } = showing;
  const transition = transitionConfig(reducedMotion);

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        pointerEvents: "none",
        zIndex: 300,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      className="pointer-events-none"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition }}
          exit={{ opacity: 0, transition }}
          onMouseEnter={handlePause}
          onMouseLeave={handleResume}
          onPointerDown={handlePause}
          onPointerUp={handleResume}
          onPointerCancel={handleResume}
          className={cn(
            "pointer-events-auto fixed inset-0 z-[300] bg-zinc-950/95 backdrop-blur-md",
            !reducedMotion && "animate-in fade-in",
          )}
        >
          {renderFlexContent({ gift, sender, receiver, message })}
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
