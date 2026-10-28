import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chat media (photos, GIFs) shared by DMs, groups and realm chat.
 *
 * Media never sits inside a message bubble: it gets its own 16px-radius frame,
 * a capped size and a skeleton, so an image cannot paint the gradient bubble
 * behind it or shift the list while it decodes. Tapping opens the lightbox via
 * the surrounding `useMediaViewer` click handler (a plain <img> target).
 *
 * A broken attachment used to collapse the frame into a thin empty bar, which
 * read as a rendering glitch. It now says what happened and offers a retry,
 * instead of leaving a grey sliver where a photo should be.
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
  const [failed, setFailed] = useState(false);
  // Bumping the key remounts the <img>, which forces a fresh request instead of
  // reusing the browser's failed entry for that URL.
  const [attempt, setAttempt] = useState(0);
  const ratio = width && height ? `${width} / ${height}` : undefined;

  const retry = () => {
    setFailed(false);
    setLoaded(false);
    setAttempt((current) => current + 1);
  };

  return (
    <div
      className={cn("chat-media-frame", className)}
      style={failed || !ratio ? undefined : { aspectRatio: ratio }}
    >
      {failed ? (
        <div className="chat-media-failed">
          <ImageOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">Image didn’t load</span>
          <button
            type="button"
            data-interactive="true"
            onClick={(event) => {
              event.stopPropagation();
              retry();
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {!loaded && <span className="chat-media-skeleton" aria-hidden="true" />}
          <img
            key={attempt}
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
            onError={() => setFailed(true)}
            className={cn("chat-media", !loaded && "invisible")}
          />
        </>
      )}
    </div>
  );
}
