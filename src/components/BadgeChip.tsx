import type { Badge } from "@/lib/badges";
import { canonBadges, canonicalFor } from "@/lib/badge-set";
import { Badge as BadgeMark } from "@/components/Badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Badge chips carry no container of their own: the vector mark sits directly
 * on the surface, exactly like a Discord profile badge. The only chrome is a
 * tooltip with the badge name.
 */
export function BadgeChip({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? 28 : 20;
  const name = canonicalFor(badge.slug)?.name ?? badge.name;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 items-center justify-center">
            <BadgeMark slug={badge.slug} size={px} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="glass-strong border-white/10">
          <div className="flex flex-col items-start gap-0.5 max-w-[200px]">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-sm">{name}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-60">
                {badge.rarity}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{badge.description}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Profile + hover-card rows show set badges only, in canonical order. */
export function BadgeRow({
  badges,
  max = 3,
  size = "md",
}: {
  badges: Badge[];
  max?: number;
  size?: "sm" | "md" | "lg";
}) {
  const orderedBadges = canonBadges(badges);
  const shown = orderedBadges.slice(0, max);
  const extra = orderedBadges.length - shown.length;
  if (!shown.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      {shown.map((b) => (
        <BadgeChip key={b.id} badge={b} size={size} />
      ))}
      {extra > 0 && (
        <span
          title={`${extra} more badge${extra === 1 ? "" : "s"}`}
          aria-label={`${extra} more badges`}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-1 text-[10px] font-semibold tabular-nums text-muted-foreground"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
