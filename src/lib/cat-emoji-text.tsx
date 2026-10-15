import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";

const SHORTCODE_RE = /:(cat_love|cat_cool|cat_sleep|cat_lol|cat_wow|cat_sus|cat_music|cat_hype|cat_gg|cat_sad|cat_wave|cat_think):/g;

/** Split text on known :cat_* shortcodes. Unknown shortcodes stay plain text. */
export function splitCatSegments(text: string): Array<{ text: string; cat?: string }> {
  const parts: Array<{ text: string; cat?: string }> = [];
  let last = 0;
  SHORTCODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SHORTCODE_RE.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[0], cat: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  if (!parts.length) parts.push({ text });
  return parts;
}

export function isOnlyCatEmoji(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  SHORTCODE_RE.lastIndex = 0;
  const stripped = t.replace(SHORTCODE_RE, "").trim();
  if (stripped !== "") return false;
  SHORTCODE_RE.lastIndex = 0;
  return (t.match(SHORTCODE_RE) ?? []).length > 0;
}

/**
 * Inline in chat/comments: :cat_love: renders as 22px emoji,
 * message with only emoji renders at 40px.
 */
export function renderTextWithCatEmoji(
  text: string,
  keyPrefix: string,
  opts?: { animate?: "once" | "loop" | "hover" | false },
) {
  const onlyEmoji = isOnlyCatEmoji(text);
  const size = onlyEmoji ? 40 : 22;
  return splitCatSegments(text).map((seg, i) => {
    if (!seg.cat) return <span key={`${keyPrefix}-${i}`}>{seg.text}</span>;
    const name = catNameForShortcode(`:${seg.cat}:`);
    if (!name) return <span key={`${keyPrefix}-${i}`}>{seg.text}</span>;
    return (
      <span
        key={`${keyPrefix}-${i}`}
        className="inline-grid place-items-center align-[-0.35em] mx-[1px]"
        style={{ width: size, height: size }}
      >
        <CatEmoji name={name} size={size} animate={opts?.animate ?? false} />
      </span>
    );
  });
}

/** Resolve a status emoji value: cat shortcode renders as CatEmoji, else Unicode text. */
export function StatusEmoji({ emoji, size = 20 }: { emoji: string | null; size?: number }) {
  if (!emoji) return null;
  const name = catNameForShortcode(emoji);
  if (name) return <CatEmoji name={name} size={size} animate="loop" />;
  return (
    <span aria-hidden style={{ fontSize: size, lineHeight: 1 }}>
      {emoji}
    </span>
  );
}
