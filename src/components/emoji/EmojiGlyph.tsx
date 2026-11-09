import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { EmojiRow } from "@/lib/emoji-shared";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";

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
  // A file can fail after it was resolved (deleted, blocked CDN). Keep the word
  // and drop the picture, rather than leaving a broken box in the sentence.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [emoji?.url]);

  if (!emoji || failed) {
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
      width={20}
      height={20}
      // A fixed square box: a tall screenshot is contained, never a sliver.
      // The box is the user's emoji size, shared by every surface; cn/twMerge
      // lets a caller that needs a fixed chip glyph (h-4 w-4) override it.
      className={cn(
        "inline-block h-[var(--emoji-size)] w-[var(--emoji-size)] shrink-0 object-contain align-[-0.2em]",
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The same glyph for a unicode reaction key.
 *
 * A cat shortcode (`:cat_happy:`) is not text — it draws the pack sticker, so
 * a reaction pill, a reactor row and a super-reaction spark all show the cat
 * instead of printing the shortcode.
 */
export function UnicodeGlyph({
  value,
  className,
  size,
}: {
  value: string;
  className?: string;
  /** Sticker size for a cat key; unicode keys use the font size instead. */
  size?: number;
}) {
  const cat = value.startsWith(":") ? catNameForShortcode(value) : null;
  if (cat) {
    return (
      <span aria-hidden="true" className={cn("inline-grid place-items-center leading-none", className)}>
        <CatEmoji name={cat} size={size ?? 16} animate="hover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block text-[length:var(--emoji-size)] leading-none", className)}
    >
      {value}
    </span>
  );
}
