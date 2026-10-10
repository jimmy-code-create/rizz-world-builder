import { LoaderCircle, Mic, X } from "lucide-react";
import { useEffect, useState } from "react";

export type LilRizzWidgetProps = {
  status: "idle" | "listening" | "thinking" | "speaking";
  transcript: string;
  reply: string;
  isConversationActive: boolean;
  isMinimized: boolean;
  loadingProgress: number;
  audioLevel: number;
  error: string | null;
  onDismiss(): void;
  onSummon(): void;
  onToggleListening(): void;
};

const statusLabels = {
  idle: "Tap to talk",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
} as const;

export function LilRizzOrbWidget({
  status,
  transcript,
  reply,
  isConversationActive,
  isMinimized,
  loadingProgress,
  audioLevel,
  error,
  onDismiss,
  onSummon,
  onToggleListening,
}: LilRizzWidgetProps) {
  const [isPoofing, setIsPoofing] = useState(false);
  const [isPillVisible, setIsPillVisible] = useState(false);
  const activeText = error || (status === "listening" ? transcript : reply || transcript);
  const progress = Math.min(100, Math.max(0, loadingProgress));
  const level = Math.min(1, Math.max(0, audioLevel));

  useEffect(() => {
    if (!activeText) {
      setIsPillVisible(false);
      return;
    }
    setIsPillVisible(true);
    const timer = window.setTimeout(() => setIsPillVisible(false), 6500);
    return () => window.clearTimeout(timer);
  }, [activeText]);

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsPoofing(false);
          onSummon();
        }}
        aria-label="Summon Lil Rizz"
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-4 z-40 rounded-full border border-pink-300/35 bg-[#160f20]/95 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_25px_rgba(255,45,146,.35)] backdrop-blur-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none md:bottom-5"
      >
        pspsps
      </button>
    );
  }

  const listening = status === "listening";
  const speaking = status === "speaking";
  const thinking = status === "thinking";
  const ringColor = listening ? "#ff32a6" : speaking ? "#22d3ee" : "#c026d3";

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-4 z-40 flex flex-col items-end gap-2 md:bottom-5"
      aria-label="Lil Rizz voice companion"
    >
      {activeText && (
        <div
          role={error ? "status" : "log"}
          aria-live="polite"
          className={`max-w-[min(19rem,calc(100vw-2rem))] rounded-full border px-4 py-2 text-xs leading-relaxed text-white shadow-[0_8px_28px_rgba(0,0,0,.34)] backdrop-blur-xl transition-opacity duration-500 ${
            error
              ? "border-rose-300/35 bg-[#24121c]/90"
              : "border-white/15 bg-[#17101f]/85"
          } ${isPillVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
        >
          <span className="line-clamp-3">{activeText}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span
          className="rounded-full border border-white/10 bg-[#17101f]/80 px-2.5 py-1 text-[10px] font-medium text-white/65 backdrop-blur"
          aria-live="polite"
        >
          {statusLabels[status]}
          {thinking && loadingProgress > 0 ? ` · ${Math.round(progress)}%` : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            if (isPoofing) return;
            setIsPoofing(true);
            window.setTimeout(onDismiss, 260);
          }}
          aria-label="Dismiss Lil Rizz"
          className="grid h-7 w-7 place-items-center rounded-full bg-[#17101f]/80 text-white/55 backdrop-blur transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleListening}
        aria-label={isConversationActive ? "End voice conversation" : "Tap to talk with Lil Rizz"}
        aria-pressed={isConversationActive}
        style={{
          animation: isPoofing ? "rizz-companion-poof 260ms ease-in forwards" : undefined,
          boxShadow: speaking
            ? `0 0 ${14 + level * 30}px rgba(34,211,238,${0.2 + level * 0.42}), 0 0 38px rgba(255,45,146,.22)`
            : undefined,
        }}
        className={`relative grid h-[4.25rem] w-[4.25rem] place-items-center rounded-full border border-white/25 bg-[linear-gradient(145deg,#ff4fa8,#9b42d9_58%,#23cce4)] shadow-[0_7px_28px_rgba(255,45,146,.38)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transition-none ${
          listening
            ? "animate-[lil-rizz-orb-pulse_1.25s_ease-in-out_infinite]"
            : thinking
              ? "animate-[lil-rizz-orb-pulse_1.8s_ease-in-out_infinite]"
              : ""
        } motion-reduce:animate-none ${isPoofing ? "pointer-events-none" : ""}`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-[-5px] rounded-full border"
          style={{
            borderColor: `${ringColor}88`,
            transform: speaking ? `scale(${1 + level * 0.14})` : undefined,
            opacity: speaking ? 0.35 + level * 0.55 : listening ? 0.8 : 0.25,
          }}
        />
        {thinking ? (
          <LoaderCircle aria-hidden="true" className="absolute -top-1 -right-1 z-10 h-5 w-5 animate-spin rounded-full bg-[#17101f] p-0.5 text-cyan-200 motion-reduce:animate-none" />
        ) : listening ? (
          <Mic aria-hidden="true" className="absolute -top-1 -right-1 z-10 h-5 w-5 rounded-full bg-[#17101f] p-0.5 text-cyan-200" />
        ) : speaking ? (
          <span aria-hidden="true" className="absolute -top-1 -right-1 z-10 flex h-5 items-end gap-[2px] rounded-full bg-[#17101f] px-1 py-1">
            {[0.3, 0.7, 1, 0.5].map((bar, index) => (
              <span
                key={index}
                className="w-[2px] rounded-full bg-cyan-200"
                style={{ height: `${4 + level * bar * 8}px` }}
              />
            ))}
          </span>
        ) : (
          <Mic aria-hidden="true" className="absolute -top-1 -right-1 z-10 h-5 w-5 rounded-full bg-[#17101f] p-0.5 text-white/70" />
        )}
        <CatAvatar />
      </button>
    </div>
  );
}

function CatAvatar() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-12 w-12 drop-shadow">
      <path d="M9 21 13 8l9 8c1.3-.3 2.6-.3 4 0l9-8 4 13c1 2.1 1.5 4.2 1.5 6.3 0 9.1-7.5 14.7-16.5 14.7S8.5 36.4 8.5 27.3c0-2.1.2-4.2.5-6.3Z" fill="#251634" stroke="rgba(255,255,255,.9)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m14 14 5.8 4.1M34 14l-5.8 4.1" stroke="#ff94d0" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.5 27.5c1.2-1.4 2.4-1.4 3.6 0M27 27.5c1.2-1.4 2.4-1.4 3.6 0" stroke="#fff4fb" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M21 33c1.8 1.7 4.2 1.7 6 0" stroke="#71eafa" strokeWidth="2" strokeLinecap="round" />
      <path d="m10 31-4 1m5 4-3 3m27-7 4 1m-5 4 3 3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}
