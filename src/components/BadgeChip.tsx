import type { Badge } from "@/lib/badges";
import { badgeArtForSlug, badgeMiniArtForSlug, canonBadges } from "@/lib/badge-set";
import { BadgeIcon } from "@/components/BadgeIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function BadgeChip({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const shape = size === "sm" ? "rounded-md" : "rounded-xl";
  const iconSize = size === "sm" ? 18 : size === "lg" ? 20 : 16;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`${box} ${shape} badge-art-tile group flex items-center justify-center border border-white/10 backdrop-blur-md transition-transform hover:scale-110`}
            style={{
              background: `linear-gradient(135deg, ${badge.color}22, ${badge.color}08)`,
              boxShadow: `0 0 14px ${badge.color}44`,
            }}
          >
            <BadgeIcon
              icon={badge.icon}
              image={size === "sm" ? badgeMiniArtForSlug(badge.slug) : badgeArtForSlug(badge.slug)}
              glow={badge.color}
              size={iconSize}
              animate={size === "lg"}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="glass-strong border-white/10">
          <div className="flex flex-col items-start gap-0.5 max-w-[200px]">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-sm">{badge.name}</span>
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
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      {shown.map((b) => (
        <BadgeChip key={b.id} badge={b} size={size} />
      ))}
      {extra > 0 && (
        <span
          title={`${extra} more badge${extra === 1 ? "" : "s"}`}
          aria-label={`${extra} more badges`}
          className="text-xs font-medium text-muted-foreground"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
