import type { CSSProperties } from "react";
import { Badge as BadgeMark } from "@/components/Badge";
import type { Badge } from "@/lib/badges";
import { cn } from "@/lib/utils";

/**
 * A badge that carries its own particles.
 *
 * Seven motes orbit and fade around the mark on a single CSS timeline; only
 * `transform` and `opacity` animate, so a name row with five badges still
 * composites on the GPU instead of repainting. `prefers-reduced-motion` freezes
 * the motes in place (see styles.css), and `animate={false}` drops them.
 */
export function AnimatedBadge({
  badge,
  size = 20,
  title,
  animate = true,
  className,
}: {
  badge: Badge;
  size?: number;
  title?: string;
  animate?: boolean;
  className?: string;
}) {
  const motes = [0, 1, 2, 3, 4, 5, 6];
  return (
    <span
      className={cn("badge-aura", animate && "badge-aura--live", className)}
      style={{ width: size, height: size }}
    >
      {animate &&
        motes.map((mote) => (
          <span
            key={mote}
            aria-hidden="true"
            className="badge-mote"
            style={
              {
                left: `${16 + ((mote * 31) % 62)}%`,
                top: `${18 + ((mote * 43) % 58)}%`,
                animationDelay: `${(mote % 5) * 0.26}s`,
                animationDuration: `${2.1 + (mote % 3) * 0.45}s`,
              } as CSSProperties
            }
          />
        ))}
      <BadgeMark
        slug={badge.slug}
        size={size}
        title={title ?? badge.name}
        className="relative z-[1]"
      />
    </span>
  );
}
