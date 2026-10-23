import { cn } from "@/lib/utils";

/**
 * The five profile badges, drawn as self-contained emblems on a transparent
 * 32-unit field — no chassis plate, no shine sweep, no animation.
 *
 *   verified        a scalloped blue seal around a bold check
 *   streamer        a dark squircle with a voice glyph, wrapped in a violet arc
 *   bounty-hunter   a black reticle disc with a masked sharp in a fedora
 *   purify          a violet ring holding a droplet and two sparkles
 *   main-character  a gold star standing in a spotlight
 *
 * Every mark fills its own 32 grid, so a 20px name-row chip and a 120px
 * showcase render the identical geometry. Colour is part of the artwork: the
 * marks do not tint with the theme.
 */
export type GlyphSlug = "main-character" | "bounty-hunter" | "purify" | "verified" | "streamer";

const META: Record<GlyphSlug, { name: string; blurb: string; accent: string }> = {
  "main-character": {
    name: "Main Character",
    blurb: "the story runs through you.",
    accent: "#ffc933",
  },
  "bounty-hunter": {
    name: "Bounty",
    blurb: "first to the claim.",
    accent: "#8b5cf6",
  },
  purify: {
    name: "Purify",
    blurb: "gradients, GIFs and bigger uploads.",
    accent: "#7c3aed",
  },
  verified: {
    name: "Verified",
    blurb: "identity confirmed.",
    accent: "#2f7bff",
  },
  streamer: {
    name: "Streamer",
    blurb: "live in voice.",
    accent: "#8a4dff",
  },
};

export const BADGE_GLYPH_SLUGS = Object.keys(META) as GlyphSlug[];

export function isBadgeGlyph(slug?: string | null): slug is GlyphSlug {
  return !!slug && slug in META;
}

export function badgeGlyphMeta(slug: GlyphSlug) {
  return META[slug];
}

/* Scalloped seal: eight outward arcs on a 12.3 radius, cut by a plain 9.9
   circle (even-odd), so the ring reads as a wavy frame at 20px. */
