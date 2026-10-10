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
import { FormEvent, useEffect, useRef, useState } from "react";

export type LilRizzWidgetProps = {
  status: "idle" | "listening" | "thinking" | "speaking";
  transcript: string;
  lastUserMessage: string;
  reply: string;
  isConversationActive: boolean;
  isMinimized: boolean;
  isBusy: boolean;
  error: string | null;
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

export function LilRizzOrbWidget({
  status,
  transcript,
  lastUserMessage,
  reply,
  isConversationActive,
  isMinimized,
  isBusy,
  error,
  onDismiss,
  onSummon,
  onToggleListening,
  onSendMessage,
  onReplay,
}: LilRizzWidgetProps) {
  const [message, setMessage] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);
  const listening = status === "listening";
  const thinking = status === "thinking";
  const speaking = status === "speaking";

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, lastUserMessage, reply]);

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMessage = message.trim();
    if (!nextMessage || isBusy) return;
    onSendMessage(nextMessage);
    setMessage("");
  };

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={onSummon}
        aria-label="Open Lil Rizz chat"
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-4 z-40 flex items-center gap-2 rounded-full border border-pink-300/25 bg-[#17101f]/95 p-2 pr-4 text-left text-white shadow-[0_8px_32px_rgba(0,0,0,.42),0_0_28px_rgba(255,45,146,.22)] backdrop-blur-xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none md:bottom-5"
      >
        <CatAvatar className="h-9 w-9" />
        <span>
          <span className="block text-xs font-bold">Lil Rizz</span>
          <span className="block text-[10px] text-white/55">Your cat sidekick</span>
        </span>
        <MessageCircle aria-hidden="true" className="ml-1 h-4 w-4 text-cyan-200" />
      </button>
    );
  }

  return (
    <section
      aria-label="Lil Rizz voice assistant"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-3 z-40 flex max-h-[min(34rem,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#120e19]/95 text-white shadow-[0_18px_70px_rgba(0,0,0,.54),0_0_46px_rgba(179,49,188,.12)] backdrop-blur-2xl md:bottom-5 md:right-5"
    >
      <header className="flex items-center gap-3 border-b border-white/[.08] bg-gradient-to-r from-[#28152a] via-[#1b1424] to-[#111521] px-4 py-3.5">
        <div className="relative shrink-0">
          <CatAvatar className="h-11 w-11" />
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
            <h2 className="truncate text-sm font-extrabold tracking-tight">Lil Rizz</h2>
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
        {!lastUserMessage && !transcript && !reply && (
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
          role="status"
          className="mx-4 mb-2 rounded-xl border border-rose-300/15 bg-rose-400/[.08] px-3 py-2 text-[11px] leading-relaxed text-rose-100/90"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-white/[.08] bg-white/[.025] p-3"
      >
        <button
          type="button"
          onClick={onToggleListening}
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
      </form>
    </section>
  );
}

function CatAvatar({ className = "" }: { className?: string }) {
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
      <path
        d="M15.5 25.8c1.6-1.5 3.3-1.5 4.9 0m7.2 0c1.6-1.5 3.3-1.5 4.9 0"
        stroke="#fff5fb"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path d="m21.5 30.2 2.5 1.8 2.5-1.8-2.5-1.4-2.5 1.4Z" fill="#ff85c8" />
      <path
        d="M24 32v1.3m0 0c-1.5 2-3.3 2.2-4.7.8m4.7-.8c1.5 2 3.3 2.2 4.7.8"
        stroke="#c8f7ff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="m10.7 29.8-4.2-.8m4.3 4-3.8.4m30.3-3.6 4.2-.8m-4.3 4 3.8.4"
        stroke="#f9eaff"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity=".85"
      />
      <circle cx="18" cy="25" r=".8" fill="#c8f7ff" />
      <circle cx="30" cy="25" r=".8" fill="#c8f7ff" />
    </svg>
  );
}
