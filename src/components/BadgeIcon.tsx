import { Award } from "lucide-react";
import { CatEmoji } from "@/components/emoji/CatEmoji";
import { catNameForShortcode } from "@/components/emoji/cat-emoji-manifest";

/**
 * One badge icon everywhere: the app's own cat emoji with its tier glow.
 * Anything that isn't a cat shortcode falls back to a medal — an icon key
 * must never leak out as text.
 */
export function BadgeIcon({
  icon,
  glow,
  size = 20,
  animate = false,
  className = "",
}: {
  icon: string | null | undefined;
  glow: string;
  size?: number;
  animate?: boolean | "hover" | "once" | "loop" | "static";
  className?: string;
}) {
  const name = icon ? catNameForShortcode(icon) : null;
  if (!name) {
    return <Award aria-hidden className={className} style={{ width: size, height: size, color: glow }} />;
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 ${className}`}
      style={{ filter: `drop-shadow(0 0 ${Math.max(4, Math.round(size / 2))}px ${glow})` }}
    >
      <CatEmoji name={name} size={size} animate={animate} />
    </span>
  );
}
