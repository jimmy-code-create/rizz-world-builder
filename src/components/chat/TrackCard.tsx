import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, ExternalLink } from "lucide-react";
import { formatDuration } from "@/lib/music";

export type TrackCardPayload = {
  type: "track";
  queueId?: string;
  title: string;
  artist?: string | null;
  url?: string | null;
  artwork?: string | null;
  preview?: string | null;
  duration?: number | null;
  position?: number | null;
};

/**
 * The card MUSIC BOT inserts with `music_add`: artwork, credits, and the
 * 30-second preview the iTunes API provides. The preview never autoplays.
 */
export function TrackCard({ card }: { card: TrackCardPayload }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => { audioRef.current?.pause(); }, []);
  if (!card.preview) {
    return (
      <div className="mt-1 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-primary/20 text-[var(--rizz-pink)]">
          <Music className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{card.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{card.artist ?? "Queued"}</span>
        </span>
      </div>
    );
  }

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true), () => setPlaying(false));
    }
  };

  return (
    <div className="mt-1 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause ${card.title}` : `Play a preview of ${card.title}`}
        className="group relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-primary text-white shadow-sm"
      >
        {card.artwork ? (
          <img src={card.artwork} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Music className="h-5 w-5" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </span>
      </button>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{card.title}</span>
          {card.position ? (
            <span className="shrink-0 rounded-full border border-white/10 px-1.5 text-[10px] font-bold text-muted-foreground">
              #{card.position}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {card.artist ?? "Unknown artist"}
          {card.duration ? ` · ${formatDuration(card.duration)}` : ""}
        </span>
      </span>

      {card.url && (
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${card.title}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
      <audio
        ref={audioRef}
        src={card.preview}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
