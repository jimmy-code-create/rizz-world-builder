import { useMemo, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * One premium reaction burst, shared by DMs, groups and realm channels.
 *
 * Performance rules this file keeps:
 *  - only transform and opacity are animated (no filters, no box-shadow tweens);
 *  - 14 particles maximum, precomputed once per burst;
 *  - the layer is pointer-events:none and sits outside the message list, so a
 *    burst never re-renders the chat;
 *  - at most two bursts exist at a time and each one is removed from the DOM
 *    when its animation ends.
 * With "reduce motion" on, the burst is replaced by a quick, subtle pop.
 */
export type ReactionBurstKind = "heart" | "fire" | "laugh" | "wow" | "sad" | "default";

export type ReactionBurst = {
  id: number;
  /** Viewport coordinates of the message the reaction belongs to. */
  x: number;
  y: number;
  emoji: string;
  kind: ReactionBurstKind;
};

const MAX_SIMULTANEOUS_BURSTS = 2;
export const BURST_DURATION_MS = 880;

const KIND_BY_EMOJI: Record<string, ReactionBurstKind> = {
  "❤️": "heart",
  "🖤": "heart",
  "💖": "heart",
  "💕": "heart",
  "💜": "heart",
  "💘": "heart",
  "🧡": "heart",
  "🔥": "fire",
  "😂": "laugh",
  "🤣": "laugh",
  "😹": "laugh",
  "😮": "wow",
  "😲": "wow",
  "🤯": "wow",
  "😳": "wow",
  "😢": "sad",
  "😭": "sad",
  "🥺": "sad",
  "💔": "sad",
};

export function burstKindFor(emoji: string): ReactionBurstKind {
  return KIND_BY_EMOJI[emoji] ?? "default";
}

/** A short vibration on phones that support it. Never throws. */
export function reactionHaptic(durationMs = 12) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(durationMs);
    }
  } catch {
    /* haptics are a bonus, never a failure */
  }
}

// --------------------------------------------------------------- burst store
let bursts: ReactionBurst[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return bursts;
}

/** Fires a burst over a point on screen (viewport coordinates). */
export function triggerReactionBurst(input: { x: number; y: number; emoji: string; kind?: ReactionBurstKind }) {
  const burst: ReactionBurst = {
    id: ++nextId,
    x: Math.round(input.x),
    y: Math.round(input.y),
    emoji: input.emoji,
    kind: input.kind ?? burstKindFor(input.emoji),
  };
  // More than two at once would mean a laggy phone: keep the newest two.
  bursts = [...bursts, burst].slice(-MAX_SIMULTANEOUS_BURSTS);
  emit();
  window.setTimeout(() => {
    bursts = bursts.filter((entry) => entry.id !== burst.id);
    emit();
  }, BURST_DURATION_MS + 120);
}

/** Convenience: burst centred on a DOM node. */
export function triggerBurstOnElement(element: Element | null, emoji: string) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  triggerReactionBurst({ x: rect.left + rect.width / 2, y: rect.top, emoji });
}

// ------------------------------------------------------------------ particles
type Particle = {
  key: number;
  glyph: string;
  dx: number;
  dy: number;
  rotate: number;
  scale: number;
  delay: number;
  size: number;
  sparkle: boolean;
};

/** Fans particles out in a shape that suits the emoji. */
function makeParticles(kind: ReactionBurstKind, emoji: string, reduced: boolean): Particle[] {
  if (reduced) return [];
  // 10–12 emoji particles plus the remaining sparkles keeps the whole burst at
  // 14 elements or fewer, which is the rule that protects slow phones.
  const count = 10 + Math.floor(Math.random() * 3);
  const sparkleCount = 14 - count;
  const particles: Particle[] = [];

  for (let index = 0; index < count; index += 1) {
    const spread = (index / Math.max(1, count - 1) - 0.5) * 2; // -1 … 1
    const jitter = (Math.random() - 0.5) * 0.35;
    const direction = spread + jitter;
    let dx = direction * 74;
    let dy = -34 - Math.random() * 54;
    let rotate = direction * 90;
    let scale = 0.55 + Math.random() * 0.3;

    if (kind === "heart") {
      // Hearts float up and drift, barely sideways.
      dx = direction * 46;
      dy = -58 - Math.random() * 62;
      rotate = direction * 26;
      scale = 0.5 + Math.random() * 0.35;
    } else if (kind === "fire") {
      // Flames flick upward, fast and narrow.
      dx = direction * 34;
      dy = -74 - Math.random() * 78;
      rotate = direction * 12;
      scale = 0.6 + Math.random() * 0.45;
    } else if (kind === "sad") {
      // Tears drop down and out.
      dx = direction * 40;
      dy = 30 + Math.random() * 44;
      rotate = direction * 18;
      scale = 0.45 + Math.random() * 0.3;
    } else if (kind === "laugh") {
      dx = direction * 82;
      dy = -22 - Math.random() * 46;
      rotate = direction * 150;
    } else if (kind === "wow") {
      dx = direction * 92;
      dy = -20 - Math.random() * 60;
    }

    particles.push({
      key: index,
      glyph: emoji,
      dx,
      dy,
      rotate,
      scale,
      delay: Math.random() * 0.08,
      size: 11 + Math.random() * 7,
      sparkle: false,
    });
  }

  for (let index = 0; index < sparkleCount; index += 1) {
    const direction = (index / sparkleCount - 0.5) * 2 + (Math.random() - 0.5) * 0.4;
    particles.push({
      key: 100 + index,
      glyph: "✨",
      dx: direction * 96,
      dy: -46 - Math.random() * 52,
      rotate: direction * 60,
      scale: 0.5 + Math.random() * 0.3,
      delay: 0.04 + Math.random() * 0.12,
      size: 10 + Math.random() * 6,
      sparkle: true,
    });
  }

  return particles;
}

