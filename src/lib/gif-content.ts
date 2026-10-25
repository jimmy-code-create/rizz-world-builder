const MEDIA_MARKER_PATTERN =
  /!\[(gif|sticker)\]\((https:\/\/(?:media\d*\.giphy\.com|i\.giphy\.com)\/[^)\s]+|\/stickers\/(?:noto|black-cat|kotya)\/[a-z0-9/_-]+\.(?:webm|png))\)/gi;

/**
 * Anchored, NON-global twin used by parseMediaOnly.
 *
 * `String.match` with a /g regex returns only the full matches — no capture
 * groups — so reading `match[1]` there threw "Cannot read properties of
 * undefined (reading 'toLowerCase')" and took the whole route down whenever a
 * message body was exactly one GIF marker.
 */
const MEDIA_ONLY_PATTERN =
  /^!\[(gif|sticker)\]\((https:\/\/(?:media\d*\.giphy\.com|i\.giphy\.com)\/[^)\s]+|\/stickers\/(?:noto|black-cat|kotya)\/[a-z0-9/_-]+\.(?:webm|png))\)$/i;

/**
 * A message whose whole body is one GIF/sticker marker is media, not text:
 * it must render without a bubble, at its own width. Returns null when there
 * is any real text around the marker.
 */
export function parseMediaOnly(
  text: string,
): { src: string; kind: "gif" | "sticker" } | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  const match = trimmed.match(MEDIA_ONLY_PATTERN);
  if (!match?.[1] || !match[2]) return null;
  return { src: match[2], kind: match[1].toLowerCase() === "sticker" ? "sticker" : "gif" };
}

export function renderGifSegments(text: string) {
  if (typeof text !== "string" || !text) return [];
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
    if (!match[1] || !match[2]) {
      segments.push({ isGif: false, isSticker: false, value: marker });
      lastIndex = index + marker.length;
      continue;
    }
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
