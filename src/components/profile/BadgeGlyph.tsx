import { cn } from "@/lib/utils";
import { WaterDroplet } from "@/components/profile/WaterDroplet";

/**
 * The five profile badges, drawn inline on one 32-unit hexagon chassis.
 *
 *   main-character  a lit stage: floor, spotlight beam, gold star, sparkles
 *   bounty-hunter   crosshair with a lock-on ring
 *   purify          a live water droplet of 58 beads on a canvas, over a ripple
 *   verified        filled red seal, cream check, shine sweep
 *   streamer        a microphone with live sound waves
 *
 * Sizes: vector marks are static at 16px until hover and idle at 24px+; the
 * Purify canvas always runs its 60fps bead flow. Everything freezes under
 * `prefers-reduced-motion`. Artwork never paints outside the hexagon.
 */
export type GlyphSlug = "main-character" | "bounty-hunter" | "purify" | "verified" | "streamer";

const META: Record<GlyphSlug, { name: string; blurb: string; accent: string; dur: string }> = {
  "main-character": {
    name: "Main Character",
    blurb: "the story runs through you.",
    accent: "#ffc933",
    dur: "5s",
  },
  "bounty-hunter": {
    name: "Bounty",
    blurb: "first to the claim.",
    accent: "#ff5a1f",
    dur: "4s",
  },
  purify: {
    name: "Purify",
    blurb: "gradients, GIFs and bigger uploads.",
    accent: "#2ec9e8",
    dur: "3.5s",
  },
  verified: {
    name: "Verified",
    blurb: "identity confirmed.",
    accent: "#d4121f",
    dur: "6s",
  },
  streamer: {
    name: "Streamer",
    blurb: "live in voice.",
    accent: "#8a4dff",
    dur: "2.4s",
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
  const official = slug === "verified";

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
        {/* Chassis: ink for four marks, official red for Verified. */}
        <polygon
          points={HEX}
          fill={official ? "#d4121f" : "#0a0a0a"}
          stroke={official ? "#ffb0b8" : meta.accent}
          strokeWidth={official ? 2.2 : 1.5}
          strokeLinejoin="round"
        />
        <polygon
          points="16,5.4 25.7,11 25.7,21 16,26.6 6.3,21 6.3,11"
          fill={meta.accent}
          opacity={official ? 0.14 : 0.1}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.7"
        />

        {slug === "main-character" && (
          <>
            {/* Stage floor + beam, then the star standing in it. */}
            <ellipse cx="16" cy="26" rx="10.5" ry="2.2" fill="#000" opacity="0.55" />
            <polygon className="bz-anim bz-cone" points="13,3.4 19,3.4 25,24.6 7,24.6" fill={meta.accent} />
            <ellipse
              cx="16"
              cy="24.4"
              rx="7.4"
              ry="1.7"
              fill={meta.accent}
              opacity="0.28"
            />
            <polygon
              className="bz-star"
              points="16,8.6 18.1,13.8 23.6,14.3 19.4,17.8 20.6,23.2 16,20.4 11.4,23.2 12.6,17.8 8.4,14.3 13.9,13.8"
              fill={meta.accent}
              stroke="#fff3c4"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            <path
              d="M13.8 15.9l1.2-2.4 1.1 2.1"
              fill="none"
              stroke="#fffbe6"
              strokeWidth="0.7"
              strokeLinecap="round"
              opacity="0.85"
            />
            <g fill="#fff3c4" opacity="0.9">
              <path className="bz-sparkle" d="M24.4 7.2l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" />
              <circle cx="8.2" cy="21.4" r="0.7" />
            </g>
            <polygon className="bz-anim bz-shine" points="9,5 12,5 20,27 17,27" fill="#fff" />
          </>
        )}

        {slug === "bounty-hunter" && (
          <>
            <circle
              className="bz-anim bz-lock"
              cx="16"
              cy="16"
              r="11"
              fill="none"
              stroke={meta.accent}
              strokeWidth="1.2"
            />
            <circle cx="16" cy="16" r="9.4" fill={meta.accent} fillOpacity="0.09" stroke={meta.accent} strokeOpacity="0.4" strokeWidth="0.8" />
            <circle cx="16" cy="16" r="7.4" fill="none" stroke={meta.accent} strokeWidth="1.6" />
            <circle cx="16" cy="16" r="5.6" fill="none" stroke={meta.accent} strokeWidth="0.6" opacity="0.45" />
            <path
              d="M10.6 11.4a7.6 7.6 0 0 1 4.4-2.4"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.3"
              strokeLinecap="round"
              opacity="0.55"
            />
            <g fill={meta.accent} opacity="0.85">
              <circle cx="16" cy="9.4" r="0.55" />
              <circle cx="22.6" cy="16" r="0.55" />
              <circle cx="16" cy="22.6" r="0.55" />
              <circle cx="9.4" cy="16" r="0.55" />
            </g>
            <g className="bz-rotor" stroke={meta.accent} strokeWidth="1.8" strokeLinecap="round">
              <line x1="16" y1="6" x2="16" y2="10" />
              <line x1="16" y1="22" x2="16" y2="26" />
              <line x1="6" y1="16" x2="10" y2="16" />
              <line x1="22" y1="16" x2="26" y2="16" />
            </g>
            <circle
              cx="16"
              cy="16"
              r="3.6"
              fill="none"
              stroke={meta.accent}
              strokeWidth="0.8"
              strokeDasharray="1.2 2.1"
              opacity="0.6"
            />
            <circle className="bz-dot" cx="16" cy="16" r="2.2" fill={meta.accent} />
            <circle cx="16" cy="16" r="0.75" fill="#0a0a0a" opacity="0.5" />
          </>
        )}

        {slug === "purify" && (
          <>
            {/* Only the base ripple stays vector: the body itself is 58 beads
                of water, drawn live on the canvas below. */}
            <ellipse cx="16" cy="23.6" rx="8.6" ry="2.6" fill={meta.accent} opacity="0.1" />
            <circle
              className="bz-anim bz-ripple"
              cx="16"
              cy="23"
              r="5.4"
              fill="none"
              stroke={meta.accent}
              strokeWidth="1"
            />
          </>
        )}

        {slug === "verified" && (
          <>
            <circle cx="16" cy="16" r="11.3" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <circle cx="16" cy="16" r="10.4" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1.4" />
            <circle cx="16" cy="16" r="9.2" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.6" />
            <g fill="rgba(255,244,224,0.55)">
              <circle cx="16" cy="6.6" r="0.5" />
              <circle cx="24" cy="11.4" r="0.5" />
              <circle cx="24" cy="20.6" r="0.5" />
              <circle cx="16" cy="25.4" r="0.5" />
              <circle cx="8" cy="20.6" r="0.5" />
              <circle cx="8" cy="11.4" r="0.5" />
            </g>
            <path
              d="M10 17.1 L14.4 21.7 L22.4 12.3"
              fill="none"
              stroke="#7a0a12"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.45"
            />
            <path
              className="bz-anim bz-check"
              d="M10 16.4 L14.4 21 L22.4 11.6"
              fill="none"
              stroke="#fff4e0"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
            />
            <polygon className="bz-anim bz-shine" points="8,4.6 11.6,4.6 20,27.4 16.4,27.4" fill="#fff" />
          </>
        )}

        {slug === "streamer" && (
          <>
            <circle className="bz-anim bz-pulse" cx="16" cy="14.4" r="9.4" fill={meta.accent} opacity="0.16" />
            {/* Microphone: capsule, grille, stem and base. */}
            <rect x="13.1" y="5.4" width="5.8" height="9.6" rx="2.9" fill={meta.accent} />
            <g stroke="#170c2b" strokeWidth="0.75" opacity="0.85">
              <line x1="13.6" y1="8" x2="18.4" y2="8" />
              <line x1="13.6" y1="10" x2="18.4" y2="10" />
              <line x1="13.6" y1="12" x2="18.4" y2="12" />
            </g>
            <path
              d="M11.6 13.6a4.4 4.4 0 0 0 8.8 0"
              fill="none"
              stroke={meta.accent}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path d="M16 18.4v3.4" stroke={meta.accent} strokeWidth="1.5" strokeLinecap="round" />
            <path
              d="M12.8 23.4a3.6 3.6 0 0 0 6.4 0"
              fill="none"
              stroke={meta.accent}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Live signal: two arcs each side, timed inner-first. */}
            <g fill="none" stroke={meta.accent} strokeWidth="1.5" strokeLinecap="round">
              <path className="bz-anim bz-arc bz-arc-1" d="M9.6 9.6a9 9 0 0 0 0 12" />
              <path className="bz-anim bz-arc bz-arc-2" d="M22.4 9.6a9 9 0 0 1 0 12" />
              <path className="bz-anim bz-arc bz-arc-3" d="M6.6 6.4a13.4 13.4 0 0 0 0 18.4" opacity="0.7" />
              <path className="bz-anim bz-arc bz-arc-4" d="M25.4 6.4a13.4 13.4 0 0 1 0 18.4" opacity="0.7" />
            </g>
            <circle cx="23.4" cy="7.4" r="1.5" fill="#ff2d3f" />
            {/* Voice level bars breathe under the mic while it speaks. */}
            <g fill={meta.accent}>
              <rect className="bz-anim bz-eq bz-eq-1" x="12.4" y="24.2" width="1.1" height="4" rx="0.55" />
              <rect className="bz-anim bz-eq bz-eq-2" x="15.45" y="24.2" width="1.1" height="4" rx="0.55" />
              <rect className="bz-anim bz-eq bz-eq-3" x="18.5" y="24.2" width="1.1" height="4" rx="0.55" />
            </g>
            <polygon className="bz-anim bz-shine" points="8.2,4.6 11.6,4.6 20.6,27.4 17.2,27.4" fill="#c9a2ff" />
          </>
        )}
      </svg>
      {slug === "purify" && <WaterDroplet accent={meta.accent} />}
    </span>
  );
}
