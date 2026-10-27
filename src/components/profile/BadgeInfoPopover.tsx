import { useState, type ReactNode } from "react";
import { Badge as BadgeMark } from "@/components/Badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { canonicalFor } from "@/lib/badge-set";
import type { Badge } from "@/lib/badges";
import { cn } from "@/lib/utils";

/**
 * A badge next to a name, and the one-line answer to "what is that?".
 *
 * Tapping opens the mark, its name, tier and the rule behind it — instead of
 * navigating away. The triggers stay on one nowrap row so a name can never push
 * the marks onto a second line.
 *
 * `layout` picks how that answer arrives:
 *  - `popover` (default) for name rows on ordinary pages, where a small card
 *    next to the mark is the least disruptive thing,
 *  - `sheet` for the profile preview, where a badge sits directly above the
 *    Message/Follow buttons: a popover there covered the very buttons someone
 *    opened the card to press, so the answer arrives as the app's shared
 *    bottom sheet / dialog instead and never overlaps them.
 */
export function BadgeInfoPopover({
  badge,
  size = 20,
  worn = false,
  className,
  layout = "popover",
}: {
  badge: Badge;
  size?: number;
  /** Draws the thin ring that marks the badge worn in the profile header. */
  worn?: boolean;
  className?: string;
  layout?: "popover" | "sheet";
}) {
  const canonical = canonicalFor(badge.slug);
  const name = canonical?.name ?? badge.name;
  const tier = canonical?.tier ?? badge.rarity;
  const [open, setOpen] = useState(false);

  const trigger = (
    <button
      type="button"
      aria-label={`${name} badge — details`}
      onClick={layout === "sheet" ? () => setOpen(true) : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        worn && "ring-1 ring-primary/70",
        className,
      )}
    >
      <BadgeMark slug={badge.slug} size={size} />
    </button>
  );

  const details = (
    <div className="flex items-start gap-3">
      <BadgeMark slug={badge.slug} size={44} />
      <div className="min-w-0">
        <p className="truncate font-display text-base font-bold leading-tight text-foreground">{name}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {tier}
        </p>
        <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{badge.description}</p>
      </div>
    </div>
  );

  if (layout === "sheet") {
    return (
      <>
        {trigger}
        <ResponsiveOverlay
          open={open}
          onOpenChange={setOpen}
          title={name}
          description={`${tier} badge`}
        >
          {details}
        </ResponsiveOverlay>
      </>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={10}
        className="w-56 rounded-xl border-white/10 bg-[#16171b] p-3 text-foreground shadow-xl"
      >
        {details}
      </PopoverContent>
    </Popover>
  );
}

/** The name-row line: every mark in one non-wrapping row. */
export function BadgeLine({
  badges,
  wornSlug = null,
  label = "Badges",
  tray = true,
  layout = "popover",
}: {
  badges: Badge[];
  wornSlug?: string | null;
  label?: ReactNode;
  /**
   * Draws the row as one soft tray instead of loose marks. The preview sheet
   * uses it so five bigger badges read as a single object beside the handle.
   */
  tray?: boolean;
  /** See BadgeInfoPopover: the preview asks for the sheet so nothing covers the actions. */
  layout?: "popover" | "sheet";
}) {
  if (!badges.length) return null;
  return (
    <span
      className={cn(
        "inline-flex w-max max-w-full shrink-0 flex-nowrap items-center whitespace-nowrap",
        tray
          ? "gap-1 rounded-full border border-white/[0.07] bg-white/[0.055] px-1.5 py-0.5"
          : "gap-1",
      )}
      role="group"
      aria-label={String(label)}
    >
      {badges.map((badge) => (
        <BadgeInfoPopover
          key={badge.slug}
          badge={badge}
          size={20}
          worn={badge.slug === wornSlug}
          layout={layout}
        />
      ))}
    </span>
  );
}
