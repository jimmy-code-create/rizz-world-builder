import { cn } from "@/lib/utils";

/**
 * The five profile badges, drawn inline.
 *
 * Every mark is the same hexagon chassis (`32×32`, ink fill, accent stroke)
 * with one custom icon and one custom loop:
 *
 *   main-character  spotlight cone breathes, a shine strip sweeps the star
 *   bounty-hunter   an outer ring snaps inward (lock-on) every 3s
 *   purify          a ripple leaves the droplet, the sparkle twinkles
 *   verified        the check draws itself, then a shine crosses the hexagon
 *   streamer        the dot pulses while the signal arcs fade in, inner first
 *
 * 16px renders are static until hover; 24px+ idle, and 64px (showcase) adds a
 * one-time entrance. Only transform/opacity/stroke-dashoffset animate — no
 * filters, no blur, no layout work. `prefers-reduced-motion` freezes everything.
 */
export type GlyphSlug = "main-character" | "bounty-hunter" | "purify" | "verified" | "streamer";

const META: Record<GlyphSlug, { name: string; blurb: string; accent: string; dur: string }> = {
  "main-character": {
    name: "Main Character",
    blurb: "the story runs through you.",
    accent: "#ffc933",
    dur: "4s",
  },
  "bounty-hunter": {
    name: "Bounty",
    blurb: "first to the claim.",
    accent: "#ff2d3f",
    dur: "3s",
  },
  purify: {
    name: "Purify",
    blurb: "gradients, GIFs and bigger uploads.",
    accent: "#5df0ff",
    dur: "3.5s",
  },
  verified: {
    name: "Verified",
    blurb: "identity confirmed.",
    accent: "#b6ff3b",
    dur: "5s",
  },
  streamer: {
    name: "Streamer",
    blurb: "live in voice.",
    accent: "#ff3d81",
    dur: "2s",
  },
};

export const BADGE_GLYPH_SLUGS = Object.keys(META) as GlyphSlug[];

export function isBadgeGlyph(slug?: string | null): slug is GlyphSlug {
  return !!slug && slug in META;
}

export function badgeGlyphMeta(slug: GlyphSlug) {
  return META[slug];
}

const HEX = "16,2 28,9 28,23 16,30 4,23 4,9";

export function BadgeGlyph({
  slug,
  size = 24,
  locked = false,
  title,
  className,
}: {
  slug: GlyphSlug;
  size?: number;
  locked?: boolean;
  title?: string;
  className?: string;
}) {
  const meta = META[slug];
  const px = Math.max(14, Math.round(size));
  const tier = px <= 16 ? "sm" : px >= 64 ? "xl" : "md";
  const label = title ?? `${meta.name} — ${meta.blurb}`;

  return (
    <span
      className={cn("bz-glyph", locked && "bz-glyph--locked", className)}
      data-size={tier}
      data-badge={slug}
      style={{
        width: px,
        height: px,
        ["--bz-accent" as string]: meta.accent,
        ["--bz-dur" as string]: meta.dur,
      }}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 32 32" width={px} height={px} focusable="false" aria-hidden="true">
        <polygon
          points={HEX}
          fill="#0a0a0a"
          stroke={meta.accent}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {slug === "main-character" && (
          <>
            <polygon className="bz-anim bz-cone" points="16,4 25,27 7,27" fill={meta.accent} />
            <polygon
              className="bz-star"
              points="16,7 18.4,13.2 25,13.8 20,18.1 21.5,24.5 16,21 10.5,24.5 12,18.1 7,13.8 13.6,13.2"
              fill="#0a0a0a"
              stroke={meta.accent}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <polygon className="bz-anim bz-shine" points="9,6 13,6 21,26 17,26" fill="#fff" />
          </>
        )}

        {slug === "bounty-hunter" && (
          <>
            <circle
              className="bz-anim bz-lock"
              cx="16"
              cy="16"
              r="10"
              fill="none"
              stroke={meta.accent}
              strokeWidth="1.3"
            />
            <g className="bz-rotor" stroke={meta.accent} strokeWidth="1.6" strokeLinecap="round">
              <line x1="16" y1="6.5" x2="16" y2="10.5" />
              <line x1="16" y1="21.5" x2="16" y2="25.5" />
              <line x1="6.5" y1="16" x2="10.5" y2="16" />
              <line x1="21.5" y1="16" x2="25.5" y2="16" />
            </g>
            <circle cx="16" cy="16" r="6" fill="none" stroke={meta.accent} strokeWidth="1.4" />
            <circle className="bz-dot" cx="16" cy="16" r="1.5" fill={meta.accent} />
          </>
        )}

        {slug === "purify" && (
          <>
            <circle
              className="bz-anim bz-ripple"
              cx="16"
              cy="21"
              r="6"
              fill="none"
              stroke={meta.accent}
              strokeWidth="1.2"
            />
            <path
              d="M16 7 C16 7 9.5 14.5 9.5 19 a6.5 6.5 0 0 0 13 0 C22.5 14.5 16 7 16 7 Z"
              fill="#0a0a0a"
              stroke={meta.accent}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M13.6 18.4a2.6 2.6 0 0 0 2 2.5"
              fill="none"
              stroke={meta.accent}
              strokeWidth="1.1"
              strokeLinecap="round"
              opacity="0.7"
            />
            <path
              className="bz-anim bz-sparkle"
              d="M21 7.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"
              fill={meta.accent}
            />
            <g className="bz-drops" fill={meta.accent}>
              <circle cx="13" cy="12" r="0.8" />
              <circle cx="16" cy="10.4" r="0.7" />
              <circle cx="19" cy="12.6" r="0.8" />
            </g>
          </>
        )}

        {slug === "verified" && (
          <>
            <path
              className="bz-anim bz-check"
              d="M10 16.5 L14.5 21 L22.5 11.5"
              fill="none"
              stroke={meta.accent}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
            />
            <polygon className="bz-anim bz-shine" points="8,5 11.5,5 20,27 16.5,27" fill="#fff" />
          </>
        )}

        {slug === "streamer" && (
          <>
            <circle className="bz-anim bz-pulse" cx="16" cy="16" r="3" fill={meta.accent} />
            <g fill="none" stroke={meta.accent} strokeWidth="1.6" strokeLinecap="round">
              <path className="bz-anim bz-arc bz-arc-1" d="M10.5 10.5 a7.8 7.8 0 0 0 0 11" />
              <path className="bz-anim bz-arc bz-arc-2" d="M21.5 10.5 a7.8 7.8 0 0 1 0 11" />
              <path
                className="bz-anim bz-arc bz-arc-3"
                d="M7.4 7.2 a12 12 0 0 0 0 17.6"
                opacity="0.7"
              />
              <path
                className="bz-anim bz-arc bz-arc-4"
                d="M24.6 7.2 a12 12 0 0 1 0 17.6"
                opacity="0.7"
              />
            </g>
          </>
        )}
      </svg>
    </span>
  );
}
