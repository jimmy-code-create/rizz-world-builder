"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  AtSign,
  Coins,
  Flame,
  MessageSquare,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/i18n";
import {
  subscribeToInAppNotifications,
  type InAppNotification,
} from "@/lib/in-app-notifications";

const PILL_LIFETIME_MS = 4000;
const EXIT_MS = 300;
const HAPTIC_PATTERN = [25, 40, 25];
const CHIME_THROTTLE_MS = 1500;

type PillMeta = {
  icon: LucideIcon;
  badge: string;
  tag: string;
};

const TYPE_META: Record<InAppNotification["type"], PillMeta> = {
  dm: { icon: MessageSquare, badge: "bg-emerald-500 text-white", tag: "DM" },
  mention: { icon: AtSign, badge: "bg-violet-500 text-white", tag: "MENTION" },
  reaction: { icon: Flame, badge: "bg-[#ff6b5e] text-white", tag: "REACTION" },
  paws_gift: { icon: Coins, badge: "bg-amber-400 text-black", tag: "GIFT" },
  voice_room: { icon: Radio, badge: "bg-[#c9ff3d] text-black", tag: "LIVE" },
};

let lastChimeAt = 0;
let audioContext: AudioContext | null = null;

/** One short, zero-download mechanical pop. */
function playChime(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastChimeAt < CHIME_THROTTLE_MS) return;
  lastChimeAt = now;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;

  try {
    if (!audioContext) audioContext = new Ctor();
    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => undefined);
    }
    const start = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, start);
    oscillator.frequency.exponentialRampToValueAtTime(1320, start + 0.06);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.07);
  } catch {
    // Audio is a nicety; permission or device failures must not break the pill.
  }
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration is best-effort.
  }
}

function toPillType(value: unknown): InAppNotification["type"] {
  switch (value) {
    case "mention":
    case "group_mention":
      return "mention";
    case "reaction":
    case "story_reaction":
    case "like":
      return "reaction";
    case "paws_gift":
    case "gift":
      return "paws_gift";
    case "voice_room":
    case "call":
      return "voice_room";
    case "dm":
    case "message":
    default:
      return "dm";
  }
}

/** Service-worker payload → the same shape the test bridge dispatches. */
function pillFromPush(payload: Record<string, unknown>): InAppNotification {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const type = toPillType(data.type ?? payload.type);
  const actor =
    typeof data.actor_username === "string"
      ? data.actor_username
      : typeof data.actor === "string"
        ? data.actor
        : null;
  const target =
    typeof data.url === "string"
      ? data.url
      : typeof payload.url === "string"
        ? payload.url
        : null;
  const avatar =
    typeof data.actor_avatar_url === "string"
      ? data.actor_avatar_url
      : typeof payload.icon === "string"
        ? payload.icon
        : null;

  return {
    id:
      typeof payload.tag === "string"
        ? payload.tag
        : `${type}-${Date.now()}`,
    type,
    actor,
    body: typeof payload.body === "string" ? payload.body : null,
    target_url: target,
    avatar_url: avatar,
    created_at:
      typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
    is_test: data.type === "test" || payload.type === "test",
  };
}