const VERIFIED_SEAL =
  "M16 3.7A5.4 5.4 0 0 1 24.7 7.3A5.4 5.4 0 0 1 28.3 16A5.4 5.4 0 0 1 24.7 24.7" +
  "A5.4 5.4 0 0 1 16 28.3A5.4 5.4 0 0 1 7.3 24.7A5.4 5.4 0 0 1 3.7 16A5.4 5.4 0 0 1 7.3 7.3" +
  "A5.4 5.4 0 0 1 16 3.7Z " +
  "M16 6.1a9.9 9.9 0 1 0 0 19.8a9.9 9.9 0 1 0 0-19.8Z";

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
  const label = title ?? `${meta.name} — ${meta.blurb}`;

  return (
    <span
      className={cn("bz-glyph", locked && "bz-glyph--locked", className)}
      data-badge={slug}
      style={{ width: px, height: px }}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 32 32" width={px} height={px} focusable="false" aria-hidden="true">
        <defs>
          <linearGradient
            id="bza-seal"
            x1="7"
            y1="4"
            x2="25"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#7fe4ff" />
            <stop offset="0.45" stopColor="#2f8bff" />
            <stop offset="1" stopColor="#1423c9" />
          </linearGradient>
          <linearGradient
            id="bza-check"
            x1="10"
            y1="11"
            x2="22"
            y2="21"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#9df0ff" />
            <stop offset="0.55" stopColor="#4aa8ff" />
            <stop offset="1" stopColor="#1d3ff0" />
          </linearGradient>
          <linearGradient id="bza-arc" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f4efff" />
            <stop offset="0.45" stopColor="#b79bff" />
            <stop offset="1" stopColor="#6d2cf0" />
          </linearGradient>
          <linearGradient
            id="bza-violet"
            x1="4"
            y1="3"
            x2="28"
            y2="29"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#c9a8ff" />
            <stop offset="0.5" stopColor="#9a63ff" />
            <stop offset="1" stopColor="#6a1fe0" />
          </linearGradient>
          <linearGradient
            id="bza-hat"
            x1="11"
            y1="7"
            x2="21"
            y2="16"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#dcd6ea" />
            <stop offset="1" stopColor="#a79fbd" />
          </linearGradient>
          <linearGradient
            id="bza-drop"
            x1="16"
            y1="8"
            x2="16"
            y2="26"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#eaf0ff" />
            <stop offset="1" stopColor="#b9c8ea" />
          </linearGradient>
          <linearGradient
            id="bza-gold"
            x1="16"
            y1="7"
            x2="16"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ffe98a" />
            <stop offset="0.55" stopColor="#ffc933" />
            <stop offset="1" stopColor="#e79a00" />
          </linearGradient>
          <linearGradient
            id="bza-beam"
            x1="16"
            y1="3"
            x2="16"
            y2="25"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ffd75e" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffd75e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {slug === "verified" && (
          <>
            <path d={VERIFIED_SEAL} fill="url(#bza-seal)" fillRule="evenodd" />
            <path
              d="M9.9 16.5 14.2 20.8 22.6 10.9"
              fill="none"
              stroke="#0c2a9c"
              strokeOpacity="0.4"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(.4 .5)"
            />
            <path
              d="M9.9 16.5 14.2 20.8 22.6 10.9"
              fill="none"
              stroke="url(#bza-check)"
              strokeWidth="3.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11 15.6 14.2 18.9"
              fill="none"
              stroke="#e6fbff"
              strokeOpacity="0.75"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
          </>
        )}

        {slug === "streamer" && (
          <>
            <circle cx="16" cy="16" r="13" fill="none" stroke="url(#bza-arc)" strokeWidth="2.5" />
            <rect x="6.4" y="6.4" width="19.2" height="19.2" rx="5.9" fill="#131118" />
            <circle cx="16" cy="16" r="2.15" fill="#f5f3fa" />
            <g fill="none" stroke="#f5f3fa" strokeWidth="1.9" strokeLinecap="round">
              <path d="M13.5 12.6a4.7 4.7 0 0 0 0 6.8" />
              <path d="M18.5 12.6a4.7 4.7 0 0 1 0 6.8" />
              <path d="M10.7 10.6a7.5 7.5 0 0 0 0 10.8" />
              <path d="M21.3 10.6a7.5 7.5 0 0 1 0 10.8" />
            </g>
          </>
        )}

        {slug === "bounty-hunter" && (
          <>
            <circle cx="16" cy="16" r="14.6" fill="#0b0a10" />
            <circle
              cx="16"
              cy="16"
              r="14.6"
              fill="none"
              stroke="url(#bza-violet)"
              strokeWidth="1.5"
            />
            <circle
              cx="16"
              cy="16"
              r="10.4"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="0.9"
              opacity="0.8"
            />
            <g fill="#a78bfa">
              <rect x="15.15" y="1.9" width="1.7" height="3.6" rx="0.85" />
              <rect x="15.15" y="26.5" width="1.7" height="3.6" rx="0.85" />
              <rect x="1.9" y="15.15" width="3.6" height="1.7" rx="0.85" />
              <rect x="26.5" y="15.15" width="3.6" height="1.7" rx="0.85" />
            </g>
            {/* Fedora: brim, crown, band. */}
            <path
              d="M6.8 15.2c2.4-1.2 5.6-1.9 9.2-1.9s6.8.7 9.2 1.9c.7.4.6 1.4-.2 1.7-2.8 1-5.8 1.4-9 1.4s-6.2-.4-9-1.4c-.8-.3-.9-1.3-.2-1.7Z"
              fill="url(#bza-hat)"
            />
            <path
              d="M11.3 14.7c-.3-2.4-.4-4.7.5-6.2.5-.9 1.3-1.4 2.2-1.6a10 10 0 0 1 4 0c.9.2 1.7.7 2.2 1.6.9 1.5.8 3.8.5 6.2-1.5.2-3.1.4-4.7.4s-3.2-.2-4.7-.4Z"
              fill="url(#bza-hat)"
            />
            <path d="M11.3 13.2h9.4l-.15 1.5c-1.5.2-3 .3-4.55.3s-3.05-.1-4.55-.3Z" fill="#231c33" />
            {/* Mask: pale jaw wedge, dark eye band, two lit slits. */}
            <path d="M12.3 17.5h7.4c-.25 3-1.6 4.9-3.7 6-2.1-1.1-3.45-3-3.7-6Z" fill="#efeaf9" />
            <path
              d="M12.3 17.5h7.4l-.18 1.85c-1.1.55-2.3.85-3.52.85s-2.42-.3-3.52-.85Z"
              fill="#171020"
            />
            <path d="M13.5 18.3l1.7.25-1.4.85z" fill="#ffffff" />
            <path d="M18.5 18.3l-1.7.25 1.4.85z" fill="#ffffff" />
            <path d="M16 20.4l1.1 1.5-1.1 1-1.1-1z" fill="#171020" opacity="0.55" />
          </>
        )}

        {slug === "purify" && (
          <>
            <circle
              cx="16"
              cy="16"
              r="13.4"
              fill="none"
              stroke="url(#bza-violet)"
              strokeWidth="2.5"
            />
            <circle
              cx="16"
              cy="16"
              r="11.6"
              fill="none"
              stroke="#8b5cf6"
              strokeOpacity="0.32"
              strokeWidth="0.7"
            />
            <path
              d="M11.6 23.2c-1.6-.5-3-1.7-3.6-3.3 1.7.2 3.1 1.3 3.6 3.3Z"
              fill="#eef3ff"
              opacity="0.9"
            />
            <path
              d="M20.4 23.2c1.6-.5 3-1.7 3.6-3.3-1.7.2-3.1 1.3-3.6 3.3Z"
              fill="#eef3ff"
              opacity="0.9"
            />
            <path
              d="M16 7.6c0 0-6.2 7.4-6.2 11.6a6.2 6.2 0 0 0 12.4 0C22.2 15 16 7.6 16 7.6Z"
              fill="url(#bza-drop)"
            />
            <path
              d="M13 18.8a3.3 3.3 0 0 0 2.3 4.9"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.85"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
            <path
              d="M16 12.6c0 0-3.4 4.2-3.4 6.6a3.4 3.4 0 0 0 6.8 0c0-2.4-3.4-6.6-3.4-6.6Z"
              fill="#dfe8ff"
              opacity="0.7"
            />
            <path
              d="M10.2 11.6l.7 1.95 1.95.7-1.95.7-.7 1.95-.7-1.95-1.95-.7 1.95-.7z"
              fill="url(#bza-violet)"
            />
            <path
              d="M21.9 14.3l.55 1.5 1.5.55-1.5.55-.55 1.5-.55-1.5-1.5-.55 1.5-.55z"
              fill="url(#bza-violet)"
            />
          </>
        )}

        {slug === "main-character" && (
          <>
            <polygon points="11.4,1.6 20.6,1.6 27.2,26.4 4.8,26.4" fill="url(#bza-beam)" />
            <ellipse cx="16" cy="27.4" rx="9.6" ry="1.7" fill="#ffc933" opacity="0.22" />
            <polygon
              points="16,2.7 19.57,11.66 29.02,12.44 21.9,18.48 23.9,27.78 16,22.98 8.1,27.78 10.1,18.48 2.98,12.44 12.43,11.66"
              fill="url(#bza-gold)"
              stroke="#fff0b8"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            <path
              d="M13.4 12.4l1.9-3.6 1.8 3.2"
              fill="none"
              stroke="#fffbe6"
              strokeWidth="0.65"
              strokeLinecap="round"
              opacity="0.9"
            />
          </>
        )}
      </svg>
    </span>
  );
}
