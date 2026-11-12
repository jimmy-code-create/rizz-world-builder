import { useEffect, useState } from "react";
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

export function fluentEmojiCodePoints(glyph: string): string {
  return Array.from(glyph)
    // Fluent's filenames use at least four hex digits: keycaps are `0023`,
    // not `23`, while ordinary emoji keep their natural five (`1f44b`).
    .map((part) => part.codePointAt(0)?.toString(16).padStart(4, "0"))
    .filter((part): part is string => Boolean(part) && part !== "fe0f")
    .join("-");
}

export function fluentEmojiUrl(glyph: string): string {
  const code = fluentEmojiCodePoints(glyph);
  return code ? `${FLUENT_ASSETS}/${code}_color.svg` : "";
}

export function FluentEmoji({
  glyph,
  size = 24,
  className,
  label,
  decorative = true,
  priority = false,
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
      alt={decorative ? "" : (label ?? glyph)}
      {...(decorative ? { "aria-hidden": true as const } : {})}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      draggable={false}
      className={cn("fluent-emoji", className)}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
