import { useId, type CSSProperties, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatPlaytime, useArcadePlayMs } from "@/lib/games/arcade-record";

/**
 * Profile badges, drawn as one family of flat stickers.
 *
 * The previous set was five different silhouettes (shield, gem, wreath, crown,
 * wave) each with its own gradient, gloss and glow. At 16px that read as five
 * unrelated coins. This set is deliberately the opposite:
 *
 *  - **One shared shape.** Every mark is the same die-cut rounded square, in
 *    the same place on the 24 grid. A row of badges reads as a sheet of
 *    stickers, not a drawer of medals.
 *  - **Flat colour.** One solid body, one solid lower shade, one ink outline,
 *    one cream paper edge, one hard offset shadow. No gradients, no gloss, no
 *    blur, no glow — a sticker printed in two inks.
 *  - **A collected corner.** The cream quarter-disc in the bottom-right is the
 *    lifted edge of the sticker. It is part of the shared shape, so it lines up
 *    across a row.
 *  - **One bold glyph.** Filled or 2.4u strokes, never thinner, so it survives
 *    the 16px name row.
 *
 * The arcade ranks use the same sticker: the only addition is a small playtime
 * meter above the lifted corner, which is how "how much have they played"
 * reads at a glance without a number.
 */
export type BadgeType = "verified" | "premium" | "early_member" | "top_paws" | "creator";

/** Adding a badge means adding one entry here — the renderer is generic. */
export const BADGE_TYPES: readonly BadgeType[] = [
  "verified",
  "premium",
  "early_member",
  "top_paws",
  "creator",
] as const;

/** Arcade ranks, earned from time played rather than from a purchase. */
export type GameBadgeType = "game_rookie" | "game_fiend" | "game_legend";

export const GAME_BADGE_TYPES: readonly GameBadgeType[] = [
  "game_rookie",
  "game_fiend",
  "game_legend",
] as const;

type BadgeDef = {
  /** Short label shown in the tooltip and used as the accessible name. */
  label: string;
  /** Second tooltip line — what the badge is *for*. */
  hint: string;
  /** Flat body colour. */
  color: string;
  /** Flat lower-third shade, a darker mix of the body. */
  shade: string;
  /** Glyph and meter colour: ink on light stickers, paper on dark ones. */
  ink: string;
  /** Silhouette-internal glyph, drawn around (12, 11). */
  glyph: ReactNode;
  /** Arcade ranks carry a playtime meter above the lifted corner. */
  meter?: boolean;
};

/** The one shape: a 17.6×18.4 die-cut rounded square. */
const PAPER = { x: 3.2, y: 2.8, width: 17.6, height: 18.4, rx: 6.4 };
const BODY = { x: 4.9, y: 4.5, width: 14.2, height: 15, rx: 4.9 };
const METER = { x: 6.4, y: 16.6, width: 11.2, height: 1.7 };
/** The lifted corner: the bottom-right quarter of the body. */
const LIFT = "M19.1 19.5 H14.2 A4.9 4.9 0 0 1 19.1 14.6 Z";

