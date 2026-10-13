import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Music, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  detectMusicSource,
  musicIssue,
  MUSIC_PROVIDERS,
  type MusicIssue,
  type MusicSourceKind,
} from "@/lib/music-sources";
import { channelVolume, formatVolume, useSoundSettings } from "@/lib/sound-settings";
import { setMediaVolume } from "@/lib/audio-gain";
import { createYouTubePlayer, type YouTubePlayerHandle, type YouTubePlayerState } from "@/components/music/youtube-iframe";

/**
 * ONE player for every music source.
 *
 * The brief asked for a source-agnostic music layer, and this is its face: the
 * same component plays an Apple preview or a direct audio file through an
 * `<audio>` element, and a YouTube link through the official embedded player.
 * Play, pause, seek, volume, loop and end-of-track behave identically either
 * way, which is what lets the queue, the channel panel and the in-call bot all
 * use one code path instead of "Apple only".
 */

export type MusicTrackInput = {
  id?: string;
  title: string;
  artist?: string | null;
  url?: string | null;
  artwork?: string | null;
  preview?: string | null;
  duration?: number | null;
};

export type MusicPlayerController = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (seconds: number) => void;
};

export type MusicPlayerProps = {
  track: MusicTrackInput | null;
  /** Applies that realm's bot volume override on top of the music slider. */
  realmId?: string | null;
  autoPlay?: boolean;
  /** The bot renders no chrome — it only needs the sound. */
  chromeless?: boolean;
  loop?: boolean;
  className?: string;
  onEnded?: () => void;
  /** `null` clears a previous issue. */
  onIssue?: (issue: MusicIssue | null) => void;
  /** Fires whenever playback truly starts or stops; used by the bot's state. */
  onPlayingChange?: (playing: boolean) => void;
  controllerRef?: (controller: MusicPlayerController | null) => void;
  /** Show the inline volume slider + mute (the "quick volume" control). */
  showVolume?: boolean;
};

/**
 * The shape the queue stores, which is what every caller actually has. Kept
 * here (rather than in `music.ts`) so the lib layer never depends on a
 * component.
 */
export type QueueTrackLike = {
  id?: string;
  title: string;
  artist?: string | null;
  url?: string | null;
  preview_url?: string | null;
  artwork_url?: string | null;
  duration_ms?: number | null;
};

/** Queue row -> player input. The one place the two naming schemes meet. */
export function queueTrackToMusic(track: QueueTrackLike | null | undefined): MusicTrackInput | null {
  if (!track) return null;
  return {
    id: track.id,
    title: track.title,
    artist: track.artist ?? null,
    url: track.url ?? null,
    artwork: track.artwork_url ?? null,
    preview: track.preview_url ?? null,
    duration: track.duration_ms ?? null,
  };
}

export function sourceKindOf(track: MusicTrackInput | null): MusicSourceKind {
  if (!track) return "apple";
  // A stored link is the source of truth; `preview` is only the playable URL.
  return detectMusicSource(track.url)?.kind ?? detectMusicSource(track.preview)?.kind ?? "audio";
}

/** The URL the `<audio>` element should load, or null for provider players. */
export type PlayerTrack = MusicTrackInput;

