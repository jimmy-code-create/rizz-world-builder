import { useEffect, useRef, useState } from "react";
import { Pause, Play, Loader2, Volume2 } from "lucide-react";
import { formatDuration, voiceNoteUrl, waveformBars } from "@/lib/voice-notes";
import { toast } from "sonner";

export function VoiceNoteBubble({
  path,
  durationMs,
  mine,
}: {
  path: string;
  durationMs: number | null;
  mine: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const bars = waveformBars(path);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = async () => {
    try {
      if (!audioRef.current) {
        setLoading(true);
        const url = await voiceNoteUrl(path);
        const a = new Audio(url);
        a.onended = () => { setPlaying(false); setProgress(0); };
        a.onpause = () => setPlaying(false);
        a.onerror = () => {
          setPlaying(false);
          setLoading(false);
          toast.error("Couldn't play that voice note");
        };
        a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
        audioRef.current = a;
        setLoading(false);
      }
      if (playing) { audioRef.current.pause(); setPlaying(false); }
      else { await audioRef.current.play(); setPlaying(true); }
    } catch (e: any) {
      setLoading(false);
      toast.error(e?.message ?? "Couldn't play that voice note");
    }
  };

  return (
    <div
      className={`flex max-w-[75%] items-center gap-3 rounded-2xl px-3 py-2 ${
        mine ? "bg-gradient-primary text-primary-foreground shadow-glow" : "glass border border-white/10"
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/25"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div
        className="relative flex h-9 min-w-0 flex-1 items-center gap-[2px]"
        role="progressbar"
        aria-label="Voice note playback"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        {bars.map((b, i) => {
          const played = i / bars.length <= progress;
          return (
            <span
              key={i}
              className="min-w-[2px] flex-1 rounded-full transition-opacity duration-150"
              style={{
                height: `${Math.max(22, Math.min(100, b * 100))}%`,
                background: played ? "var(--rizz-pink)" : "currentColor",
                opacity: played ? 1 : 0.34,
              }}
            />
          );
        })}
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums opacity-80">
        {playing && <Volume2 aria-hidden="true" className="h-3 w-3" />}
        {formatDuration(durationMs ?? 0)}
      </span>
    </div>
  );
}