const BADGES: Record<BadgeType | GameBadgeType, BadgeDef> = {
  verified: {
    label: "Verified",
    hint: "A real, checked account",
    color: "#3B82F6",
    shade: "#1D4ED8",
    ink: "#F4F1E7",
    glyph: (
      <path d="M8.4 11.4 10.8 13.8 15.6 8.9" fill="none" strokeWidth={2.4} />
    ),
  },
  premium: {
    label: "Premium",
    hint: "RIZZ Plus, active",
    color: "#8B5CF6",
    shade: "#6D28D9",
    ink: "#F4F1E7",
    glyph: (
      <path d="M12 6.4c.6 2.9 2.3 4.6 5.2 5.2-2.9.6-4.6 2.3-5.2 5.2-.6-2.9-2.3-4.6-5.2-5.2 2.9-.6 4.6-2.3 5.2-5.2Z" />
    ),
  },
  early_member: {
    label: "Early Member",
    hint: "Joined in RIZZ's first 30 days",
    color: "#C9FF3D",
    shade: "#9CC72C",
    ink: "#14180A",
    glyph: (
      <g>
        <path d="M12 17.2V10.2" fill="none" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M12 12.8C9.3 12.9 7.6 11.4 7.4 8.7c2.7.1 4.4 1.5 4.6 4.1Z" />
        <path d="M12 11.5c2.5.1 4.1-1.3 4.3-3.8-2.5.1-4.1 1.4-4.3 3.8Z" />
      </g>
    ),
  },
  top_paws: {
    label: "Top Paws",
    hint: "The biggest Paws earner",
    color: "#FFC93C",
    shade: "#E0A015",
    ink: "#241703",
    glyph: (
      <g>
        <path d="M12 16.9c2.5 0 4.2-1.3 4.2-3 0-1.5-1.4-2.3-2.9-2.7l-1.3-.4-1.3.4C9.2 11.6 7.8 12.4 7.8 13.9c0 1.7 1.7 3 4.2 3Z" />
        <circle cx="8.5" cy="9.4" r="1.5" />
        <circle cx="12" cy="8.2" r="1.6" />
        <circle cx="15.5" cy="9.4" r="1.5" />
      </g>
    ),
  },
  creator: {
    label: "Creator",
    hint: "Publishes to the realms",
    color: "#FF5D6C",
    shade: "#D93A4A",
    ink: "#F4F1E7",
    glyph: <path d="M9.5 7.6 16.4 11.9 9.5 16.2Z" strokeWidth={1.4} />,
  },
  game_rookie: {
    label: "Arcade Rookie",
    hint: "Played 1+ hour on the arcade",
    color: "#2DD4BF",
    shade: "#0F9E8C",
    ink: "#04241F",
    meter: true,
    glyph: (
      <g>
        <rect x="6.2" y="6.3" width="11.6" height="7" rx="3.5" fill="none" strokeWidth={1.9} />
        <path d="M9.1 8.9v2.6M7.8 10.2h2.6" fill="none" strokeWidth={1.7} strokeLinecap="round" />
        <circle cx="14.4" cy="9.4" r=".95" strokeWidth={0} />
        <circle cx="15.9" cy="10.8" r=".95" strokeWidth={0} />
      </g>
    ),
  },
  game_fiend: {
    label: "Arcade Fiend",
    hint: "Played 10+ hours on the arcade",
    color: "#6366F1",
    shade: "#4338CA",
    ink: "#F4F1E7",
    meter: true,
    glyph: (
      <g>
        <rect x="6.2" y="6.3" width="11.6" height="7" rx="3.5" fill="none" strokeWidth={1.9} />
        <path d="M9.1 8.9v2.6M7.8 10.2h2.6" fill="none" strokeWidth={1.7} strokeLinecap="round" />
        <circle cx="14.4" cy="9.4" r=".95" strokeWidth={0} />
        <circle cx="15.9" cy="10.8" r=".95" strokeWidth={0} />
      </g>
    ),
  },
  game_legend: {
    label: "Arcade Legend",
    hint: "Played 50+ hours on the arcade",
    color: "#FFC24B",
    shade: "#E09612",
    ink: "#2A1A02",
    meter: true,
    glyph: (
      <g>
        <rect x="6.2" y="6.3" width="11.6" height="7" rx="3.5" fill="none" strokeWidth={1.9} />
        <path d="M9.1 8.9v2.6M7.8 10.2h2.6" fill="none" strokeWidth={1.7} strokeLinecap="round" />
        <circle cx="14.4" cy="9.4" r=".95" strokeWidth={0} />
        <circle cx="15.9" cy="10.8" r=".95" strokeWidth={0} />
      </g>
    ),
  },
};

export type BadgeProps = {
  /** Which badge to draw. */
  type: BadgeType | GameBadgeType;
  /** Rendered square size in px — 16, 20 and 28 are the sizes the UI uses. */
  size?: number;
  /** Overrides the tooltip label and the accessible name. */
  label?: string;
  /** Extra tooltip line under the label. */
  hint?: string;
  /** Arcade meter fill, 0–1. Ignored by marks without a meter. */
  progress?: number;
  className?: string;
  style?: CSSProperties;
  /** Suppress the tooltip on surfaces that already explain the badge. */
  noTooltip?: boolean;
};

/**
 * One inline badge.
 *
 * The tooltip is paired with a native `title`, so a long-press or a hover that
 * skips the portal still says what the mark means.
 */
