import { Badge as BadgeMark } from "@/components/Badge";
import type { Badge } from "@/lib/badges";

/**
 * A profile mark rendered from the shared SVG sprite; this wrapper keeps
 * profile call sites readable and exposes the badge name as an accessible tooltip.
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
