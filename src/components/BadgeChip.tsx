import type { Badge } from "@/lib/badges";
import { canonBadges, canonicalFor } from "@/lib/badge-set";
import { Badge as BadgeMark } from "@/components/Badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Badge chips carry no container of their own: the vector mark sits directly
 * on the surface, exactly like a Discord profile badge. The only chrome is a
 * tooltip with the badge name — and, when `onSelect` is passed, the mark itself
 * becomes a tappable button that opens the badge popout.
 */
export function BadgeChip({
  badge,
  size = "md",
  onSelect,
}: {
  badge: Badge;
  size?: "sm" | "md" | "lg";
  /** Makes the badge tappable (profile pages + preview). */
  onSelect?: (badge: Badge) => void;
}) {
  const px = size === "lg" ? 28 : 20;
  const name = canonicalFor(badge.slug)?.name ?? badge.name;
  const mark = <BadgeMark slug={badge.slug} size={px} title={onSelect ? undefined : name} />;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {onSelect ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(badge);
              }}
              aria-label={`${name} badge — open details`}
              className="group/badge inline-flex shrink-0 items-center justify-center rounded-md p-0.5 transition-[transform,filter] duration-150 hover:scale-110 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-100"
            >
              {mark}
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center justify-center">{mark}</span>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="glass-strong border-white/10">
          <div className="flex max-w-[200px] flex-col items-start gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-bold">{name}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-60">
                {badge.rarity}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{badge.description}</span>
            {onSelect && (
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary/80">
                Tap for details
              </span>
            )}
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
  onSelect,
}: {
  badges: Badge[];
  max?: number;
  size?: "sm" | "md" | "lg";
  onSelect?: (badge: Badge) => void;
}) {
  const orderedBadges = canonBadges(badges);
  const shown = orderedBadges.slice(0, max);
  const extra = orderedBadges.length - shown.length;
  if (!shown.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      {shown.map((b) => (
        <BadgeChip key={b.id} badge={b} size={size} onSelect={onSelect} />
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
