/**
 * Emoji-only and emoji-heavy text gets a larger size so a caption that is just
 * "🔥🔥" reads like a post instead of a stray character — but it stays capped,
 * because a wall of emoji blown up to display size is worse than a small one.
 *
 * Returns a Tailwind class string to append to the text element, or null when
 * the text should keep its normal size.
 */

/** An emoji or pictograph, including ZWJ sequences and skin-tone modifiers. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;
const EMOJI_ANY = /\p{Extended_Pictographic}/u;

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment);
  }
  return [...text];
}

/**
 * Comment threads stack many one-liners, so the same emoji wall has to stay a
 * step smaller there than it does in a post caption. Pass "comment" for rows
 * inside a thread.
 */
export function emojiTextClass(
  text: string | null | undefined,
  scale: "post" | "comment" | "chat" = "post",
): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  // Long captions are prose; leave them alone.
  if (!trimmed || trimmed.length > 140) return null;

  const parts = graphemes(trimmed);
  const visible = parts.filter((part) => part.trim().length > 0);
  if (!visible.length) return null;

  const emojis = visible.filter((part) => EMOJI_ONLY.test(part));
  if (!emojis.length) return null;

  const emojiShare = emojis.length / visible.length;

  // Pure emoji: the whole message is the emoji.
  if (emojis.length === visible.length) {
    if (scale === "chat") {
      if (emojis.length <= 3) return "text-[2.25rem] leading-[1.2] py-1 inline-block";
      if (emojis.length <= 9) return "text-2xl leading-snug py-0.5 inline-block";
      return "text-xl leading-snug";
    }
    if (scale === "comment") {
      if (emojis.length <= 3) return "text-2xl leading-tight";
      if (emojis.length <= 9) return "text-xl leading-snug";
      return "text-lg leading-snug";
    }
    if (emojis.length <= 3) return "text-[2.5rem] leading-[1.15]";
    if (emojis.length <= 9) return "text-[2rem] leading-tight";
    return "text-2xl leading-snug";
  }

  // Emoji with a few words around them: a gentle bump, never huge.
  if (scale === "comment" || scale === "chat") {
    return emojiShare >= 0.5 ? "text-base leading-relaxed" : null;
  }
  if (emojiShare >= 0.5) return "text-lg leading-relaxed";
  if (emojiShare >= 0.25) return "text-base leading-relaxed";
  return null;
}

/** True when the text carries at least one emoji (used for live previews). */
export function hasEmoji(text: string | null | undefined): boolean {
  return !!text && EMOJI_ANY.test(text);
}
