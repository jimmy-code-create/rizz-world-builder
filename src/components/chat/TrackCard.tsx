import { useState } from "react";
import { Music, ExternalLink, Play } from "lucide-react";
import { formatDuration } from "@/lib/music";
import { MusicPlayer } from "@/components/music/MusicPlayer";
import { detectMusicSource, MUSIC_PROVIDERS } from "@/lib/music-sources";

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
 * The card MUSIC BOT inserts with `music_add`.
 *
 * It used to render nothing at all unless `preview` existed, so a queued
 * YouTube or direct-audio link showed as a bare title with no way to hear it.
 * Now the card carries the unified player: Apple previews and audio files play
 * inline, YouTube opens the official embed, and anything without audio says so
 * and offers the link instead. Nothing autoplays.
 */
export function TrackCard({ card }: { card: TrackCardPayload }) {
  const [expanded, setExpanded] = useState(false);
  const source = detectMusicSource(card.url ?? card.preview);
  const provider = MUSIC_PROVIDERS[source?.kind ?? "apple"];

  if (expanded) {
    return (
      <div className="mt-1 w-full max-w-sm">
        <MusicPlayer track={card} showVolume />
      </div>
    );
  }

  if (!card.preview && !card.url) {
    return (
      <div className="mt-1 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Music className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{card.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{card.artist ?? "Queued"}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="mt-1 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Play ${card.title} on ${provider.label}`}
        className="group relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm"
      >
        {card.artwork ? (
          <img src={card.artwork} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Music className="h-5 w-5" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/50">
          <Play className="h-5 w-5" />
        </span>
      </button>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{card.title}</span>
          <span className="shrink-0 rounded-full border border-white/10 px-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {provider.shortLabel}
          </span>
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
    </div>
  );
}