export function RizzInAppPill() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [queue, setQueue] = useState<InAppNotification[]>([]);
  const [current, setCurrent] = useState<InAppNotification | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const currentRef = useRef<InAppNotification | null>(null);
  const dismissingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineRef = useRef(0);
  const remainingRef = useRef(PILL_LIFETIME_MS);
  const draggedRef = useRef(false);
  const dismissRef = useRef<() => void>(() => undefined);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissCurrent = useCallback(() => {
    if (!currentRef.current || dismissingRef.current) return;
    dismissingRef.current = true;
    setDismissing(true);
    clearTimer();
    currentRef.current = null;
    setCurrent(null);
    window.setTimeout(() => {
      dismissingRef.current = false;
      setDismissing(false);
    }, reducedMotion ? 200 : EXIT_MS);
  }, [clearTimer, reducedMotion]);

  dismissRef.current = dismissCurrent;

  const startTimer = useCallback(
    (duration = PILL_LIFETIME_MS) => {
      clearTimer();
      if (!currentRef.current) return;
      const ms = Math.max(0, duration);
      remainingRef.current = ms;
      deadlineRef.current = Date.now() + ms;
      timerRef.current = setTimeout(() => dismissRef.current(), ms);
    },
    [clearTimer],
  );

  const pauseTimer = useCallback(() => {
    if (!currentRef.current) return;
    remainingRef.current = Math.max(0, deadlineRef.current - Date.now());
    clearTimer();
  }, [clearTimer]);

  const resumeTimer = useCallback(() => {
    if (!currentRef.current) return;
    startTimer(remainingRef.current || PILL_LIFETIME_MS);
  }, [startTimer]);

  // Local bridge: test panel and other app surfaces.
  useEffect(() => subscribeToInAppNotifications((notification) => {
    setQueue((prev) => [...prev, notification]);
  }), []);

  // Service worker pushes while the app is visible.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        notification?: Record<string, unknown>;
      } | null;
      if (data?.type !== "SHOW_IN_APP_PILL" || !data.notification) return;
      setQueue((prev) => [...prev, pillFromPush(data.notification!)]);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Advance the queue only after the previous pill's exit is finished.
  useEffect(() => {
    if (current || dismissing || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    currentRef.current = next;
    setCurrent(next);
  }, [queue, current, dismissing]);

  // Arm the lifetime timer, haptic, and chime for each new pill.
  useEffect(() => {
    if (!current) return;
    remainingRef.current = PILL_LIFETIME_MS;
    startTimer(PILL_LIFETIME_MS);
    vibrate(HAPTIC_PATTERN);
    playChime();
    return clearTimer;
  }, [current, startTimer, clearTimer]);

  const handleTap = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    const notification = currentRef.current;
    if (!notification) return;
    const url = notification.target_url;
    dismissCurrent();
    if (url && typeof url === "string" && url.startsWith("/")) {
      router.history.push(url);
    }
  }, [dismissCurrent, router]);

  const meta = current ? TYPE_META[current.type] : null;
  const Icon = meta?.icon ?? MessageSquare;

  if (!mounted) return null;

  const transition = reducedMotion
    ? { duration: 0.2 }
    : { type: "spring" as const, stiffness: 450, damping: 32 };

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-2 z-[9999] mx-auto w-[calc(100%-24px)] max-w-[390px]"
      style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {current && meta ? (
          <motion.div
            key={current.id}
          initial={reducedMotion ? { opacity: 0 } : { y: -60, opacity: 0, scale: 0.95 }}
          animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { y: -60, opacity: 0, scale: 0.92 }}
          transition={transition}
          drag={reducedMotion ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.25, bottom: 0 }}
          onDragStart={() => {
            draggedRef.current = false;
            pauseTimer();
          }}
          onDrag={(_, info) => {
            if (info.offset.y < -10) draggedRef.current = true;
            if (info.offset.y < -20) dismissCurrent();
          }}
          onDragEnd={(_, info) => {
            if (info.offset.y < -20) dismissCurrent();
            else resumeTimer();
            // Let a real click after the drag settle before accepting taps again.
            window.setTimeout(() => {
              draggedRef.current = false;
            }, 0);
          }}
          onPointerDown={pauseTimer}
          onPointerUp={resumeTimer}
          onPointerLeave={resumeTimer}
          onMouseEnter={pauseTimer}
          onMouseLeave={resumeTimer}
          onClick={handleTap}
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-white/12 bg-zinc-950/90 p-2.5 pl-3 pr-3 text-left shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
        >
          <div className="relative h-[38px] w-[38px] shrink-0">
            <Avatar className="h-[38px] w-[38px] ring-1 ring-white/10">
              <AvatarImage src={current.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-zinc-800 text-[11px] font-bold text-zinc-100">
                {(current.actor || "R").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full ring-2 ring-zinc-950",
                meta.badge,
              )}
            >
              <Icon size={10} strokeWidth={2.4} aria-hidden="true" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center">
              <span className="truncate text-xs font-bold tracking-tight text-white">
                {current.actor ? `@${current.actor}` : "RIZZ"}
              </span>
              <span className="ml-1.5 shrink-0 font-mono text-[10px] font-medium text-lime-400">
                {current.is_test ? "TEST" : meta.tag}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs font-normal leading-tight text-zinc-300">
              {current.body || "New notification"}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="font-mono text-[10px] text-zinc-400">
              {formatRelativeTime(current.created_at)}
            </span>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[#c9ff3d] shadow-[0_0_6px_rgba(201,255,61,0.9)]"
            />
          </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
