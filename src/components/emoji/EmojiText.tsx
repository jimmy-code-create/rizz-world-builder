import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useEmojiLookup, emojiMapOf, splitEmojiText } from "@/lib/emoji-shared";
import { EmojiGlyph } from "@/components/emoji/EmojiGlyph";

/**
 * Renders stored text with its custom emoji.
 *
 * `<:cat:id>` becomes the picture; if the row is gone, removed, or owned by a
 * realm the reader never joined, the same token prints as `:cat:` instead. That
 * is the whole contract: an emoji disappears, the sentence does not.
 */
export function EmojiText({
  text,
  className,
  byShortcode,
}: {
  text: string;
  className?: string;
  /** Legacy realm chat: resolve bare `:name:` too. */
  byShortcode?: Map<string, { id: string }>;
}) {
  const segments = useMemo(() => splitEmojiText(text, byShortcode), [text, byShortcode]);
  const ids = useMemo(
    () => segments.filter((segment) => segment.kind === "emoji").map((segment) => segment.id),
    [segments],
  );
  const lookup = useEmojiLookup(ids);
  const map = useMemo(() => emojiMapOf(lookup.data), [lookup.data]);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={`t-${index}`}>{segment.text}</span>
        ) : (
          <EmojiGlyph
            key={`e-${segment.id}-${index}`}
            emoji={map.get(segment.id)}
            shortcode={segment.shortcode}
            className="mx-[1px]"
          />
        ),
      )}
    </span>
  );
}