export function elementSourceOf(track: MusicTrackInput | null): string | null {
  if (!track) return null;
  if (track.preview) return track.preview;
  const detected = detectMusicSource(track.url);
  if (detected?.kind === "audio") return detected.url;
  if (detected?.kind === "apple") return null;
  return null;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function MusicPlayer({
  track,
  realmId,
  autoPlay = false,
  chromeless = false,
  loop = false,
  className,
  onEnded,
  onIssue,
  onPlayingChange,
  controllerRef,
  showVolume = false,
}: MusicPlayerProps) {
  const [settings] = useSoundSettings();
  const kind = sourceKindOf(track);
  const provider = MUSIC_PROVIDERS[kind];
  const elementSrc = kind === "youtube" ? null : elementSourceOf(track);
  const detected = useMemo(() => detectMusicSource(track?.url ?? track?.preview ?? null), [track?.url, track?.preview]);

  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [issue, setIssue] = useState<MusicIssue | null>(null);
  const [muted, setMuted] = useState(false);
  const [boostLimited, setBoostLimited] = useState(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const iframeHandle = useRef<YouTubePlayerHandle | null>(null);
  const volume = channelVolume(settings, "music", realmId);
  const effectiveVolume = muted ? 0 : volume;

  const reportIssue = useCallback(
    (next: MusicIssue | null) => {
      setIssue(next);
      onIssue?.(next);
    },
    [onIssue],
  );

  // ---- Audio element path (Apple previews, direct files) ----------------
  // A new track resets progress; the real duration arrives with the metadata.
  useEffect(() => {
    setCurrentTime(0);
    setReady(false);
    setIssue(null);
    setMediaDuration(track?.duration ? Math.round(track.duration / 1000) : 0);
  }, [elementSrc, detected?.videoId, track?.id, track?.duration]);

  useEffect(() => {
    if (kind === "youtube") return;
    if (!audio || !autoPlay || !elementSrc) return;
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        reportIssue(musicIssue("autoplay_blocked"));
        setPlaying(false);
      });
    }
  }, [audio, autoPlay, elementSrc, kind, reportIssue]);

  // ---- YouTube IFrame path ---------------------------------------------
  useEffect(() => {
    if (kind !== "youtube" || !mountRef.current || !detected) return;
    const mount = mountRef.current;
    let disposed = false;
    let handle: YouTubePlayerHandle | null = null;
    /** True once the embed has actually produced sound at least once. */
    const startedRef = { current: false };

    void createYouTubePlayer({
      mount,
      videoId: detected.videoId,
      playlistId: detected.playlistId,
      muted: effectiveVolume === 0,
      volume: effectiveVolume,
      onReady: () => {
        if (disposed) return;
        setReady(true);
        setMediaDuration(handle?.getDuration() ?? 0);
        if (!autoPlay) {
          handle?.pause();
          return;
        }
        handle?.play();
        // The IFrame API reports nothing when a browser refuses autoplay with
        // sound, so "it never started" is the signal. Reported through the same
        // autoplay_blocked path an `<audio>` element uses, which is what makes
        // the call view offer "Tap to let MUSIC BOT sing".
        window.setTimeout(() => {
          if (disposed || startedRef.current) return;
          reportIssue(musicIssue("autoplay_blocked"));
        }, 1500);
      },
      onStateChange: (state: YouTubePlayerState) => {
        if (disposed) return;
        const isPlaying = state === "playing";
        if (isPlaying) startedRef.current = true;
        setPlaying(isPlaying);
        onPlayingChange?.(isPlaying);
        if (state === "ended") {
          startedRef.current = false;
          if (loop) handle?.seekTo(0);
          else onEnded?.();
        }
      },
      onError: (reason) => {
        if (disposed) return;
        const problem = musicIssue(reason, "youtube");
        reportIssue(problem);
        setPlaying(false);
        if (!problem.retryable) onEnded?.();
      },
    })
      .then((created) => {
        if (disposed) {
          created.destroy();
          return;
        }
        handle = created;
        iframeHandle.current = created;
      })
      .catch(() => {
        if (disposed) return;
        reportIssue(musicIssue("network"));
      });

    return () => {
      disposed = true;
      iframeHandle.current = null;
      handle?.destroy();
      // YouTube replaces the mount node; keep React's tree consistent.
      mount.replaceChildren();
    };
    // Rebuilding on a volume change would restart the song, so volume is applied
    // in its own effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, detected?.videoId, detected?.playlistId, autoPlay, loop]);

  // Poll the iframe for progress, the way `timeupdate` does for an element.
  useEffect(() => {
    if (kind !== "youtube") return;
    if (!iframeHandle.current) return;
    const timer = window.setInterval(() => {
      const handle = iframeHandle.current;
      if (!handle) return;
      setCurrentTime(handle.getCurrentTime());
      const total = handle.getDuration();
      if (total) setMediaDuration(total);
    }, 500);
    return () => window.clearInterval(timer);
  }, [kind, ready]);

  // ---- Volume ----------------------------------------------------------
  useEffect(() => {
    if (kind === "youtube") {
      iframeHandle.current?.setVolume(effectiveVolume);
      return;
    }
    if (!audio) return;
    const applied = setMediaVolume(audio, effectiveVolume);
    if (!applied && effectiveVolume > 1) setBoostLimited(true);
  }, [audio, effectiveVolume, kind, ready]);

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  const play = useCallback(() => {
    if (kind === "youtube") {
      iframeHandle.current?.play();
      return;
    }
    void audio?.play().catch(() => {
      reportIssue(musicIssue("autoplay_blocked"));
      setPlaying(false);
    });
  }, [audio, kind, reportIssue]);

  const pause = useCallback(() => {
    if (kind === "youtube") {
      iframeHandle.current?.pause();
      return;
    }
    audio?.pause();
  }, [audio, kind]);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [pause, play, playing]);

  const seekTo = useCallback(
    (seconds: number) => {
      const target = Math.max(0, seconds);
      if (kind === "youtube") {
        iframeHandle.current?.seekTo(target);
        setCurrentTime(target);
        return;
      }
      if (!audio) return;
      try {
        audio.currentTime = target;
        setCurrentTime(target);
      } catch {
        // Seeking before metadata is ready is silently ignored.
      }
    },
    [audio, kind],
  );

  useEffect(() => {
    if (!controllerRef) return;
    controllerRef({ play, pause, toggle, seekTo });
    return () => controllerRef(null);
  }, [controllerRef, play, pause, toggle, seekTo]);

  const duration = mediaDuration || (track?.duration ? track.duration / 1000 : 0);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // The bot uses this player with no UI at all: mount the media, render nothing.
  if (chromeless) {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0">
        {elementSrc && (
          <audio
            ref={setAudio}
            src={elementSrc}
            preload="auto"
            playsInline
            loop={loop}
            onLoadedMetadata={(event) => {
              const node = event.currentTarget;
              setMediaDuration(Number.isFinite(node.duration) ? node.duration : 0);
              setReady(true);
            }}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={(event) => {
              setPlaying(false);
              if (loop) {
                const node = event.currentTarget;
                try {
                  node.currentTime = 0;
                  void node.play();
                } catch {
                  /* ignored */
                }
                return;
              }
              onEnded?.();
            }}
            onError={() => {
              const problem = musicIssue("network");
              reportIssue(problem);
              setPlaying(false);
              onEnded?.();
            }}
          />
        )}
        <div ref={mountRef} className="h-px w-px" />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2 sm:flex-nowrap">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? `Pause ${track?.title ?? "track"}` : `Play ${track?.title ?? "track"}`}
          className="group relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-primary text-white"
        >
          {track?.artwork ? (
            <img src={track.artwork} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Music className="h-5 w-5" />
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </span>
        </button>

        <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {track?.title ?? "Nothing queued"}
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {provider.shortLabel}
            </span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {track?.artist ?? provider.label}
            {duration > 0 ? ` · ${formatClock(duration)}` : ""}
          </p>
        </div>

        {track && (
          <>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.round(duration))}
              value={Math.round(currentTime)}
              onChange={(event) => seekTo(Number(event.target.value))}
              aria-label="Seek"
              disabled={duration <= 0}
              className="order-last h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[var(--rizz-pink)] disabled:opacity-40 sm:order-none sm:w-32"
              style={{
                background: `linear-gradient(to right, var(--rizz-pink) ${progress}%, rgba(255,255,255,0.15) ${progress}%)`,
              }}
            />
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatClock(currentTime)}
            </span>
          </>
        )}
      </div>

      {showVolume && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? "Unmute" : "Mute"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
          >
            {effectiveVolume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <Slider
            value={[Math.round(effectiveVolume * 100)]}
            min={0}
            max={200}
            step={5}
            onValueChange={([value]) => {
              setMuted(false);
              // Local override for this player only; the saved setting lives in
              // Voice & Sound and is what new players start from.
              if (audio) setMediaVolume(audio, value / 100);
              iframeHandle.current?.setVolume(value / 100);
            }}
            className="w-32"
            aria-label="Volume"
          />
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatVolume(effectiveVolume)}</span>
          {boostLimited && (
            <span className="text-[10px] text-muted-foreground" title="Streamed media from another site can only go to 100%.">
              · capped at 100%
            </span>
          )}
        </div>
      )}

      {issue && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{issue.title}</p>
            <p className="text-[11px] text-muted-foreground">{issue.detail}</p>
          </div>
          {issue.retryable ? (
            <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={play}>
              Retry
            </Button>
          ) : (
            onEnded && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 gap-1 text-xs"
                onClick={() => onEnded()}
              >
                <SkipForward className="h-3.5 w-3.5" /> Skip
              </Button>
            )
          )}
        </div>
      )}

      {elementSrc && (
        <audio
          ref={setAudio}
          src={elementSrc}
          preload="metadata"
          playsInline
          loop={loop}
          className="hidden"
          onLoadedMetadata={(event) => {
            const node = event.currentTarget;
            setMediaDuration(Number.isFinite(node.duration) ? node.duration : 0);
            setReady(true);
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => {
            setPlaying(true);
            reportIssue(null);
          }}
          onPause={() => setPlaying(false)}
          onEnded={(event) => {
            setPlaying(false);
            if (loop) {
              const node = event.currentTarget;
              try {
                node.currentTime = 0;
                void node.play();
              } catch {
                /* ignored */
              }
              return;
            }
            onEnded?.();
          }}
          onError={() => {
            reportIssue(musicIssue("network"));
            setPlaying(false);
          }}
        />
      )}

      {/* YouTube mounts here. Kept 1px (never `display:none`, which some
          browsers treat as "not playing") so audio keeps running. */}
      {kind === "youtube" && <div ref={mountRef} className="pointer-events-none mt-2 h-px w-px overflow-hidden" />}
    </div>
  );
}

export default MusicPlayer;
