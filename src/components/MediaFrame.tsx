import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Any image block in the product UI.
 *
 * Height is reserved up front from `ratio`, a skeleton shimmer covers the frame
 * until the image has actually decoded, and a failed load renders a labelled
 * fallback instead of nothing. That is the root fix for "blank grey media
 * rectangle": a frame with no asset, no height or a path typo can no longer
 * show up as an unexplained empty box.
 */
export function MediaFrame({
  src,
  alt,
  ratio = "4 / 3",
  className,
  imgClassName,
  fallback = "Image unavailable",
  eager = false,
}: {
  src: string;
  alt: string;
  /** CSS aspect-ratio, e.g. "4 / 3". Reserves the height so nothing collapses. */
  ratio?: string;
  className?: string;
  imgClassName?: string;
  /** Shown when the image fails to load — never a blank block. */
  fallback?: string;
  /** Above-the-fold media should be eager, not lazy. */
  eager?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const imgRef = useRef<HTMLImageElement>(null);

  // A cached image can finish decoding before React attaches onLoad, and then
  // the event never fires — the frame would sit under its shimmer forever. Adopt
  // the element's own state once, on mount, so that case is impossible.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    setState(img.naturalWidth > 0 ? "ready" : "error");
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[6px] border border-border bg-[var(--brand-ink-3)]",
        className,
      )}
      style={{ aspectRatio: ratio }}
    >
      {state === "loading" && <span aria-hidden className="skeleton-shimmer absolute inset-0 block" />}
      {state === "error" ? (
        <span className="absolute inset-0 grid place-items-center px-3 text-center text-[11px] text-muted-foreground">
          {fallback}
        </span>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className={cn(
            "block h-full w-full object-cover transition-opacity duration-300",
            state === "ready" ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      )}
    </div>
  );
}
