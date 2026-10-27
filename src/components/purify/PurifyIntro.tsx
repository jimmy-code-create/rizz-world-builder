import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Volume2, VolumeX, X } from "lucide-react";
import { FullScreenLayer } from "@/components/FullScreenLayer";
import { haptic } from "@/lib/haptics";

/**
 * The Purify page's introduction: the brand animation, played once, before the
 * pricing card.
 *
 * The clip is the product's own advert, so it gets the one screen in the app
 * that is allowed to autoplay — and none of the usual annoyances that come with
 * it: it runs muted (browsers only allow autoplay that way), it can be skipped
 * from the first frame onwards, it never plays twice in the same visit, and it
 * does not play at all under "reduce motion" — there it waits behind a play
 * button instead.
 *
 * Swap the art by dropping a new file at PURIFY_INTRO_SRC; nothing else here
 * depends on the animation's length or aspect ratio.
 */
export const PURIFY_INTRO_SRC = "/purify/purify-intro.mp4";

const INTRO_SEEN_KEY = "rizz.purify.intro.seen";

/** The page is about to open: should the animation introduce it by itself? */
export function shouldAutoPlayPurifyIntro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1") return false;
  } catch {
    // Private mode: no session storage, so the intro simply plays each time.
  }
  // Autoplaying video is motion. The OS switch is the app's switch for motion,
  // so a member who asked for less of it gets the poster and a play button.
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* nothing to remember with */
  }
}

export function PurifyIntro({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Whether to open at all is decided by shouldAutoPlayPurifyIntro; opening by
  // hand is itself the request to play, so playback always starts on open and
  // the play button below doubles as the fallback when a browser blocks
  // autoplay anyway (iOS Low Power Mode does).
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  const finish = useCallback(() => {
    markIntroSeen();
    onClose();
  }, [onClose]);

  const start = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      // Seeking before metadata exists throws in older Safari; the clip simply
      // starts from wherever it is in that case (it is at 0 on a fresh mount).
      if (video.readyState >= 1) video.currentTime = 0;
    } catch {
      /* nothing to seek yet */
    }
    void video
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    setReady(false);
    setProgress(0);
    start();
  }, [open, start]);

  // Escape skips, like every other layer in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    setMuted(next);
    haptic("light");
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    haptic("light");
    if (video.paused) {
      void video.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <FullScreenLayer open={open}>
      {/* Tapping the backdrop skips: the animation is an introduction, never a
          gate in front of the price. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Purify introduction"
        onClick={finish}
        className="fixed inset-0 z-[120] flex flex-col bg-[var(--brand-ink,#0a0a0b)]/96 backdrop-blur-md"
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        >
          <span className="font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--brand-signal,#c9ff3d)]">
            Purify
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={muted ? "Unmute the introduction" : "Mute the introduction"}
              onClick={(event) => {
                event.stopPropagation();
                toggleMute();
              }}
              className="grid h-11 w-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <button
              type="button"
              // Keyboard users land on Skip, not on the video.
              autoFocus
              onClick={(event) => {
                event.stopPropagation();
                haptic("light");
                finish();
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-bold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Skip
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative w-fit max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_40px_120px_-40px_rgba(201,255,61,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <video
              ref={videoRef}
              src={PURIFY_INTRO_SRC}
              // The clip is the message here, so it starts loading the moment the
              // page does rather than waiting for a scroll that never happens.
              preload="auto"
              autoPlay
              muted
              playsInline
              onLoadedData={() => setReady(true)}
              onPlaying={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={finish}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (!video.duration) return;
                setProgress(video.currentTime / video.duration);
              }}
              className="block h-auto max-h-[70vh] w-auto max-w-[92vw] object-contain"
            />

            {!playing && ready && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  start();
                }}
                aria-label="Play the introduction"
                className="absolute inset-0 grid place-items-center bg-black/45 transition-colors hover:bg-black/35"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--brand-signal,#c9ff3d)] text-[var(--brand-signal-ink,#0a0a0b)] shadow-xl">
                  <Play className="ml-0.5 h-7 w-7 fill-current" />
                </span>
              </button>
            )}

            {/* The line doubles as the pause/play affordance's hit target. */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
              <div
                className="h-full bg-[var(--brand-signal,#c9ff3d)] transition-[width] duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </motion.div>
        </div>

        <div
          className="flex shrink-0 flex-col items-center gap-1 px-4 text-center"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        >
          <AnimatePresence>
            {playing && (
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(event) => {
                  event.stopPropagation();
                  togglePlay();
                }}
                className="text-[11px] font-semibold text-white/60 transition-colors hover:text-white/90"
              >
                Pause
              </motion.button>
            )}
          </AnimatePresence>
          <p className="text-[11px] font-medium text-white/45">
            A dollar a month. Tap anywhere to skip.
          </p>
        </div>
      </div>
    </FullScreenLayer>
  );
}
