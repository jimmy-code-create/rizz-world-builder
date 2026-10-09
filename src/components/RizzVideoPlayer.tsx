import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Maximize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

type IosVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function RizzVideoPlayer({ src, label = "Post video" }: { src: string; label?: string }) {
  const videoRef = useRef<IosVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setEnhanced(true);
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video || error) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        setPlaying(false);
      }
    } else {
      video.pause();
    }
  };

  const toggleFullscreen = async () => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) return;
    const iosVideo = video as IosVideoElement;
    try {
      if (document.fullscreenElement === frame) {
        await document.exitFullscreen();
      } else if (frame.requestFullscreen) {
        await frame.requestFullscreen();
      } else if (iosVideo.webkitDisplayingFullscreen && iosVideo.webkitExitFullscreen) {
        iosVideo.webkitExitFullscreen();
      } else {
        iosVideo.webkitEnterFullscreen?.();
      }
    } catch {
      iosVideo.webkitEnterFullscreen?.();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches("input, button")) return;
    if (event.key === " " || event.key.toLowerCase() === "k") {
      event.preventDefault();
      void togglePlayback();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const video = videoRef.current;
      if (video) video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + (event.key === "ArrowRight" ? 5 : -5)));
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      setMuted((value) => {
        if (videoRef.current) videoRef.current.muted = !value;
        return !value;
      });
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      void toggleFullscreen();
    }
  };

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    setError(false);
    setLoading(true);
    video.load();
  };

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={label}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === videoRef.current) void togglePlayback();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className={`rizz-video-player group relative isolate w-full overflow-hidden bg-[#090710] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rizz-pink)] ${fullscreen ? "flex h-full flex-col justify-center" : ""}`}
    >
      <video
        ref={videoRef}
        src={src}
        controls={!enhanced || error}
        preload="metadata"
        playsInline
        aria-label={label}
        className={`mx-auto block w-full max-h-[min(48dvh,390px)] object-contain ${fullscreen ? "max-h-[calc(100dvh-5rem)]" : ""}`}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          setLoading(false);
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => { setPlaying(true); setLoading(false); setError(false); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { setLoading(false); setPlaying(false); setError(true); }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      />

      {enhanced && !error && (
        <>
          {loading && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20" aria-live="polite">
              <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-[var(--rizz-pink)]" aria-label="Loading video" />
            </div>
          )}
          {!playing && !loading && (
            <button
              type="button"
              onClick={() => void togglePlayback()}
              className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-black/35 text-white shadow-[0_8px_36px_rgba(0,0,0,.45)] backdrop-blur-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Play video"
            >
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#08060e]/95 via-[#08060e]/65 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-7">
            <div className="flex items-center gap-2.5 text-[11px] font-medium tabular-nums text-white/90">
              <button
                type="button"
                onClick={() => void togglePlayback()}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={playing ? "Pause video" : "Play video"}
              >
                {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
              </button>
              <span aria-live="off">{formatTime(currentTime)}</span>
              <span className="text-white/35">/</span>
              <span className="text-white/65">{formatTime(duration)}</span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => {
                  setMuted((value) => {
                    if (videoRef.current) videoRef.current.muted = !value;
                    return !value;
                  });
                }}
                className="grid h-8 w-8 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={muted ? "Unmute video" : "Mute video"}
                aria-pressed={muted}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="grid h-8 w-8 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <Maximize className="h-4 w-4" />
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              aria-label="Seek video"
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              onChange={(event) => {
                const nextTime = Number(event.currentTarget.value);
                if (videoRef.current) videoRef.current.currentTime = nextTime;
                setCurrentTime(nextTime);
              }}
              className="mt-0.5 block h-3 w-full cursor-pointer accent-[var(--rizz-pink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
            />
          </div>
        </>
      )}

      {enhanced && error && (
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-12 grid place-items-center bg-[#090710]/85 p-5 text-center backdrop-blur-sm">
          <div className="max-w-xs">
            <p className="font-display text-sm font-semibold">This video couldn’t load</p>
            <p className="mt-1 text-xs leading-relaxed text-white/55">Check your connection and give it another try.</p>
            <button
              type="button"
              onClick={handleRetry}
              className="pointer-events-auto mt-4 inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 text-xs font-semibold transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rizz-pink)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
