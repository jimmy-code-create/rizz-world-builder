import {
  LoaderCircle,
  MessageCircle,
  Mic,
  MicOff,
  Minus,
  Send,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type RizzMood = "idle" | "listening" | "thinking" | "talking" | "happy" | "surprised";

export type LilRizzWidgetProps = {
  status: "idle" | "listening" | "thinking" | "speaking";
  transcript: string;
  lastUserMessage: string;
  reply: string;
  isConversationActive: boolean;
  isMinimized: boolean;
  isBusy: boolean;
  isHandsFree: boolean;
  error: string | null;
  isGuest: boolean;
  isAuthLoading: boolean;
  signInLink: ReactNode;
  onDismiss(): void;
  onSummon(): void;
  onToggleListening(): void;
  onSendMessage(message: string): void;
  onReplay(): void;
};

const statusLabels = {
  idle: "Ready when you are",
  listening: "Listening to you",
  thinking: "Thinking of a reply",
  speaking: "Talking to you",
} as const;

function moodFrom(status: LilRizzWidgetProps["status"], justSpoke: boolean): RizzMood {
  if (status === "listening") return "listening";
  if (status === "thinking") return "thinking";
  if (status === "speaking") return "talking";
  return justSpoke ? "happy" : "idle";
}

export function LilRizzOrbWidget({
  status,
  transcript,
  lastUserMessage,
  reply,
  isConversationActive,
  isMinimized,
  isBusy,
  isHandsFree,
  error,
  isGuest,
  isAuthLoading,
  signInLink,
  onDismiss,
  onSummon,
  onToggleListening,
  onSendMessage,
  onReplay,
}: LilRizzWidgetProps) {
  const [message, setMessage] = useState("");
  const [justSpoke, setJustSpoke] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = "lil-rizz-panel";
  const listening = status === "listening";
  const thinking = status === "thinking";
  const speaking = status === "speaking";

  useEffect(() => {
    if (status !== "speaking") return;
    setJustSpoke(true);
    const t = window.setTimeout(() => setJustSpoke(false), 1400);
    return () => window.clearTimeout(t);
  }, [status]);

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, lastUserMessage, reply]);

  useEffect(() => {
    if (isMinimized) {
      launcherRef.current?.focus();
      return;
    }
    if (messageInputRef.current) messageInputRef.current.focus();
    else panelRef.current?.focus();
  }, [isMinimized]);

  useEffect(() => {
    if (isMinimized) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMinimized, onDismiss]);

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMessage = message.trim();
    if (!nextMessage || isBusy || isGuest || isAuthLoading) return;
    onSendMessage(nextMessage);
    setMessage("");
  };

  if (isMinimized) {
    return (
      <DraggableBubble
        ref={launcherRef}
        mood={moodFrom(status, justSpoke)}
        listening={listening}
        speaking={speaking}
        isHandsFree={isHandsFree}
        onClick={onSummon}
      />
    );
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={onDismiss}
        aria-label="Minimize Lil Rizz chat"
        aria-expanded={true}
        aria-controls={panelId}
        tabIndex={-1}
        className="sr-only"
      />
      <section
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-labelledby="lil-rizz-title"
        tabIndex={-1}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-3 z-[60] flex max-h-[calc(100dvh-env(safe-area-inset-bottom,0px)-6.5rem)] w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#120e19]/95 text-white shadow-[0_18px_70px_rgba(0,0,0,.54),0_0_46px_rgba(179,49,188,.12)] backdrop-blur-2xl md:bottom-5 md:right-5 md:max-h-[min(34rem,calc(100dvh-2.5rem))]"
      >
      <header className="flex items-center gap-3 border-b border-white/[.08] bg-gradient-to-r from-[#28152a] via-[#1b1424] to-[#111521] px-4 py-3.5">
        <div className="relative shrink-0">
          <CatAvatar className="h-11 w-11" mood={moodFrom(status, justSpoke)} mouthOpen={speaking ? undefined : 0} />
          <span
            aria-hidden="true"
            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#191321] ${
              listening
                ? "bg-pink-400 shadow-[0_0_9px_rgba(255,45,146,.8)]"
                : speaking
                  ? "bg-cyan-300"
                  : "bg-emerald-400"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 id="lil-rizz-title" className="truncate text-sm font-extrabold tracking-tight">Lil Rizz</h2>
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-pink-300" />
          </div>
          <p className="mt-0.5 text-[11px] text-white/55" aria-live="polite">
            {statusLabels[status]}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hide Lil Rizz"
          className="grid h-8 w-8 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <Minus aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>

      <div
        ref={conversationRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        className="min-h-28 space-y-3 overflow-y-auto px-4 py-4"
      >
        {isGuest && !isAuthLoading && !lastUserMessage && !transcript && !reply && (
          <div className="flex min-h-24 flex-col items-center justify-center text-center">
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-2xl border border-pink-300/15 bg-pink-400/[.08]">
              <MessageCircle aria-hidden="true" className="h-5 w-5 text-pink-200" />
            </div>
            <p className="text-sm font-semibold">Come chat with me.</p>
            <p className="mt-1 max-w-52 text-xs leading-relaxed text-white/55">
              Sign in to start a conversation with Lil Rizz.
            </p>
            <div className="mt-3 text-xs">{signInLink}</div>
          </div>
        )}
        {isAuthLoading && !lastUserMessage && !transcript && !reply && (
          <div className="flex min-h-24 items-center justify-center text-xs text-white/55" role="status">
            Checking your sign-in…
          </div>
        )}
        {!isGuest && !isAuthLoading && !lastUserMessage && !transcript && !reply && (
          <div className="flex min-h-24 flex-col items-center justify-center text-center">
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-2xl border border-pink-300/15 bg-pink-400/[.08]">
              <MessageCircle aria-hidden="true" className="h-5 w-5 text-pink-200" />
            </div>
            <p className="text-sm font-semibold">What’s the scene?</p>
            <p className="mt-1 max-w-52 text-xs leading-relaxed text-white/50">
              Talk to me or type a message. I’m listening.
            </p>
          </div>
        )}

        {(lastUserMessage || (listening && transcript)) && (
          <div className="ml-8 rounded-2xl rounded-br-md border border-pink-300/15 bg-pink-500/[.13] px-3.5 py-2.5">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[.16em] text-pink-200/75">
              You
            </p>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/90">
              {listening && transcript ? transcript : lastUserMessage}
            </p>
          </div>
        )}

        {thinking && (
          <div className="flex items-center gap-2 px-1 text-xs text-white/55">
            <LoaderCircle
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin text-cyan-200 motion-reduce:animate-none"
            />
            Lil Rizz is thinking…
          </div>
        )}

        {reply && (
          <div className="mr-5 rounded-2xl rounded-bl-md border border-cyan-200/10 bg-white/[.06] px-3.5 py-3">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="text-[9px] font-bold uppercase tracking-[.16em] text-cyan-200/75">
                Lil Rizz
              </p>
              <button
                type="button"
                onClick={onReplay}
                aria-label="Play Lil Rizz's reply aloud"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-cyan-100/75 transition hover:bg-cyan-200/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <Volume2 aria-hidden="true" className="h-3 w-3" />
                Replay
              </button>
            </div>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/90">
              {reply}
            </p>
            {speaking && <p className="mt-2 text-[10px] text-cyan-100/55">Speaking aloud</p>}
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mx-4 mb-2 rounded-xl border border-rose-300/15 bg-rose-400/[.08] px-3 py-2 text-[11px] leading-relaxed text-rose-100/90"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-white/[.08] bg-white/[.025] p-3"
      >
        {isGuest || isAuthLoading ? (
          <div className="flex w-full items-center justify-between gap-3 px-1 py-1 text-xs text-white/55">
            <span>{isGuest ? "Sign in to use chat and voice." : "Checking sign-in…"}</span>
            {isGuest && signInLink}
          </div>
        ) : (
          <>
        <button
          type="button"
          onClick={onToggleListening}
          disabled={isGuest || isAuthLoading}
          aria-label={
            listening
              ? "Stop listening"
              : isConversationActive
                ? "Continue voice conversation"
                : "Talk to Lil Rizz"
          }
          aria-pressed={isConversationActive}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
            listening
              ? "border-pink-300/30 bg-pink-400/20 text-pink-100 shadow-[0_0_18px_rgba(255,45,146,.18)]"
              : "border-white/10 bg-white/[.06] text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          {listening ? (
            <MicOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Mic aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
        <label htmlFor="lil-rizz-message" className="sr-only">
          Message Lil Rizz
        </label>
        <input
          ref={messageInputRef}
          id="lil-rizz-message"
          value={message}
          maxLength={400}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Message Lil Rizz…"
          disabled={isBusy}
          className="h-10 min-w-0 flex-1 rounded-full border border-white/[.09] bg-black/20 px-4 text-xs text-white outline-none placeholder:text-white/35 focus:border-cyan-200/35 focus:ring-2 focus:ring-cyan-200/10 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!message.trim() || isBusy}
          aria-label="Send message"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-600 text-white shadow-[0_4px_14px_rgba(221,45,160,.24)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isBusy ? (
            <LoaderCircle
              aria-hidden="true"
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <Send aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
          </>
        )}
      </form>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Floating bubble — a text-less, draggable, animated cat character.
// ---------------------------------------------------------------------------

const BUBBLE_POS_KEY = "rizz:rizz-bubble-pos";

function DraggableBubble({
  ref,
  mood,
  listening,
  speaking,
  isHandsFree,
  onClick,
}: {
  ref: React.Ref<HTMLButtonElement>;
  mood: RizzMood;
  listening: boolean;
  speaking: boolean;
  isHandsFree: boolean;
  onClick(): void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  // Restore persisted position once mounted (viewport-aware clamp).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BUBBLE_POS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { x: number; y: number };
        setPos({
          x: Math.min(Math.max(parsed.x, 8), window.innerWidth - 76),
          y: Math.min(Math.max(parsed.y, 8), window.innerHeight - 76),
        });
        return;
      }
    } catch {
      /* ignore */
    }
    // Default: bottom-right above the tab bar.
    setPos({ x: window.innerWidth - 76, y: window.innerHeight - 150 });
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPos((current) =>
        current
          ? {
              x: Math.min(Math.max(current.x, 8), window.innerWidth - 76),
              y: Math.min(Math.max(current.y, 8), window.innerHeight - 76),
            }
          : current,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const persist = useCallback((next: { x: number; y: number }) => {
    try {
      localStorage.setItem(BUBBLE_POS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origX: pos?.x ?? 0,
      origY: pos?.y ?? 0,
      moved: false,
    };
  }, [pos]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    const next = {
      x: Math.min(Math.max(drag.origX + dx, 8), window.innerWidth - 76),
      y: Math.min(Math.max(drag.origY + dy, 8), window.innerHeight - 76),
    };
    setPos(next);
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (!drag) return;
    if (drag.moved) {
      persist(pos ?? { x: drag.origX, y: drag.origY });
    } else {
      onClick();
    }
  }, [onClick, persist, pos]);

  // Mouth animation while talking: smooth pseudo-random oscillation driven by
  // rAF so the mouth/face move with the speech (no external audio API needed).
  const mouthRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!speaking) {
      if (mouthRef.current) mouthRef.current.style.transform = "scaleY(0.18)";
      if (faceRef.current) faceRef.current.style.transform = "translateY(0px)";
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      // Two overlapping sines ≈ syllabic rhythm (fast mouth + slow bob).
      const mouth = 0.18 + 0.82 * Math.abs(Math.sin(t * 9.2) * 0.7 + Math.sin(t * 5.1) * 0.3);
      const bob = Math.sin(t * 4.4) * 1.1;
      if (mouthRef.current) mouthRef.current.style.transform = `scaleY(${mouth.toFixed(3)})`;
      if (faceRef.current) faceRef.current.style.transform = `translateY(${bob.toFixed(2)}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  if (!pos) return null;

  return (
    <button
      ref={ref}
      type="button"
      aria-label={listening ? "Rizz is listening — tap to open" : "Open Lil Rizz"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
      className="fixed z-[60] h-16 w-16 select-none rounded-full border border-pink-300/30 bg-[#1a1224]/92 shadow-[0_8px_32px_rgba(0,0,0,.45),0_0_30px_rgba(255,45,146,.28)] backdrop-blur-xl transition-shadow hover:shadow-[0_8px_32px_rgba(0,0,0,.45),0_0_38px_rgba(255,45,146,.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      {listening && (
        <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full border border-pink-400/40 motion-reduce:animate-none" />
      )}
      {isHandsFree && (
        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1a1224] bg-cyan-300" />
      )}
      <CatAvatar className="h-full w-full p-1.5" mood={mood} mouthRef={mouthRef} faceRef={faceRef} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cat character with mood expressions + animated mouth/face.
// ---------------------------------------------------------------------------

function CatAvatar({
  className = "",
  mood = "idle",
  mouthOpen,
  mouthRef,
  faceRef,
}: {
  className?: string;
  mood?: RizzMood;
  /** 0..1 override for static (non-animated) mouths. */
  mouthOpen?: number;
  mouthRef?: React.RefObject<SVGGElement | null>;
  faceRef?: React.RefObject<SVGGElement | null>;
}) {
  const open = mouthOpen ?? (mood === "surprised" ? 0.8 : mood === "listening" ? 0.35 : 0.18);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className={`${className} drop-shadow-[0_2px_8px_rgba(255,45,146,.2)]`}
    >
      <defs>
        <linearGradient
          id="lil-rizz-fur"
          x1="8"
          y1="8"
          x2="42"
          y2="43"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#553267" />
          <stop offset="1" stopColor="#211629" />
        </linearGradient>
        <linearGradient
          id="lil-rizz-inner-ear"
          x1="14"
          y1="11"
          x2="37"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ff9acb" />
          <stop offset="1" stopColor="#c56ae8" />
        </linearGradient>
      </defs>
      {/* Ears perk up when listening/surprised. */}
      <g transform={mood === "listening" || mood === "surprised" ? "translate(0 -1.5)" : undefined}>
        <path
          d="M8.5 21 12.2 6.5l10.1 8.1c1.2-.2 2.4-.2 3.6 0l10-8.1L40 21c1.1 2.2 1.7 4.3 1.7 6.4 0 9-7.6 14.8-17.7 14.8S6.3 36.4 6.3 27.4c0-2.1.8-4.3 2.2-6.4Z"
          fill="url(#lil-rizz-fur)"
          stroke="#f9eaff"
          strokeOpacity=".9"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="m14.3 13.1 5.3 4.2m14.2-4.2-5.3 4.2"
          stroke="url(#lil-rizz-inner-ear)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
      {/* Face group — bobbed during speech. */}
      <g ref={faceRef} style={{ transition: "transform 120ms ease-out" }}>
        {mood === "happy" ? (
          // Closed happy eyes ^ ^
          <>
            <path d="M15 26.5c1.4-1.8 3.4-1.8 4.8 0M28.2 26.5c1.4-1.8 3.4-1.8 4.8 0" stroke="#fff5fb" strokeWidth="2.3" strokeLinecap="round" fill="none" />
          </>
        ) : mood === "surprised" ? (
          // Big wide eyes
          <>
            <circle cx="18" cy="25.5" r="3" fill="#fff5fb" />
            <circle cx="30" cy="25.5" r="3" fill="#fff5fb" />
            <circle cx="18" cy="25.5" r="1.4" fill="#211629" />
            <circle cx="30" cy="25.5" r="1.4" fill="#211629" />
          </>
        ) : mood === "thinking" ? (
          // Glance up-left
          <>
            <path d="M15.5 25.8c1.6-1.5 3.3-1.5 4.9 0m7.2 0c1.6-1.5 3.3-1.5 4.9 0" stroke="#fff5fb" strokeWidth="2.3" strokeLinecap="round" />
            <circle cx="17" cy="24.4" r=".8" fill="#c8f7ff" />
            <circle cx="29" cy="24.4" r=".8" fill="#c8f7ff" />
          </>
        ) : (
          // Default open eyes
          <>
            <path d="M15.5 25.8c1.6-1.5 3.3-1.5 4.9 0m7.2 0c1.6-1.5 3.3-1.5 4.9 0" stroke="#fff5fb" strokeWidth="2.3" strokeLinecap="round" />
            <circle cx="18" cy="25" r=".8" fill="#c8f7ff" />
            <circle cx="30" cy="25" r=".8" fill="#c8f7ff" />
          </>
        )}
        <path d="m21.5 30.2 2.5 1.8 2.5-1.8-2.5-1.4-2.5 1.4Z" fill="#ff85c8" />
        {/* Mouth: a small stroked arc scaled on Y for talking. */}
        <g
          ref={mouthRef}
          style={{
            transformOrigin: "24px 32.5px",
            transform: `scaleY(${open})`,
            transition: mouthRef ? "none" : "transform 200ms ease-out",
          }}
        >
          <path
            d="M20.6 32.5c1 2.4 2.4 3.4 3.4 3.4s2.4-1 3.4-3.4"
            stroke="#c8f7ff"
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </g>
      <path
        d="m10.7 29.8-4.2-.8m4.3 4-3.8.4m30.3-3.6 4.2-.8m-4.3 4 3.8.4"
        stroke="#f9eaff"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity=".85"
      />
    </svg>
  );
}
