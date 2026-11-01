import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { EmojiRow } from "@/lib/emoji-shared";

/**
 * One emoji, wherever it is drawn: a unicode glyph as text, a custom emoji as
 * its image. The shortcode is the fallback for both — a removed emoji, a
 * blocked CDN or a realm the reader has left all degrade to `:cat:`, never to
 * a broken image icon or a hole in the sentence.
 */
export function EmojiGlyph({
  emoji,
  shortcode,
  className,
  fallbackClassName,
}: {
  /** The resolved row, or null when it could not be loaded. */
  emoji?: Pick<EmojiRow, "url" | "shortcode" | "animated"> | null;
  /** Printed when the row is missing, so the word is never lost. */
  shortcode?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (!emoji) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded bg-white/[0.06] px-1 font-mono text-[0.85em] leading-none text-muted-foreground",
          fallbackClassName,
        )}
      >
        :{shortcode ?? "emoji"}:
      </span>
    );
  }

  // Under reduced motion the frame is the same picture, just never scaled or
  // animated by us: an uploaded GIF keeps its own loop because the file, not
  // the layout, is animated. No synthetic still frame, so no broken image.
  void reduceMotion;

  return (
    <img
      src={emoji.url}
      alt={`:${emoji.shortcode}:`}
      title={`:${emoji.shortcode}:`}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("inline-block h-[1.15em] w-[1.15em] shrink-0 object-contain align-[-0.2em]", className)}
      onError={(event) => {
        // The image is gone: swap in the shortcode rather than a broken glyph.
        const node = event.currentTarget;
        node.style.display = "none";
        node.insertAdjacentText("afterend", `:${emoji.shortcode}:`);
      }}
    />
  );
}

/** The same glyph for a unicode reaction key. */
export function UnicodeGlyph({ value, className }: { value: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-block text-[1.05em] leading-none", className)}>
      {value}
    </span>
  );
}
