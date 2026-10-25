const MEDIA_MARKER_PATTERN =
  /!\[(gif|sticker)\]\((https:\/\/(?:media\d*\.giphy\.com|i\.giphy\.com)\/[^)\s]+|\/stickers\/(?:noto|black-cat|kotya)\/[a-z0-9/_-]+\.(?:webm|png))\)/gi;

/**
 * A message whose whole body is one GIF/sticker marker is media, not text:
 * it must render without a bubble, at its own width. Returns null when there
 * is any real text around the marker.
 */
export function parseMediaOnly(
  text: string,
): { src: string; kind: "gif" | "sticker" } | null {
  const trimmed = text.trim();
  const match = trimmed.match(MEDIA_MARKER_PATTERN);
  if (!match || match[0] !== trimmed) return null;
  return { src: match[2], kind: match[1].toLowerCase() === "sticker" ? "sticker" : "gif" };
}

export function renderGifSegments(text: string) {
  const segments: {
    isGif: boolean;
    isSticker: boolean;
    value: string;
    marker?: string;
  }[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MEDIA_MARKER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ isGif: false, isSticker: false, value: text.slice(lastIndex, index) });
    }
    const marker = match[0];
    const isSticker = match[1].toLowerCase() === "sticker";
    segments.push({
      isGif: !isSticker,
      isSticker,
      value: match[2],
      marker,
    });
    lastIndex = index + marker.length;
  }

  if (lastIndex < text.length || !segments.length) {
    segments.push({ isGif: false, isSticker: false, value: text.slice(lastIndex) });
  }
  return segments;
}