// --------------------------------------------------------------- one burst
function BurstInstance({ burst, reduced }: { burst: ReactionBurst; reduced: boolean }) {
  const particles = useMemo(() => makeParticles(burst.kind, burst.emoji, reduced), [burst.kind, burst.emoji, reduced]);
  const bigSize = reduced ? 44 : 84;

  if (reduced) {
    // Respect "reduce motion": a quick, subtle pop and nothing else.
    return (
      <div className="pointer-events-none absolute" style={{ left: burst.x, top: burst.y, transform: "translate(-50%, -50%)" }}>
        <motion.span
          role="presentation"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: [0.9, 1, 0.98], opacity: [0, 1, 0] }}
          transition={{ duration: 0.34, ease: "easeOut" }}
          className="block will-change-transform"
          style={{ fontSize: bigSize, lineHeight: 1 }}
        >
          {burst.emoji}
        </motion.span>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute" style={{ left: burst.x, top: burst.y, transform: "translate(-50%, -50%)" }}>
      {burst.kind === "fire" && (
        <motion.span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 block rounded-full will-change-transform"
          style={{
            width: 168,
            height: 168,
            marginLeft: -84,
            marginTop: -84,
            background: "radial-gradient(circle, rgba(251,146,60,0.55) 0%, rgba(251,146,60,0) 68%)",
          }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1.15, 0.9], opacity: [0, 0.95, 0] }}
          transition={{ duration: 0.72, times: [0, 0.4, 1], ease: "easeOut" }}
        />
      )}

      {burst.kind === "wow" && (
        <motion.span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 block rounded-full border-2 border-primary/70 will-change-transform"
          style={{ width: 76, height: 76, marginLeft: -38, marginTop: -38 }}
          initial={{ scale: 0.45, opacity: 0.85 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.62, ease: "easeOut" }}
        />
      )}

      {particles.map((particle) => (
        <motion.span
          key={particle.key}
          aria-hidden="true"
          className="absolute left-0 top-0 block will-change-transform"
          style={{ fontSize: particle.size, lineHeight: 1, textShadow: particle.sparkle ? "0 0 8px rgba(255,255,255,0.65)" : undefined }}
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 0, rotate: 0 }}
          animate={{
            x: particle.dx,
            y: particle.dy,
            scale: [0.2, particle.scale, particle.scale * 0.7],
            opacity: [0, 1, 0],
            rotate: particle.rotate,
          }}
          transition={{ duration: 0.78, delay: particle.delay, ease: "easeOut" }}
        >
          {particle.glyph}
        </motion.span>
      ))}

      <motion.span
        role="presentation"
        className="relative block will-change-transform"
        style={{ fontSize: bigSize, lineHeight: 1 }}
        initial={{ scale: 0, y: 0, opacity: 0, rotate: 0 }}
        animate={
          burst.kind === "laugh"
            ? { scale: [0, 1.3, 1], y: [0, -18, -34], rotate: [0, -14, 12, -8, 0], opacity: [0, 1, 1, 0] }
            : burst.kind === "sad"
              ? { scale: [0, 1.25, 1], y: [0, 4, 22], rotate: [0, -4, 3, 0], opacity: [0, 1, 1, 0] }
              : { scale: [0, 1.3, 1, 1], y: [0, -12, -66, -70], rotate: [0, 0, 0, 0], opacity: [0, 1, 1, 0] }
        }
        transition={{
          duration: 0.84,
          times: burst.kind === "laugh" || burst.kind === "sad" ? [0, 0.28, 0.55, 0.8, 1] : [0, 0.3, 0.55, 1],
          ease: "easeOut",
        }}
      >
        {burst.emoji}
      </motion.span>
    </div>
  );
}

/**
 * Mounted once, near the app root. Renders every burst in a fixed,
 * pointer-events:none layer so the chat underneath never re-renders.
 */
export function ReactionBurstLayer() {
  const active = useSyncExternalStore(subscribe, snapshot, snapshot);
  const reduced = useReducedMotion() ?? false;

  if (!active.length) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="reaction-burst-layer"
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
      style={{ contain: "layout paint" }}
    >
      {active.map((burst) => (
        <BurstInstance key={burst.id} burst={burst} reduced={reduced} />
      ))}
    </div>
  );
}
