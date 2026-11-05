import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { isVideoStickerSource } from "@/lib/stickers";

/**
 * A realm's custom emoji, drawn as an image or a muted looping video.
 *
 * Custom emoji can be animated (uploaded GIF/WebM). The sheet only plays an
 * animated one while its tile is on screen, which keeps a full rail of realm
 * emoji from decoding every loop at once on a low-end phone.
 */
export function RealmEmojiImage({
  url,
  shortcode,
  animated = false,
  className,
  imageClassName,
  eager = false,
}: {
  url: string;
  shortcode?: string;
  animated?: boolean;
  className?: string;
  imageClassName?: string;
  eager?: boolean;
}) {
  const video = animated || isVideoStickerSource(url);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(eager || !video);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setFailed(false);
    setVisible(eager || !video);
  }, [url, eager, video]);

  useEffect(() => {
    if (!video || eager) return;
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "80px 0px", threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [video, eager, url]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (visible && !failed) {
      void element.play().catch(() => {});
    } else {
      element.pause();
    }
    return () => element.pause();
  }, [visible, failed, url]);

  return (
    <span ref={rootRef} className={cn("emoji-media inline-grid place-items-center", className)}>
      {failed ? (
        // A muted chip with the shortcode: never the raw token or a uuid.
        <span className="max-w-full truncate rounded bg-white/[0.06] px-1 font-mono text-[0.72em] leading-tight text-muted-foreground">
          :{shortcode ?? "emoji"}:
        </span>
      ) : video ? (
        <video
          ref={videoRef}
          src={visible ? url : undefined}
          muted
          loop
          playsInline
          autoPlay={visible}
          preload="none"
          aria-hidden="true"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-contain", imageClassName)}
        />
      ) : (
        <img
          src={url}
          alt={shortcode ? `:${shortcode}:` : ""}
          aria-hidden={shortcode ? undefined : "true"}
          title={shortcode ? `:${shortcode}:` : undefined}
          loading="lazy"
          decoding="async"
          draggable={false}
          width={32}
          height={32}
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-contain", imageClassName)}
        />
      )}
    </span>
  );
}
