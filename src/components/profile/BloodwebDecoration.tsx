import { useId } from "react";
import { BLOODWEB_SLUG } from "@/lib/effects";
import { cn } from "@/lib/utils";
import "./bloodweb.css";

/**
 * **Bloodweb** — a living collar of red veins around the avatar.
 *
 * Original transparent vector art: no ring image, no background and no mask
 * over the photo. It sits in a wrapper slightly larger than the avatar, so the
 * tendrils can reach past the ring while the face stays untouched. Pointer
 * events never land on it.
 */
export function BloodwebDecoration({
  slug,
  className,
  intensity = 1,
}: {
  slug?: string | null;
  className?: string;
  /** 0.6 for tiny avatars, 1 for the profile portrait. */
  intensity?: number;
}) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");
  if (slug !== BLOODWEB_SLUG) return null;

  return (
    <span
      aria-hidden="true"
      className={cn("pl-bw pointer-events-none absolute -inset-[8%] z-0", className)}
      style={{ opacity: intensity }}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id={`${uid}-orb`} cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#fff1f2" />
            <stop offset="26%" stopColor="#ff5566" />
            <stop offset="62%" stopColor="#e20f28" />
            <stop offset="100%" stopColor="#72000e" />
          </radialGradient>
          <radialGradient id={`${uid}-haze`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff2238" stopOpacity="0.34" />
            <stop offset="60%" stopColor="#c40018" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#5a0009" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-vein`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff9aa4" />
            <stop offset="38%" stopColor="#ff3048" />
            <stop offset="100%" stopColor="#8f0015" />
          </linearGradient>
          <radialGradient id={`${uid}-node`} cx="35%" cy="30%" r="70%">
            <stop offset="0" stopColor="#fff6f6" />
            <stop offset="35%" stopColor="#ff8b98" />
            <stop offset="100%" stopColor="#a30019" />
          </radialGradient>
          <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-hot`} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="1.4" result="soft" />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx="60" cy="60" rx="54" ry="54" fill={`url(#${uid}-haze)`} />

        {/* Three irregular webs: silhouette, body, then the hot core line. */}
        <g className="pl-bw-web" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M60 5 C88 3 112 22 115 51 C118 78 101 106 74 114 C47 122 19 106 10 80 C1 54 14 24 40 11 C46 8 53 6 60 5 Z"
            stroke="#340208"
            strokeWidth="7"
            opacity="0.9"
          />
          <path
            d="M60 5 C88 3 112 22 115 51 C118 78 101 106 74 114 C47 122 19 106 10 80 C1 54 14 24 40 11 C46 8 53 6 60 5 Z"
            stroke="#8f0a1c"
            strokeWidth="4.4"
          />
          <path
            d="M60 16 C82 14 100 30 103 52 C106 74 92 96 70 102 C48 108 26 94 20 73 C14 52 27 29 48 19 C52 17 56 16 60 16 Z"
            stroke="#4c030c"
            strokeWidth="4.2"
          />
          <path
            d="M60 16 C82 14 100 30 103 52 C106 74 92 96 70 102 C48 108 26 94 20 73 C14 52 27 29 48 19 C52 17 56 16 60 16 Z"
            stroke="#ff2d42"
            strokeWidth="1.7"
            filter={`url(#${uid}-glow)`}
          />
          <path
            d="M60 24 C79 23 94 37 96 56 C98 75 85 92 66 96 C47 100 28 87 24 68 C20 49 34 30 53 25 C55 24 57 24 60 24 Z"
            stroke="#5c040f"
            strokeWidth="3.4"
          />
          <path
            d="M60 24 C79 23 94 37 96 56 C98 75 85 92 66 96 C47 100 28 87 24 68 C20 49 34 30 53 25 C55 24 57 24 60 24 Z"
            stroke="#ff4055"
            strokeWidth="1.3"
          />

          {/* Spokes tying the rings together, curved so nothing reads as a disc. */}
          <g stroke="#ff2038" strokeWidth="1.5">
            <path d="M60 5 C57 13 52 19 46 24" />
            <path d="M115 51 C104 51 96 54 88 59" />
            <path d="M74 114 C74 101 72 93 68 86" />
            <path d="M10 80 C23 79 33 74 40 66" />
            <path d="M40 11 C42 20 49 27 56 32" />
            <path d="M103 52 C94 61 90 71 93 81" />
            <path d="M20 73 C30 67 35 60 37 52" />
            <path d="M96 80 C86 79 78 81 71 86" />
          </g>
          <g stroke="#7a0414" strokeWidth="1.1" opacity="0.9">
            <path d="M60 5 C66 12 72 16 80 18" />
            <path d="M115 51 C108 45 103 38 101 30" />
            <path d="M74 114 C65 110 58 108 50 108" />
            <path d="M10 80 C16 88 24 94 32 97" />
            <path d="M24 68 C33 58 43 52 52 48" />
            <path d="M96 56 C88 65 84 74 84 84" />
          </g>

          {/* Thorn ends reaching into the corners. */}
          <g stroke="#b00a1f" strokeWidth="2.2" strokeLinecap="round">
            <path d="M115 51 C119 47 121 42 121 37" />
            <path d="M74 114 C79 117 84 118 89 117" />
            <path d="M10 80 C5 84 2 89 1 95" />
            <path d="M40 11 C36 7 31 4 25 3" />
          </g>

          {/* A second, finer web right at the photo edge, so the collar still
              reads at 40px instead of dissolving into the outer haze. */}
          <g
            className="pl-bw-rim"
            stroke={`url(#${uid}-vein)`}
            strokeWidth="1.35"
            opacity="0.92"
          >
            <path d="M60 8 C88.7 8 112 31.3 112 60 C112 88.7 88.7 112 60 112 C31.3 112 8 88.7 8 60 C8 31.3 31.3 8 60 8 Z" />
            <path d="M60 13 C86 12 103 30 104 53 C105 79 86 101 62 104 C38 107 18 89 16 64 C14 42 32 20 54 14" opacity="0.72" />
            <path d="M60 8 C57 16 52 21 44 25" />
            <path d="M112 60 C102 57 95 51 91 43" />
            <path d="M60 112 C64 103 70 97 79 93" />
            <path d="M8 60 C17 64 24 71 27 81" />
            <path d="M88 32 C80 35 75 41 73 49" />
            <path d="M104 79 C94 79 86 83 80 90" />
            <path d="M18 39 C27 40 34 45 38 52" />
            <path d="M78 103 C74 96 72 89 73 82" />
          </g>

          {/* Capillary forks and tiny hooks keep the silhouette organic. */}
          <g stroke="#ff4055" strokeWidth="0.95" strokeLinecap="round" opacity="0.85">
            <path d="M44 25 C39 23 34 24 30 28" />
            <path d="M44 25 C43 19 40 15 36 12" />
            <path d="M91 43 C96 39 100 38 104 38" />
            <path d="M91 43 C92 37 90 32 87 28" />
            <path d="M79 93 C84 96 88 100 90 105" />
            <path d="M27 81 C22 84 18 89 16 95" />
            <path d="M73 49 C68 46 64 42 62 36" />
            <path d="M80 90 C84 85 88 82 94 81" />
            <path d="M38 52 C33 53 28 57 25 62" />
            <path d="M73 82 C69 78 65 76 59 75" />
          </g>

          <g stroke="#7a0414" strokeWidth="0.8" strokeLinecap="round" opacity="0.8">
            <path d="M30 28 C27 31 26 35 26 39" />
            <path d="M36 12 C33 10 29 10 26 12" />
            <path d="M104 38 C108 36 112 36 115 38" />
            <path d="M87 28 C89 25 92 23 96 22" />
            <path d="M90 105 C91 109 90 113 88 116" />
            <path d="M16 95 C13 97 11 101 11 105" />
            <path d="M62 36 C58 34 54 33 50 34" />
            <path d="M59 75 C54 72 49 71 44 72" />
          </g>
        </g>

        {/* Slow pulses travelling through the veins. */}
        <g className="pl-bw-flow" fill="none" strokeLinecap="round">
          <path d="M60 8 C88.7 8 112 31.3 112 60" stroke="#ffd7db" strokeWidth="1.6" opacity="0.9" pathLength="100" />
          <path d="M112 60 C112 88.7 88.7 112 60 112" stroke="#ffb3bb" strokeWidth="1.2" opacity="0.75" pathLength="100" />
          <path d="M8 60 C8 31.3 31.3 8 60 8" stroke="#ffd7db" strokeWidth="1.3" opacity="0.8" pathLength="100" />
          <path d="M60 112 C31.3 112 8 88.7 8 60" stroke="#ff9aa4" strokeWidth="1.1" opacity="0.65" pathLength="100" />
        </g>

        <g className="pl-bw-orbs" filter={`url(#${uid}-glow)`}>
          <circle cx="116" cy="48" r="5.4" fill={`url(#${uid}-orb)`} />
          <circle cx="72" cy="115" r="6.2" fill={`url(#${uid}-orb)`} />
          <circle cx="7" cy="79" r="5" fill={`url(#${uid}-orb)`} />
          <circle cx="41" cy="9" r="4.2" fill={`url(#${uid}-orb)`} />
          <circle cx="98" cy="94" r="5.2" fill={`url(#${uid}-orb)`} />
          <circle cx="55" cy="21" r="3.8" fill={`url(#${uid}-orb)`} />
          <circle cx="19" cy="32" r="3.2" fill={`url(#${uid}-orb)`} />
        </g>

        {/* Junction nodes: a hot core, a dark seat and a faint outer rim. */}
        <g className="pl-bw-nodes">
          {[
            [60, 8, 2.6],
            [112, 60, 2.2],
            [60, 112, 2.9],
            [8, 60, 2],
            [91, 43, 1.8],
            [79, 93, 2.1],
            [27, 81, 1.7],
            [44, 25, 1.9],
            [73, 49, 1.5],
            [38, 52, 1.6],
          ].map(([cx, cy, r]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r={r + 1.5} fill="#6b0010" opacity="0.85" />
              <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-node)`} filter={`url(#${uid}-hot)`} />
              <circle cx={cx - r * 0.28} cy={cy - r * 0.3} r={r * 0.28} fill="#fff6f6" opacity="0.95" />
            </g>
          ))}
        </g>

        {/* Two heavy drops caught on the lowest thorns. */}
        <g className="pl-bw-drips">
          <ellipse cx="72" cy="116" rx="1.9" ry="2.7" fill="#ff3349" filter={`url(#${uid}-hot)`} />
          <ellipse cx="90" cy="117" rx="1.2" ry="1.9" fill="#b0001c" opacity="0.9" />
        </g>

        <g fill="#ffd9dd" opacity="0.9">
          <circle cx="114.6" cy="46.4" r="1.1" />
          <circle cx="70.4" cy="113.2" r="1.4" />
          <circle cx="5.6" cy="77.6" r="1" />
          <circle cx="91.7" cy="41.8" r="0.9" />
          <circle cx="26.2" cy="80.2" r="0.8" />
        </g>
      </svg>
    </span>
  );
}
