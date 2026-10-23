import type { ReactNode } from "react";
import { Badge as BadgeMark } from "@/components/Badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { canonicalFor } from "@/lib/badge-set";
import type { Badge } from "@/lib/badges";
import { cn } from "@/lib/utils";

/**
 * A badge next to a name, and the one-line answer to "what is that?".
 *
 * Tapping opens a small popover — mark, name, tier and the rule behind it —
 * instead of navigating away or opening a full sheet. The triggers stay on one
 * nowrap row so a name can never push the marks onto a second line.
 */
export function BadgeInfoPopover({
  badge,
  size = 20,
  worn = false,
  className,
}: {
  badge: Badge;
  size?: number;
  /** Draws the thin ring that marks the badge worn in the profile header. */
  worn?: boolean;
  className?: string;
}) {
  const canonical = canonicalFor(badge.slug);
  const name = canonical?.name ?? badge.name;
  const tier = canonical?.tier ?? badge.rarity;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${name} badge — details`}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            worn && "ring-1 ring-primary/70",
            className,
          )}
        >
          <BadgeMark slug={badge.slug} size={size} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-56 rounded-xl border-white/10 bg-[#16171b] p-3 text-foreground shadow-xl"
      >
        <div className="flex items-start gap-2.5">
          <BadgeMark slug={badge.slug} size={32} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold leading-tight text-foreground">{name}</p>
            <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {tier}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{badge.description}</p>
      </PopoverContent>
    </Popover>
  );
}

/** The name-row line: every mark in one non-wrapping row. */
export function BadgeLine({
  badges,
  wornSlug = null,
  size = 20,
  label = "Badges",
  tray = false,
}: {
  badges: Badge[];
  wornSlug?: string | null;
  size?: number;
  label?: ReactNode;
  /**
   * Draws the row as one soft tray instead of loose marks. The preview sheet
   * uses it so five bigger badges read as a single object beside the handle.
   */
  tray?: boolean;
}) {
  if (!badges.length) return null;
  return (
    <span
      className={cn(
        "flex flex-nowrap items-center",
        tray
          ? "gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.055] px-2 py-1"
          : "gap-1",
      )}
      aria-label={String(label)}
    >
      {badges.map((badge) => (
        <BadgeInfoPopover
          key={badge.slug}
          badge={badge}
          size={size}
          worn={badge.slug === wornSlug}
        />
      ))}
    </span>
  );
}
