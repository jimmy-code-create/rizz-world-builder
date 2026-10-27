const MEDIA_MARKER_PATTERN =
  /!\[(gif|sticker)\]\((https:\/\/(?:media\d*\.giphy\.com|i\.giphy\.com)\/[^)\s]+|\/stickers\/(?:noto|black-cat|kotya)\/[a-z0-9/_-]+\.(?:webm|png))\)/gi;

/**
 * True when a message is nothing but a GIF or sticker marker.
 *
 * A body like `![gif](…)` has no words, so it must be treated as media — not as
 * text — or the picture ends up inside a coloured message bubble with padding
 * around it, which is what made media-only messages look like a giant empty card.
 */
export function isOnlyMediaMarker(text: string | null | undefined) {
  const value = (text ?? "").trim();
  if (!value) return false;
  const segments = renderGifSegments(value);
  const media = segments.filter((segment) => segment.isGif || segment.isSticker);
  if (media.length === 0) return false;
  return segments.every((segment) => segment.isGif || segment.isSticker || !segment.value.trim());
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
