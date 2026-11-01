import { useMemo } from "react";
import { customReactionId, emojiMapOf, useEmojiLookup } from "@/lib/emoji-shared";
import { EmojiGlyph, UnicodeGlyph } from "@/components/emoji/EmojiGlyph";

/**
 * Draws a reaction key, whichever kind it is.
 *
 * A unicode key is text; a `ce:<id>` key is looked up and drawn as its image.
 * If the emoji was removed, or the reader left its realm, the glyph degrades to
 * `:emoji:` rather than printing `ce:9f2c…`. Use this anywhere a raw reaction
 * key would otherwise be shown — chips, sheets, tab bars.
 */
export function ReactionKeyGlyph({
  reactionKey,
  className,
  fallbackClassName,
}: {
  reactionKey: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const id = customReactionId(reactionKey);
  const lookup = useEmojiLookup(id ? [id] : []);
  const map = useMemo(() => emojiMapOf(lookup.data), [lookup.data]);

  if (!id) return <UnicodeGlyph value={reactionKey} className={className} />;

  return (
    <EmojiGlyph
      emoji={map.get(id)}
      shortcode="emoji"
      className={className}
      fallbackClassName={fallbackClassName}
    />
  );
}
