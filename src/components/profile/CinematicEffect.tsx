import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CINEMATIC_BY_SLUG } from "@/lib/cinematic-effects";
import { cn } from "@/lib/utils";

/**
 * A transparent loop for the cinematic profile effects.
 *
 * The poster is rendered first and stays underneath the video, so a slow
 * connection, a blocked autoplay, a browser without VP9 alpha, or a member's
 * reduced-motion preference all produce the real frame from the clip rather
 * than a black rectangle. The video is only mounted for Chromium-family
 * browsers where the alpha path is known to work; Safari and Firefox keep the
 * poster. Only one video is mounted per surface, and it pauses off-screen.
 */
export function CinematicEffect({
  slug,
  className,
  posterOnly = false,
  priority = false,
  reducedMotion,
  onPlaybackChange,
  fit = "contain",
}: {
  slug?: string | null;
  accent?: string | null;
  className?: string;
  posterOnly?: boolean;
  priority?: boolean;
  reducedMotion?: boolean;
  /** Lets the page label what is actually on screen, not what is hoped for. */
  onPlaybackChange?: (state: "live" | "still") => void;
  /** contain keeps the transparent banner sides; cover crops to the effect for a stage. */
  fit?: "contain" | "cover";
}) {
  const asset = slug ? CINEMATIC_BY_SLUG[slug] : undefined;
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const osReduced = useReducedMotion();
  const reduced = Boolean(posterOnly || reducedMotion || osReduced);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [inView, setInView] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  // A new effect starts on its poster; the previous video must not bleed
  // through while the new source is loading.
  useEffect(() => {
    setPlaying(false);
    setFailed(false);
  }, [slug]);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isFirefox = /firefox|fxios/i.test(ua);
    const probe = typeof document !== "undefined" ? document.createElement("video") : null;
    const canPlayVp9 = probe?.canPlayType('video/webm; codecs="vp9"') ?? "";
    setSupported(!isSafari && !isFirefox && Boolean(canPlayVp9));
  }, []);

  useEffect(() => {
    if (!supported || reduced || failed) return;
    const element = wrapRef.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [supported, reduced, failed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !inView || reduced || !supported || failed) return;
    if (video.readyState >= 2) {
      void video
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          // Autoplay can be blocked even when muted; the poster underneath is
          // the honest fallback. We do not surface a broken video surface.
        });
    }
  }, [inView, reduced, supported, failed, slug]);

  useEffect(() => {
    if (!inView) videoRef.current?.pause();
  }, [inView]);

  const showVideo = supported === true && !reduced && !failed;

  useEffect(() => {
    onPlaybackChange?.(showVideo && playing ? "live" : "still");
  }, [onPlaybackChange, playing, showVideo]);

  if (!asset) return null;

  const showPoster = !showVideo || !playing;
  const objectFitClass = fit === "cover" ? "object-cover" : "object-contain";

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <img
        src={asset.poster}
        alt=""
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-500",
          objectFitClass,
          showPoster ? "opacity-100" : "opacity-0",
        )}
      />
      {showVideo && (
        <video
          ref={videoRef}
          src={inView ? asset.video : undefined}
          poster={asset.poster}
          muted
          loop
          playsInline
          preload={inView ? "auto" : "none"}
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity duration-500",
            objectFitClass,
            playing ? "opacity-100" : "opacity-0",
          )}
          onCanPlay={() => {
            const video = videoRef.current;
            if (!video || !inView) return;
            void video
              .play()
              .then(() => setPlaying(true))
              .catch(() => {});
          }}
          onPlaying={() => setPlaying(true)}
          onError={() => {
            setFailed(true);
            setPlaying(false);
          }}
        />
      )}
    </div>
  );
}
