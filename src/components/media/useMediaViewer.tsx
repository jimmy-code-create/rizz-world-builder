import { useCallback, useState, type MouseEvent as ReactMouseEvent } from "react";
import { MediaViewer } from "@/components/media/MediaViewer";

/** Images smaller than this are emoji/stickers, not photos — leave them tappable. */
const MIN_VIEWABLE_PX = 48;

/**
 * Opens the full-screen viewer when a photo or GIF inside the container is
 * tapped. Tapping text or the rest of a message does nothing, because only an
 * <img> target opens the viewer.
 *
 * Usage: const media = useMediaViewer(); ... <div onClick={media.onMediaClick}>
 * ... {media.viewer}
 */
export function useMediaViewer() {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  /** Returns true when the viewer opened, so callers can skip their own tap action. */
  const onMediaClick = useCallback((event: ReactMouseEvent): boolean => {
    const target = event.target as HTMLElement | null;
    const image = target?.closest?.("img") as HTMLImageElement | null;
    if (!image) return false;
    if (image.dataset?.noViewer === "true") return false;
    // Small avatars, custom emoji and sticker thumbnails stay inline.
    if (image.clientWidth < MIN_VIEWABLE_PX || image.clientHeight < MIN_VIEWABLE_PX) return false;
    const url = image.currentSrc || image.src;
    if (!url) return false;
    event.stopPropagation();
    setAlt(image.alt || "");
    setSrc(url);
    return true;
  }, []);

  const viewer = <MediaViewer open={!!src} src={src ?? ""} alt={alt} onClose={() => setSrc(null)} />;

  return { onMediaClick, viewer, openMedia: setSrc };
}
