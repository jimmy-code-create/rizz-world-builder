const GIF_MARKER_PATTERN =
  /!\[gif\]\((https:\/\/(?:media\d*\.giphy\.com|i\.giphy\.com)\/[^)\s]+)\)/gi;

export function renderGifSegments(text: string) {
  return text.split(GIF_MARKER_PATTERN).map((part, index) => ({
    isGif: index % 2 === 1,
    value: part,
  }));
}
