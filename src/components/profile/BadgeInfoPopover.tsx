import type { ReactNode } from "react";
import { Badge as BadgeMark } from "@/components/Badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { canonicalFor } from "@/lib/badge-set";
import type { Badge } from "@/lib/badges";
import { cn } from "@/lib/utils";

/**
 * A badge next to a name, and the answer to "what is that?".
 *
 * Tapping opens a popover — the mark, name, tier and the rule behind it in the
 * name rows, or just the name in `compact` mode for the profile sheet's chip
 * row — instead of navigating away or opening a full sheet.
 */
export function BadgeInfoPopover({
  badge,
  size = 20,
  worn = false,
  compact = false,
  className,
}: {
  badge: Badge;
  size?: number;
  /** Draws the thin ring that marks the badge worn in the profile header. */
  worn?: boolean;
  /**
   * One-line tooltip with just the badge's name instead of the full card.
   * Used by the profile sheet's chip row, where a tap should answer "what is
   * this?" without opening a panel over the profile.
   */
  compact?: boolean;
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
          aria-label={compact ? `${name} badge` : `${name} badge — details`}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            worn && "ring-1 ring-primary/70",
            className,
          )}
        >
          <BadgeMark slug={badge.slug} size={size} />
        </button>
      </PopoverTrigger>
      {compact ? (
        <PopoverContent
          side="top"
          align="center"
          sideOffset={6}
          className="w-auto max-w-[12rem] rounded-lg border-white/10 bg-[#16171b] p-[4px_10px] shadow-xl"
        >
          <p className="truncate text-center text-[11px] font-semibold leading-snug text-[var(--brand-paper,#f4f1e7)]">
            {name}
          </p>
        </PopoverContent>
      ) : (
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
      )}
    </Popover>
  );
}

/**
 * The profile sheet's badge row: one chip per mark.
 *
 * The sheet sits over a banner/effect photo, so the marks can't share one dim
 * tray: each gets its own 32px circle with the same brighter hairline and soft
 * white wash, the same 24px icon box, and no per-badge glow — a green shield
 * and a violet mark then read as one set. The row wraps instead of clipping
 * when there are more marks than fit. A tap opens the one-line name tooltip.
 */
export function ProfileBadgeChips({
  badges,
  className,
}: {
  badges: Badge[];
  className?: string;
}) {
  if (!badges.length) return null;
  return (
    <span
      role="group"
      aria-label="Badges"
      className={cn("flex max-w-full flex-wrap items-center gap-2", className)}
    >
      {badges.map((badge) => (
        <BadgeInfoPopover
          key={badge.slug}
          badge={badge}
          size={24}
          compact
          className="h-8 w-8 shrink-0 rounded-full border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgb(255_255_255/0.10)] transition-colors hover:border-white/35 hover:bg-white/[0.16]"
        />
      ))}
    </span>
  );
}

/** The name-row line: every mark in one non-wrapping row. */
export function BadgeLine({
  badges,
  wornSlug = null,
  label = "Badges",
  tray = true,
}: {
  badges: Badge[];
  wornSlug?: string | null;
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
        />
      ))}
    </span>
  );
}
