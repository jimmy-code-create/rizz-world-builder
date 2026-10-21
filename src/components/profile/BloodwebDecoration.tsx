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
      className={cn("pl-bw pointer-events-none absolute -inset-[15%] z-0", className)}
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
          <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
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

        <g fill="#ffd9dd" opacity="0.9">
          <circle cx="114.6" cy="46.4" r="1.1" />
          <circle cx="70.4" cy="113.2" r="1.4" />
          <circle cx="5.6" cy="77.6" r="1" />
        </g>
      </svg>
    </span>
  );
}
