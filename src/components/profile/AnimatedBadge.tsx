import { Badge as BadgeMark } from "@/components/Badge";
import type { Badge } from "@/lib/badges";

/**
 * A profile mark. The five real badges draw their own inline SVG (hexagon,
 * accent, custom loop — see BadgeGlyph); this wrapper exists so profile rows
 * share one call site and keeps the badge name on the accessible tooltip.
 */
export function AnimatedBadge({
  badge,
  size = 24,
  title,
  animate = true,
  className,
}: {
  badge: Badge;
  size?: number;
  title?: string;
  /** Kept for callers; 16px glyphs are already static until hover. */
  animate?: boolean;
  className?: string;
}) {
  void animate;
  return (
    <BadgeMark slug={badge.slug} size={size} title={title ?? badge.name} className={className} />
  );
}
