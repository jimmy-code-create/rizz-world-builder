import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Chat media (photos, GIFs) shared by DMs, groups and realm chat.
 *
 * Media never sits inside a message bubble: it gets its own 16px-radius frame,
 * a capped size and a skeleton, so an image cannot paint the gradient bubble
 * behind it or shift the list while it decodes. Tapping opens the lightbox via
 * the surrounding `useMediaViewer` click handler (a plain <img> target).
 */
export function ChatMessageMedia({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  /** Optional stored pixel size; reserves the aspect ratio before load. */
  width?: number | null;
  height?: number | null;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const ratio = width && height ? `${width} / ${height}` : undefined;

  return (
    <div
      className={cn("chat-media-frame", className)}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {!loaded && <span className="chat-media-skeleton" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        // Chat media is the message. Lazy-loading it meant a fresh photo waited
        // for a scroll/observer tick before even starting its request, which is
        // why images felt seconds slower than the text around them.
        loading="eager"
        // The bytes are already on the origin's CDN; decode off the main thread
        // and let the browser start it at the front of the queue.
        decoding="async"
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn("chat-media", !loaded && "invisible")}
      />
    </div>
  );
}
