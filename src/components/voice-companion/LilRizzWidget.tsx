import { AlertCircle, LoaderCircle, Mic, MicOff, Sparkles, Volume2, X } from "lucide-react";
import { useState } from "react";

export type LilRizzWidgetProps = {
  status: "idle" | "listening" | "thinking" | "speaking";
  transcript: string;
  reply: string;
  isMinimized: boolean;
  loadingProgress: number;
  audioLevel: number;
  error: string | null;
  onDismiss(): void;
  onSummon(): void;
  onToggleListening(): void;
};

const statusCopy = {
  idle: { label: "On standby", detail: "Your voice, your space." },
  listening: { label: "Listening", detail: "Go on, I’m all ears." },
  thinking: { label: "Thinking", detail: "Warming up the voice locally." },
  speaking: { label: "Speaking", detail: "A little something for you." },
} as const;

export function LilRizzWidget({
  status,
  transcript,
  reply,
  isMinimized,
  loadingProgress,
  audioLevel,
  error,
  onDismiss,
  onSummon,
  onToggleListening,
}: LilRizzWidgetProps) {
  const [isPoofing, setIsPoofing] = useState(false);
  const progress = Math.min(100, Math.max(0, Number.isFinite(loadingProgress) ? loadingProgress : 0));
  const level = Math.min(1, Math.max(0, Number.isFinite(audioLevel) ? audioLevel : 0));
  const effectiveStatus = error ? "idle" : status;

  if (isMinimized) {
    return (
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] right-3 z-40 sm:right-5 md:bottom-5">
        <button
          type="button"
          onClick={() => {
            setIsPoofing(false);
            onSummon();
          }}
          aria-label="Summon Lil Rizz"
          className="group flex min-h-12 items-center gap-2.5 rounded-full border border-[var(--rizz-pink)]/35 bg-[rgba(20,14,29,0.96)] py-2 pl-2 pr-4 text-sm font-semibold text-foreground shadow-[0_12px_36px_rgba(5,2,12,0.55),0_0_22px_rgba(255,45,146,0.18)] backdrop-blur-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        >
          <LilRizzMark compact />
          <span>pspsps</span>
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[var(--rizz-cyan)] transition-transform group-hover:rotate-12 motion-reduce:transition-none" />
        </button>
      </div>
    );
  }

  const copy = statusCopy[effectiveStatus];
  const isBusy = effectiveStatus === "thinking";
  const isListening = effectiveStatus === "listening";
  const isSpeaking = effectiveStatus === "speaking";

  return (
    <section
      aria-label="Lil Rizz voice companion"
      style={isPoofing ? { animation: "rizz-companion-poof 260ms ease-in forwards" } : undefined}
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.4rem] border border-white/10 bg-[linear-gradient(145deg,rgba(34,22,43,0.97),rgba(17,13,26,0.98))] text-foreground shadow-[0_20px_60px_rgba(4,2,10,0.62),0_0_34px_rgba(255,45,146,0.12)] backdrop-blur-2xl sm:right-5 md:bottom-5"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(255,45,146,0.15),transparent_55%),radial-gradient(ellipse_at_100%_5%,rgba(6,182,212,0.1),transparent_42%)]" />
      <div className="relative">
        <header className="flex items-center gap-3 px-4 pb-3 pt-4">
          <LilRizzMark active={isBusy || isListening || isSpeaking} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[15px] font-bold tracking-tight">Lil Rizz</h2>
              <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.13em] text-white/60">
                voice pal
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5" aria-live="polite">
              {error ? (
                <AlertCircle aria-hidden="true" className="h-3 w-3 text-rose-300" />
              ) : isBusy ? (
                <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin text-[var(--rizz-cyan)] motion-reduce:animate-none" />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${isListening ? "bg-[var(--rizz-cyan)]" : isSpeaking ? "bg-[var(--rizz-pink)]" : "bg-white/35"}`} />
              )}
              <span className={`text-[11px] ${error ? "text-rose-200" : isListening ? "text-[var(--rizz-cyan)]" : isSpeaking ? "text-pink-200" : "text-muted-foreground"}`}>
                {error ? "Voice unavailable" : copy.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isPoofing) return;
              setIsPoofing(true);
              window.setTimeout(onDismiss, 260);
            }}
            aria-label="Dismiss Lil Rizz"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-cyan)] motion-reduce:transition-none"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="px-4 pb-4 pt-3">
          {error ? (
            <div role="alert" className="flex gap-2.5 rounded-xl border border-rose-300/20 bg-rose-400/[0.08] px-3 py-2.5">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-rose-100">Can’t reach your mic right now</p>
                <p className="mt-0.5 break-words text-[11px] leading-relaxed text-rose-100/70">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {(transcript || reply) ? (
                <div className="space-y-2.5">
                  {transcript && (
                    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--rizz-cyan)]">You said</p>
                      <p className="line-clamp-3 text-xs leading-relaxed text-white/80">{transcript}</p>
                    </div>
                  )}
                  {reply && (
                    <div className="rounded-xl border border-[var(--rizz-pink)]/15 bg-[var(--rizz-pink)]/[0.07] px-3 py-2.5">
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-pink-200">Lil Rizz</p>
                      <p className="line-clamp-4 text-xs leading-relaxed text-white/90">{reply}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5 text-xs leading-relaxed text-white/60">
                  {isListening ? "Say what’s on your mind…" : copy.detail}
                </p>
              )}

              {isBusy && (
                <div className="mt-3" aria-label={`Voice response progress: ${Math.round(progress)} percent`}>
                  <div className="mb-1.5 flex items-center justify-between text-[10px] text-white/55">
                    <span>Loading the voice model</span>
                    <span className="tabular-nums">{Math.round(progress)}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                    className="h-1 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--rizz-pink)] to-[var(--rizz-cyan)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {(isListening || isSpeaking) && (
                <div className="mt-3 flex h-5 items-center justify-center gap-[3px]" aria-hidden="true">
                  {Array.from({ length: 17 }, (_, index) => {
                    const wave = [0.35, 0.58, 0.84, 0.48, 0.72, 1, 0.55, 0.82, 0.42, 0.74, 0.95, 0.5, 0.78, 0.38, 0.65, 0.9, 0.46][index];
                    const height = 4 + level * wave * 18;
                    return (
                      <span
                        key={index}
                        className={`w-[3px] rounded-full ${isListening ? "bg-[var(--rizz-cyan)]" : "bg-[var(--rizz-pink)]"}`}
                        style={{ height: `${height}px`, opacity: 0.4 + level * 0.6 }}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="mt-3">
            <button
              type="button"
              onClick={onToggleListening}
              aria-label={isListening ? "Stop listening to Lil Rizz" : "Start talking to Lil Rizz"}
              aria-pressed={isListening}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17111f] motion-reduce:transition-none ${
                isListening
                  ? "bg-[var(--rizz-cyan)] text-[#10151b] hover:brightness-110"
                  : "bg-gradient-primary text-white shadow-[0_6px_20px_rgba(255,45,146,0.22)] hover:brightness-110"
              }`}
            >
              {isListening ? <MicOff aria-hidden="true" className="h-4 w-4" /> : isSpeaking ? <Volume2 aria-hidden="true" className="h-4 w-4" /> : <Mic aria-hidden="true" className="h-4 w-4" />}
              {isListening ? "Stop listening" : "Talk to Lil Rizz"}
            </button>
          </div>
          <p className="mt-2 text-center text-[9px] leading-relaxed text-white/35">
            {error ? "Check microphone access and try again." : "Mic is opt-in. Kokoro runs locally; recognition uses your browser."}
          </p>
        </div>
      </div>
    </section>
  );
}

function LilRizzMark({ compact = false, active = false }: { compact?: boolean; active?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-[1rem] border border-white/15 bg-[linear-gradient(145deg,#ff4fa8,#9b42d9_58%,#3bcde0)] shadow-[0_4px_18px_rgba(255,45,146,0.28)] ${compact ? "h-9 w-9 rounded-full" : "h-11 w-11"} ${active ? "ring-2 ring-[var(--rizz-cyan)]/60 ring-offset-2 ring-offset-[#21162a]" : "animate-[rizz-cat-purr_3s_ease-in-out_infinite] motion-reduce:animate-none"}`}
    >
      <span className="absolute inset-[1px] rounded-[inherit] bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.8),transparent_28%),linear-gradient(145deg,rgba(255,255,255,0.13),transparent_55%)]" />
      <svg viewBox="0 0 48 48" className={`relative ${compact ? "h-7 w-7" : "h-9 w-9"}`} fill="none">
        <path d="M9 21 13 8l9 8c1.3-.3 2.6-.3 4 0l9-8 4 13c1 2.1 1.5 4.2 1.5 6.3 0 9.1-7.5 14.7-16.5 14.7S8.5 36.4 8.5 27.3c0-2.1.2-4.2.5-6.3Z" fill="#251634" stroke="rgba(255,255,255,.84)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m14 14 5.8 4.1M34 14l-5.8 4.1" stroke="#ff94d0" strokeWidth="2" strokeLinecap="round" />
        <path d="M17.5 27.5c1.2-1.4 2.4-1.4 3.6 0M27 27.5c1.2-1.4 2.4-1.4 3.6 0" stroke="#fff4fb" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M21 33c1.8 1.7 4.2 1.7 6 0" stroke="#71eafa" strokeWidth="2" strokeLinecap="round" />
        <path d="m10 31-4 1m5 4-3 3m27-7 4 1m-5 4 3 3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
      </svg>
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_7px_rgba(255,255,255,.9)]" />
    </div>
  );
}

export default LilRizzWidget;