export function Badge({
  type,
  size = 20,
  label,
  hint,
  progress = 1,
  className,
  style,
  noTooltip = false,
}: BadgeProps) {
  // The lifted corner needs a clip path in some browsers; ids are per instance
  // because several badges of the same type share one pill.
  const uid = useId().replace(/:/g, "");
  const def = BADGES[type];
  const name = label ?? def.label;
  const sub = hint ?? def.hint;
  const px = Math.max(16, Math.round(size));
  const clip = `url(#c-${uid})`;
  const filled = Math.max(0, Math.min(1, progress));

  const art = (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      focusable="false"
      aria-hidden={noTooltip ? undefined : true}
      style={style}
    >
      <defs>
        <clipPath id={`c-${uid}`}>
          <rect {...BODY} />
        </clipPath>
      </defs>

      {/* A hard offset shadow, not a blur: the sticker sits on the page. */}
      <rect {...PAPER} y={PAPER.y + 1} fill="#07070A" opacity="0.55" />
      {/* The cream die-cut edge every sticker has. */}
      <rect {...PAPER} fill="#F4F1E7" />
      {/* Flat body, flat lower shade. */}
      <rect {...BODY} fill={def.color} />
      <g clipPath={clip}>
        <rect x={BODY.x} y={13.6} width={BODY.width} height={BODY.height} fill={def.shade} />
      </g>
      {/* The lifted corner, in paper. */}
      <path d={LIFT} fill="#E2DCCB" stroke="#0B0B0B" strokeWidth={1.4} strokeLinejoin="round" />
      {/* One ink outline around the body. */}
      <rect {...BODY} fill="none" stroke="#0B0B0B" strokeWidth={1.9} />

      {/* Plain glyph: one idea, no detail that dies at 16px. */}
      <g
        fill={def.ink}
        stroke={def.ink}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {def.glyph}
      </g>

      {/* Arcade playtime meter: three dots' worth of width, filled by rank. */}
      {def.meter ? (
        <>
          <rect
            x={METER.x}
            y={METER.y}
            width={METER.width}
            height={METER.height}
            rx={METER.height / 2}
            fill="#0B0B0B"
            opacity="0.22"
          />
          <rect
            x={METER.x}
            y={METER.y}
            width={Math.max(METER.height, METER.width * filled)}
            height={METER.height}
            rx={METER.height / 2}
            fill={def.ink}
          />
        </>
      ) : null}
    </svg>
  );

  const labelNode = (
    <span className="flex flex-col leading-tight">
      <span className="font-display text-sm font-bold">{name}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </span>
  );

  if (noTooltip) {
    // The surface owns the tooltip (BadgeChip already draws one), so the mark
    // only needs to be nameable on its own — for screen readers and for the
    // long-press label on a phone.
    return (
      <span
        role="img"
        aria-label={`${name} badge`}
        title={`${name} — ${sub}`}
        className={cn("inline-flex shrink-0 items-center", className)}
      >
        {art}
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            title={`${name} — ${sub}`}
            aria-label={`${name} badge`}
            role="img"
            className={cn(
              "inline-flex shrink-0 items-center transition-transform duration-150 hover:scale-110",
              className,
            )}
          >
            {art}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="glass-strong border-white/10">
          {labelNode}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Alias, so call sites can pick the name that reads best in context. */
export { Badge as ProfileBadge };

/**
 * The arcade rank, read from the device's play record.
 *
 * Games are device-local, so this badge is too — the same rule the existing
 * Game Champ badge follows. It renders nothing until the first hour so a new
 * account never sees an empty rank.
 */
export function GameRankBadge({
  size = 20,
  className,
  noTooltip = false,
}: {
  size?: number;
  className?: string;
  noTooltip?: boolean;
}) {
  const ms = useArcadePlayMs();
  const hours = ms / 3_600_000;
  const type: GameBadgeType | null =
    hours >= 50 ? "game_legend" : hours >= 10 ? "game_fiend" : hours >= 1 ? "game_rookie" : null;
  if (!type) return null;
  const nextRank = type === "game_rookie" ? "10h" : type === "game_fiend" ? "50h" : null;
  const progress =
    type === "game_legend" ? 1 : type === "game_fiend" ? (hours - 10) / 40 : (hours - 1) / 9;
  return (
    <Badge
      type={type}
      size={size}
      className={className}
      noTooltip={noTooltip}
      progress={progress}
      hint={`${formatPlaytime(ms)} played${nextRank ? ` · next rank at ${nextRank}` : " · top rank"}`}
    />
  );
}

/**
 * Which catalog slug draws which mark.
 *
 * The name row carries four slugs — `verified`, `streamer`, `bounty-hunter`,
 * `purify` — so the map is chosen to give that row four *different* stickers
 * instead of mixing old art with new in one pill:
 *
 *   verified / no-cap         → check
 *   purify                    → sparkle
 *   streamer / verified_creator → play
 *   og / founder              → sprout
 *   bounty-hunter / top-rizzler / top_paws → paw
 *   premium / plus            → sparkle
 *
 * Anything not listed keeps the sprite badge, so a retired or unknown award
 * still renders instead of silently disappearing from a profile.
 */
const SLUG_TO_TYPE: Record<string, BadgeType> = {
  verified: "verified",
  "no-cap": "verified",
  purify: "premium",
  premium: "premium",
  plus: "premium",
  og: "early_member",
  founder: "early_member",
  "early-member": "early_member",
  streamer: "creator",
  creator: "creator",
  "verified-creator": "creator",
  "bounty-hunter": "top_paws",
  "top-rizzler": "top_paws",
  "top-paws": "top_paws",
};

/** `top_paws` and `verified_creator` are stored both ways; normalise first. */
export function badgeTypeForSlug(slug: string | null | undefined): BadgeType | null {
  if (!slug) return null;
  const key = slug.trim().toLowerCase().replace(/_/g, "-");
  return SLUG_TO_TYPE[key] ?? SLUG_TO_TYPE[slug.trim()] ?? null;
}

/**
 * The pill that holds badges beside a name: a rounded capsule with 6px between
 * marks (4px on the smallest size), matching how the profile card will show
 * them.
 */
export function BadgePill({
  types,
  size = 20,
  gap = 6,
  className,
}: {
  types: BadgeType[];
  size?: number;
  /** Gap between marks in px — 4 to 6 is the range the design calls for. */
  gap?: number;
  className?: string;
}) {
  return (
    <span
      role="group"
      aria-label="Badges"
      className={cn(
        "inline-flex max-w-full shrink-0 items-center whitespace-nowrap rounded-full",
        "border border-white/[0.07] bg-white/[0.055] px-2 py-1",
        className,
      )}
      style={{ gap: `${gap}px` }}
    >
      {types.map((type) => (
        <Badge key={type} type={type} size={size} />
      ))}
    </span>
  );
}
