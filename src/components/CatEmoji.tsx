import { memo, useMemo, type ReactNode } from "react";
import { getCatEmoji, isCatEmoji, splitCatEmojiSegments } from "@/lib/cat-emojis";
import { cn } from "@/lib/utils";

export interface CatEmojiProps {
  /** Emoji name, e.g. "cat_vibe" or ":cat_vibe:" */
  name: string;
  /** Size in pixels (default: 20) or css string */
  size?: number | string;
  className?: string;
  /** When false, strips CSS animation rules */
  animated?: boolean;
}

/**
 * Universal CatEmoji Component.
 * Renders one of the 12 custom animated SVG cat emojis (<2KB each).
 * Respects prefers-reduced-motion and high-contrast settings.
 */
export const CatEmoji = memo(function CatEmoji({
  name,
  size = 20,
  className,
  animated = true,
}: CatEmojiProps) {
  const item = getCatEmoji(name);

  const cleanSvg = useMemo(() => {
    if (!item) return null;
    let svg = item.svg;
    if (!animated) {
      svg = svg.replace(/<style>[\s\S]*?<\/style>/gi, "");
    }
    return svg;
  }, [item, animated]);

  if (!item || !cleanSvg) {
    return <span className={cn("inline-block", className)}>{name}</span>;
  }

  const dimension = typeof size === "number" ? `${size}px` : size;

  return (
    <span
      role="img"
      aria-label={item.label}
      title={item.token}
      className={cn(
        "inline-grid shrink-0 place-items-center align-middle select-none leading-none overflow-hidden",
        className,
      )}
      style={{
        width: dimension,
        height: dimension,
      }}
      dangerouslySetInnerHTML={{ __html: cleanSvg }}
    />
  );
});

/**
 * Helper to render arbitrary plain text with inline <CatEmoji /> components
 * for any `:cat_xxx:` tokens.
 */
export function renderTextWithCatEmojis(
  text: string,
  emojiClass: string = "inline-block h-[1.375em] w-[1.375em] align-[-0.2em] mx-0.5",
): ReactNode[] {
  if (!text || !text.includes(":cat_")) {
    return [text];
  }
  const segments = splitCatEmojiSegments(text);
  return segments.map((seg, i) => {
    if (seg.type === "cat_emoji" && seg.name && isCatEmoji(seg.name)) {
      return (
        <CatEmoji
          key={`cat-emoji-${i}`}
          name={seg.name}
          className={emojiClass}
        />
      );
    }
    return seg.value;
  });
}
