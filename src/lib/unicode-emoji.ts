/**
 * Split prose into plain runs and single Unicode emoji graphemes.
 *
 * Fluent artwork is addressed by codepoint, so every renderer needs the same
 * answer to "is this grapheme an emoji?". Keeping the rule in one module means
 * captions, chat and the composer cannot drift on flags, keycaps or ZWJ
 * sequences.
 */

// Any string that can contain an emoji. The grapheme pass below is only paid
// when this cheap check hits, so ordinary prose keeps the fast path.
const HAS_EMOJI = /\p{Extended_Pictographic}|\uFE0F|\p{Regional_Indicator}/u;
const REGIONAL_PAIR = /^\p{Regional_Indicator}{2}$/u;
const SINGLE_EMOJI = /^\p{Emoji}$/u;

export type UnicodeEmojiPiece = { text: string; emoji?: string };

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(
      (part) => part.segment,
    );
  }
  return [...text];
}

function isEmojiGrapheme(part: string): boolean {
  if (/\p{Extended_Pictographic}/u.test(part)) return true;
  if (REGIONAL_PAIR.test(part)) return true;
  // Keycaps and text-presentation symbols carry VS16 (`1️⃣`, `❤️`).
  if (part.includes("\uFE0F")) return true;
  const chars = [...part];
  return chars.length === 1 && SINGLE_EMOJI.test(part) && !/^[0-9#*]$/.test(part);
}

export function splitUnicodeEmoji(text: string): UnicodeEmojiPiece[] {
  if (!HAS_EMOJI.test(text)) return [{ text }];
  const pieces: UnicodeEmojiPiece[] = [];
  let plain = "";
  for (const grapheme of graphemes(text)) {
    if (!isEmojiGrapheme(grapheme)) {
      plain += grapheme;
      continue;
    }
    if (plain) {
      pieces.push({ text: plain });
      plain = "";
    }
    pieces.push({ text: grapheme, emoji: grapheme });
  }
  if (plain) pieces.push({ text: plain });
  return pieces.length ? pieces : [{ text }];
}

/** True when the whole value is one emoji grapheme (`🔥`, `❤️`, `🇺🇸`). */
export function isSingleEmoji(text: string): boolean {
  const pieces = splitUnicodeEmoji(text);
  return pieces.length === 1 && Boolean(pieces[0].emoji);
}
