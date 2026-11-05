import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isAnimatedSticker,
  markStickerFailed,
  markStickerLoaded,
  stickerLoadState,
  type Sticker,
} from "@/lib/stickers";

type LoadStatus = "loading" | "loaded" | "failed";

function retryUrl(src: string): string {
  return `${src}${src.includes("?") ? "&" : "?"}retry=1`;
}

/**
 * Renders one sticker tile.
 *
 * The original picker put every sticker URL in an `<img>`. Black cat and Noto
 * ship WebM files, which an `<img>` can never decode — that was the broken-image
 * icon. Here animated stickers become muted looping `<video>` elements with
 * their PNG poster as the first paint; static packs (Kotya) stay images.
 *
 * Both paths share a one-shot retry, a shimmer placeholder, and a clean
 * fallback that never exposes the raw alt text. A module-level cache means a
 * revisit to the same pack paints immediately.
 */
export function StickerMedia({
  sticker,
  className,
  preview = false,
}: {
  sticker: Sticker;
  className?: string;
  preview?: boolean;
}) {
  const video = isAnimatedSticker(sticker);
  const [status, setStatus] = useState<LoadStatus>(() => {
    const cached = stickerLoadState(sticker.src);
    return cached === "loaded" ? "loaded" : cached === "failed" ? "failed" : "loading";
  });
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(preview || !video);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const cached = stickerLoadState(sticker.src);
    setStatus(cached === "loaded" ? "loaded" : cached === "failed" ? "failed" : "loading");
    setAttempt(0);
    setVisible(preview || !video);
  }, [sticker.src, preview, video]);

  useEffect(() => {
    if (!video || preview) return;
    const element = rootRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px 0px", threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [video, preview]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (visible && status !== "failed") {
      void element.play().catch(() => {
        /* Autoplay can be rejected until the poster paints; the poster remains. */
      });
    } else {
      element.pause();
    }
    return () => element.pause();
  }, [visible, status, attempt]);

  const src = attempt === 0 ? sticker.src : retryUrl(sticker.src);
  const poster = sticker.poster;

  const fail = () => {
    if (attempt === 0) {
      setAttempt(1);
      setStatus("loading");
      return;
    }
    markStickerFailed(sticker.src);
    setStatus("failed");
  };

  const settle = () => {
    markStickerLoaded(sticker.src);
    setStatus("loaded");
  };

  return (
    <span
      ref={rootRef}
      className={cn(
        "relative grid h-full w-full place-items-center overflow-hidden",
        className,
      )}
    >
      {status === "loading" && (
        <span className="sticker-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
      )}

      {status === "failed" ? (
        <span className="flex flex-col items-center gap-1 text-muted-foreground">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span className="text-[9px] font-medium uppercase tracking-wider">Sticker</span>
        </span>
      ) : video ? (
        <video
          key={attempt}
          ref={videoRef}
          src={visible ? src : undefined}
          poster={poster}
          muted
          loop
          playsInline
          autoPlay={visible}
          preload="none"
          aria-hidden="true"
          onLoadedData={settle}
          onCanPlay={settle}
          onError={fail}
          className={cn(
            "h-full w-full object-contain transition-opacity duration-150",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={settle}
          onError={fail}
          className={cn(
            "h-full w-full object-contain transition-opacity duration-150",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}
