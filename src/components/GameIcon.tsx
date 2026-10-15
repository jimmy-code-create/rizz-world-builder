import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";

/**
 * Game art: the app's own cat emojis first (registry icons are shortcodes
 * like ":cat_hype:"). A raw emoji glyph still renders as-is so old entries
 * never break — but new entries should use cat shortcodes.
 */
export function GameIcon({
  icon,
  size = 28,
  className = "",
}: {
  icon: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const name = icon ? catNameForShortcode(icon.trim()) : null;
  if (name) return <CatEmoji name={name} size={size} animate={false} className={className} />;
  return (
    <span aria-hidden className={`leading-none ${className}`} style={{ fontSize: size }}>
      {icon ?? "🎮"}
    </span>
  );
}
