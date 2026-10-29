import { useId, type CSSProperties, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Profile badges, redrawn as one family.
 *
 * Every badge is a single inline `<svg>` — no sprite fetch, no emoji, no image
 * files — and every badge obeys the same construction rules:
 *
 *  - a silhouette drawn on the 24 grid with round joins and a 1u hairline rim
 *    of white at 55%, so the edge reads the same on shield, gem, star, paw and
 *    crown;
 *  - one two-tone gradient in *user space* (lit at y=3, deep at y=21), so a
 *    multi-part silhouette like the paw shares a single light source instead of
 *    every toe lighting itself;
 *  - a top-edge highlight clipped to the silhouette — the "inner highlight"
 *    that stops a dark-bottom gradient from looking like flat paint;
 *  - one small outer glow, sized off the rendered px, never a drop shadow.
 *
 * Sizes are honest: 16, 20 and 28 are the three the UI uses, and the inner icon
 * is deliberately one idea each (a check, a sparkle, a pad) so nothing mushes
 * at the small end.
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

type BadgeDef = {
  /** Short label shown in the tooltip and used as the accessible name. */
  label: string;
  /** Second tooltip line — what the badge is *for*. */
  hint: string;
  /** Two-tone gradient: the lit top, the deep bottom. */
  from: string;
  to: string;
  /** Outer glow, also the accent to use beside the mark. */
  glow: string;
  /** Silhouette on the 24 grid (one or more shapes; painted in user space). */
  shape: ReactNode;
  /** Inner icon — filled white unless stated. */
  glyph?: ReactNode;
};

const BADGES: Record<BadgeType, BadgeDef> = {
  verified: {
    label: "Verified",
    hint: "A real, checked account",
    from: "#8ec8ff",
    to: "#2563eb",
    glow: "rgba(59,130,246,0.55)",
    shape: (
      <path d="M12 2.6 L19.5 5.3 V11.6 C19.5 16.1 16.4 19.6 12 21.3 C7.6 19.6 4.5 16.1 4.5 11.6 V5.3 Z" />
    ),
    glyph: (
      <path d="M8.5 12.2 L11 14.7 L15.6 9.7" fill="none" strokeWidth={2.1} />
    ),
  },
  premium: {
    label: "Premium",
    hint: "RIZZ Plus, active",
    from: "#e3c4ff",
    to: "#7c3aed",
    glow: "rgba(139,92,246,0.55)",
    shape: <path d="M8 4.6 H16 L20.4 9.5 L12 20.6 L3.6 9.5 Z" />,
    glyph: (
      <path
        d="M12 7.2 Q12.6 10.8 16.2 11.4 Q12.6 12 12 15.6 Q11.4 12 7.8 11.4 Q11.4 10.8 12 7.2 Z"
        strokeWidth={0}
      />
    ),
  },
  early_member: {
    label: "Early member",
    hint: "Joined before it was big",
    from: "#ffe6a1",
    to: "#d97706",
    glow: "rgba(245,158,11,0.5)",
    shape: (
      <path d="M12 2.3 L15.29 7.47 L21.23 9 L17.33 13.73 L17.7 19.85 L12 17.6 L6.3 19.85 L6.67 13.73 L2.77 9 L8.71 7.47 Z" />
    ),
    // The star is the icon; a second mark inside it would only mush at 16px.
  },
  top_paws: {
    label: "Top paws",
    hint: "Top of this week's earners",
    from: "#b7f5d9",
    to: "#0f9d6f",
    glow: "rgba(16,185,129,0.5)",
    shape: (
      <>
        <circle cx="7.5" cy="8.4" r="2.7" />
        <circle cx="12" cy="6.5" r="2.8" />
        <circle cx="16.5" cy="8.4" r="2.7" />
        <path d="M12 11.7 c3.3 0 5.8 2.2 5.8 4.6 0 2.2-1.8 3.5-4.3 3.5 h-3 c-2.5 0-4.3-1.3-4.3-3.5 0-2.4 2.5-4.6 5.8-4.6 Z" />
      </>
    ),
    glyph: (
      <path
        d="M12 13.7 c2.2 0 3.6 1.4 3.6 2.7 0 1.2-1.1 1.9-2.7 1.9 h-1.8 c-1.6 0-2.7-.7-2.7-1.9 0-1.3 1.4-2.7 3.6-2.7 Z"
        strokeWidth={0}
      />
    ),
  },
  creator: {
    label: "Creator",
    hint: "Posts and gets watched",
    from: "#ffb8c8",
    to: "#e11d48",
    glow: "rgba(244,63,94,0.5)",
    shape: <path d="M4.4 8.3 L7.8 11.6 L12 5.8 L16.2 11.6 L19.6 8.3 L18.3 17.7 H5.7 Z" />,
    glyph: (
      <g strokeWidth={0}>
        <circle cx="12" cy="14.6" r="1.7" />
        <circle cx="8.2" cy="15.6" r="1.1" />
        <circle cx="15.8" cy="15.6" r="1.1" />
      </g>
    ),
  },
};

export type BadgeProps = {
  /** Which badge to draw. */
  type: BadgeType;
  /** Rendered square size in px — 16, 20 and 28 are the sizes the UI uses. */
  size?: number;
  /** Overrides the tooltip label and the accessible name. */
  label?: string;
  /** Extra tooltip line under the label. */
  hint?: string;
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
  className,
  style,
  noTooltip = false,
}: BadgeProps) {
  // Gradient ids are per instance: several badges of the same type sit in the
  // same pill, and duplicate ids in one document are a coin toss about which
  // one wins.
  const uid = useId().replace(/:/g, "");
  const def = BADGES[type];
  const name = label ?? def.label;
  const sub = hint ?? def.hint;
  const px = Math.max(16, Math.round(size));
  const bodyId = `bzg-${type}-${uid}`;
  const fill = `url(#f-${bodyId})`;
  const shine = `url(#h-${bodyId})`;
  const clip = `url(#c-${bodyId})`;

  const art = (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      focusable="false"
      aria-hidden={noTooltip ? undefined : true}
      style={{ filter: `drop-shadow(0 0 ${(px * 0.11).toFixed(2)}px ${def.glow})`, ...style }}
    >
      <defs>
        {/* One light source for every badge, in user space so a multi-part
            silhouette (the paw) lights as a single object. */}
        <linearGradient id={`f-${bodyId}`} gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="21">
          <stop offset="0%" stopColor={def.from} />
          <stop offset="100%" stopColor={def.to} />
        </linearGradient>
        <linearGradient id={`h-${bodyId}`} gradientUnits="userSpaceOnUse" x1="0" y1="2.5" x2="0" y2="13">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c-${bodyId}`}>{def.shape}</clipPath>
      </defs>

      {/* Body: two-tone fill, hairline rim, then the top-edge highlight. */}
      <g
        fill={fill}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {def.shape}
      </g>
      <g clipPath={clip} fill={shine} stroke="none">
        <rect x="0" y="0" width="24" height="24" />
      </g>

      {/* Inner icon: white, one idea, sized to survive 16px. Filled glyphs
          (sparkle, paw pad, crown stones) inherit the fill; stroked ones like
          the check declare their own. */}
      <g fill="#ffffff" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {def.glyph}
      </g>
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
 * Which catalog slug draws which mark.
 *
 * The name row carries four slugs — `verified`, `streamer`, `bounty-hunter`,
 * `purify` — so the map is chosen to give that row four *different* new marks
 * instead of mixing old art with new in one pill:
 *
 *   verified / no-cap         → shield (the blue check it has always been)
 *   purify                    → gem    (the purple gem it has always been)
 *   streamer / verified_creator → crown (a creator is a creator)
 *   og / founder              → star   (early members)
 *   bounty-hunter / top-rizzler / top_paws → paw (the top earner)
 *   premium / plus            → gem
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
