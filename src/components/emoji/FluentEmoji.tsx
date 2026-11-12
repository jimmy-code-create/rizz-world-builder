import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Microsoft Fluent Emoji, addressed by Unicode.
 *
 * The official Microsoft repo stores assets under CLDR names, which would mean
 * shipping a name map for every glyph. `shuding/fluentui-emoji-unicode` mirrors
 * the same artwork with Unicode codepoint filenames, so a glyph can become a URL
 * without a lookup table. Pinned to a commit: a moving `main` would silently
 * change the artwork under the app.
 *
 * Only Fluent artwork is drawn here. If an asset is missing (Microsoft does not
 * ship country flags, for example) the cell becomes a quiet ink square rather
 * than falling back to a Google/system emoji glyph.
 */
const FLUENT_ASSETS =
  "https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode@7a40f1a2d064d76e436813edc0f09b6c8cde5da8/assets";

// Cells are re-rendered as rows enter the viewport, and the same glyph appears
// in messages and previews over and over. The mapping is pure, so one small
// cache removes the per-render codepoint walk without holding image data.
const URL_CACHE = new Map<string, string>();

export function fluentEmojiCodePoints(glyph: string): string {
  return (
    Array.from(glyph)
      // Fluent's filenames use at least four hex digits: keycaps are `0023`,
      // not `23`, while ordinary emoji keep their natural five (`1f44b`).
      .map((part) => part.codePointAt(0)?.toString(16).padStart(4, "0"))
      .filter((part): part is string => Boolean(part) && part !== "fe0f")
      .join("-")
  );
}

export function fluentEmojiUrl(glyph: string): string {
  const cached = URL_CACHE.get(glyph);
  if (cached !== undefined) return cached;
  const code = fluentEmojiCodePoints(glyph);
  const url = code ? `${FLUENT_ASSETS}/${code}_color.svg` : "";
  URL_CACHE.set(glyph, url);
  return url;
}

export const FluentEmoji = memo(function FluentEmoji({
  glyph,
  size = 24,
  className,
  label,
  decorative = true,
  priority = false,
  eager = false,
}: {
  glyph: string;
  size?: number;
  className?: string;
  /** Used only when the emoji carries meaning on its own. */
  label?: string;
  /** Inside a labelled button the image should stay out of the a11y tree. */
  decorative?: boolean;
  /** True only for a preview/hero image that is already on screen. */
  priority?: boolean;
  /**
   * True for cells inside an already-virtualised grid: they are on screen by
   * construction, so waiting for the lazy-load intersection just delays paint.
   */
  eager?: boolean;
}) {
  const url = fluentEmojiUrl(glyph);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [url]);

  if (!url || failed) {
    return (
      <span
        aria-hidden="true"
        className={cn("fluent-emoji-fallback", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={url}
      ref={(node) => {
        // A cached image can finish before React attaches its load listener.
        // Mark it here so the layered glyph in the picker hides immediately.
        if (node?.complete) node.dataset.loaded = "true";
      }}
      alt={decorative ? "" : (label ?? glyph)}
      {...(decorative ? { "aria-hidden": true as const } : {})}
      width={size}
      height={size}
      loading={priority || eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : eager ? "auto" : "low"}
      draggable={false}
      className={cn("fluent-emoji", className)}
      style={{ width: size, height: size }}
      // A CSS-only "art is ready" hook. Virtualised grids layer the unicode
      // glyph underneath so a cell is never blank, and hide it the moment this
      // attribute flips without a React render per image.
      onLoad={(event) => {
        event.currentTarget.dataset.loaded = "true";
      }}
      onError={() => setFailed(true)}
    />
  );
});
