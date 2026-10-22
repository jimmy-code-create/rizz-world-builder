import { useId } from "react";
import { DARK_MOON_SLUG } from "@/lib/effects";
import { cn } from "@/lib/utils";
import "./dark-moon.css";

/**
 * **Dark Moon** — a gothic frame for the banner.
 *
 * Bone-white moon, black branches climbing the top and sides, red-eyed ravens
 * and cold light falling across the card. All vector, all transparent, and
 * `pointer-events: none` so controls above the banner keep working.
 */
export function DarkMoonFrame({
  slug,
  className,
}: {
  slug?: string | null;
  className?: string;
}) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");
  if (slug !== DARK_MOON_SLUG) return null;

  return (
    <span
      aria-hidden="true"
      className={cn("dmf pointer-events-none absolute inset-0 z-[2] overflow-hidden", className)}
    >
      <svg
        viewBox="0 0 1100 360"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <defs>
          <radialGradient id={`${uid}-moon`} cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#f5f6f2" />
            <stop offset="58%" stopColor="#d5d9dd" />
            <stop offset="100%" stopColor="#9aa3ad" />
          </radialGradient>
          <radialGradient id={`${uid}-moonhaze`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#dfe8ef" stopOpacity="0.34" />
            <stop offset="70%" stopColor="#b8c4cd" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#9aa6b0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-ray`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff6d8" stopOpacity="0" />
            <stop offset="38%" stopColor="#fff3c4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${uid}-moon-shade`} cx="34%" cy="30%" r="72%">
            <stop offset="55%" stopColor="#0b1217" stopOpacity="0" />
            <stop offset="82%" stopColor="#0b1217" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#080d12" stopOpacity="0.5" />
          </radialGradient>
          <linearGradient id={`${uid}-mist`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c7d5dc" stopOpacity="0" />
            <stop offset="38%" stopColor="#c7d5dc" stopOpacity="0.18" />
            <stop offset="70%" stopColor="#9fb2bc" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#9fb2bc" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#eaf3f7" stopOpacity="0" />
            <stop offset="50%" stopColor="#eaf3f7" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#eaf3f7" stopOpacity="0" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-blur`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        {/* A few cold stars, thinning toward the branch. */}
        <g className="dmf-stars" fill="#e7f0f4">
          {[
            [382, 26, 1.4],
            [436, 74, 0.9],
            [514, 118, 1.1],
            [608, 46, 0.8],
            [704, 96, 1.2],
            [962, 118, 0.9],
            [1032, 54, 1.3],
            [1082, 182, 0.8],
            [286, 188, 0.7],
            [40, 268, 1],
          ].map(([cx, cy, r], index) => (
            <circle
              key={`star-${cx}-${cy}`}
              className="dmf-star"
              cx={cx}
              cy={cy}
              r={r}
              style={{ animationDelay: `${index * 0.7}s` }}
            />
          ))}
        </g>

        {/* Moon: nudged down so the disc sits fully inside the banner even on
            the short preview card, where the top couple of pixels used to be
            sliced off. */}
        <g transform="translate(0 20)">
        <circle cx="148" cy="86" r="172" fill={`url(#${uid}-moonhaze)`} />
        <circle cx="148" cy="86" r="104" fill={`url(#${uid}-moon)`} opacity="0.94" />
        <circle cx="148" cy="86" r="104" fill={`url(#${uid}-moon-shade)`} />
        <g fill="#aeb7c0" opacity="0.5">
          <ellipse cx="112" cy="55" rx="22" ry="15" />
          <ellipse cx="176" cy="96" rx="27" ry="18" />
          <ellipse cx="132" cy="132" rx="14" ry="11" />
          <ellipse cx="194" cy="48" rx="10" ry="8" />
          <ellipse cx="208" cy="122" rx="8" ry="6" />
          <ellipse cx="86" cy="110" rx="6" ry="4.5" />
        </g>
        <g fill="none" stroke="#8d99a3" strokeWidth="1.1" opacity="0.55">
          <ellipse cx="112" cy="55" rx="22" ry="15" />
          <ellipse cx="176" cy="96" rx="27" ry="18" />
          <ellipse cx="132" cy="132" rx="14" ry="11" />
          <path d="M 88 140 C 96 146 108 148 118 145" />
          <path d="M 154 75 C 160 80 168 82 175 80" opacity="0.7" />
        </g>
        {/* Thin cloud band across the lower moon. */}
        <path
          d="M 52 120 C 96 106 132 132 174 122 C 208 114 234 124 252 138"
          fill="none"
          stroke="#c7d3da"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.16"
          filter={`url(#${uid}-blur)`}
        />
        </g>

        {/* Falling light. */}
        <g className="dmf-rays" fill={`url(#${uid}-ray)`}>
          <path d="M690 8 L892 168 L858 184 L658 30 Z" opacity="0.8" />
          <path d="M796 2 L1010 158 L984 170 L768 20 Z" opacity="0.62" />
          <path d="M566 26 L714 150 L686 164 L540 44 Z" opacity="0.48" />
          <path d="M900 12 L1082 156 L1058 168 L878 28 Z" opacity="0.4" />
        </g>
        {/* A slow cold sweep, much wider than the sharp shafts. */}
        <path
          className="dmf-beam"
          d="M 540 -20 L 760 360 L 330 360 Z"
          fill={`url(#${uid}-beam)`}
        />

        {/* Main branch: one continuous silhouette across the top. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M-30 122 C96 82 196 64 302 70 C420 77 520 40 648 34 C776 28 900 54 1130 18"
            stroke="#05090a"
            strokeWidth="26"
          />
          <path
            d="M-30 122 C96 82 196 64 302 70 C420 77 520 40 648 34 C776 28 900 54 1130 18"
            stroke="#14201d"
            strokeWidth="15"
          />
          <path
            d="M-20 116 C104 78 200 60 302 66 C420 73 522 36 648 30 C778 24 902 50 1128 14"
            stroke="#31463d"
            strokeWidth="2.4"
            opacity="0.85"
          />

          {/* Reaching limbs and twigs. */}
          <g stroke="#0a1110" strokeWidth="9">
            <path d="M250 68 C244 34 230 16 206 2" />
            <path d="M250 68 C268 38 290 24 320 16" />
            <path d="M512 46 C496 18 476 6 452 -6" />
            <path d="M512 46 C530 22 552 10 582 2" />
            <path d="M812 40 C800 16 782 4 758 -5" />
            <path d="M812 40 C832 16 856 4 888 -4" />
            <path d="M-30 122 C6 150 18 186 12 232" />
            <path d="M1130 18 C1100 50 1092 86 1100 128" />
          </g>
          <g stroke="#0a1110" strokeWidth="4.5">
            <path d="M206 2 C192 -2 180 -2 168 2" />
            <path d="M206 2 C212 10 214 18 212 26" />
            <path d="M320 16 C334 10 346 8 360 10" />
            <path d="M320 16 C318 24 320 32 326 40" />
            <path d="M452 -6 C442 -10 430 -10 420 -4" />
            <path d="M582 2 C594 -4 606 -4 618 0" />
            <path d="M758 -5 C748 -10 736 -10 726 -4" />
            <path d="M888 -4 C902 -8 914 -6 924 0" />
            <path d="M12 232 C24 244 28 258 24 274" />
            <path d="M1100 128 C1088 140 1084 154 1088 170" />
          </g>

          {/* Side vines closing the frame. */}
          <g stroke="#060b0a" strokeWidth="12">
            <path d="M4 120 C22 178 10 254 -8 320" />
            <path d="M1096 20 C1082 92 1096 170 1112 250" />
          </g>
          <g stroke="#14201d" strokeWidth="5">
            <path d="M4 120 C22 178 10 254 -8 320" />
            <path d="M1096 20 C1082 92 1096 170 1112 250" />
          </g>
          <g stroke="#060b0a" strokeWidth="4">
            <path d="M16 166 C34 176 42 192 44 214" />
            <path d="M14 204 C-2 208 -12 220 -16 234" />
            <path d="M1090 70 C1072 78 1062 92 1058 110" />
            <path d="M1098 150 C1114 158 1122 172 1124 188" />
          </g>

          {/* Thorns. */}
          <g fill="#060b0a" stroke="none">
            <path d="M330 64 L340 50 L344 70 Z" />
            <path d="M398 58 L410 44 L410 64 Z" />
            <path d="M700 32 L712 18 L712 38 Z" />
            <path d="M928 46 L944 34 L938 54 Z" />
            <path d="M8 138 L-4 126 L14 126 Z" />
            <path d="M1092 88 L1108 78 L1102 96 Z" />
            <path d="M548 40 L558 30 L560 46 Z" />
            <path d="M846 34 L858 24 L856 42 Z" />
          </g>

          {/* Bark ridges and little hanging twigs. */}
          <g stroke="#3b5148" strokeWidth="1.2" opacity="0.55" fill="none">
            <path d="M40 107 C96 83 166 72 232 74" />
            <path d="M330 73 C398 67 458 55 512 45" />
            <path d="M648 34 C716 27 792 28 850 38" />
            <path d="M362 62 C348 76 340 92 344 108" />
            <path d="M724 34 C710 48 706 62 712 78" />
          </g>
          <g stroke="#060b0a" strokeWidth="2.2" fill="none" strokeLinecap="round">
            <path d="M186 72 C176 84 174 96 178 108" />
            <path d="M596 38 C588 50 590 62 598 72" />
            <path d="M872 44 C880 56 878 68 870 78" />
          </g>
          <g fill="#13211c" opacity="0.9" stroke="none">
            <path d="M176 108 C168 106 164 112 166 120 C172 122 178 118 176 108 Z" />
            <path d="M598 72 C590 70 586 76 588 84 C594 86 600 82 598 72 Z" />
            <path d="M870 78 C878 74 884 80 882 88 C876 90 870 86 870 78 Z" />
            <path d="M70 96 C62 94 58 100 60 108 C66 110 72 106 70 96 Z" />
          </g>
        </g>

        {/* Ravens. Each is a small silhouette with one red eye. */}
        <g className="dmf-ravens">
          <Raven x={300} y={14} scale={0.98} uid={uid} delay={0} />
          <Raven x={540} y={4} scale={1.08} uid={uid} flip delay={-2.1} />
          <Raven x={782} y={8} scale={0.9} uid={uid} delay={-4.2} />
          <Raven x={952} y={0} scale={0.8} uid={uid} flip delay={-1.2} />
        </g>

        {/* Ground mist and drifting ash give the frame depth. */}
        <g className="dmf-mist" fill={`url(#${uid}-mist)`} filter={`url(#${uid}-blur)`}>
          <ellipse cx="292" cy="336" rx="300" ry="34" />
          <ellipse cx="780" cy="348" rx="420" ry="42" />
          <ellipse cx="1040" cy="330" rx="240" ry="28" />
        </g>
        <g className="dmf-ash" fill="#dbe5e9">
          {[
            [248, 84, 1.4, 0.4],
            [466, 42, 1, 2.8],
            [628, 104, 1.5, 5.2],
            [744, 54, 0.9, 1.6],
            [884, 92, 1.2, 4.4],
            [986, 38, 1, 6.1],
            [358, 22, 0.8, 3.5],
            [1054, 112, 1.3, 0.9],
          ].map(([cx, cy, r, delay]) => (
            <circle
              key={`ash-${cx}-${cy}`}
              className="dmf-ash__dot"
              cx={cx}
              cy={cy}
              r={r}
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </g>

        {/* Cold vignette so the frame sits on the banner instead of floating. */}
        <rect x="0" y="0" width="1100" height="360" fill="none" />
      </svg>
    </span>
  );
}

function Raven({
  x,
  y,
  scale,
  uid,
  flip = false,
  delay = 0,
}: {
  x: number;
  y: number;
  scale: number;
  uid: string;
  flip?: boolean;
  delay?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${(flip ? -1 : 1) * scale} ${scale})`}>
      {/* Position lives on the outer group; the CSS bob must not override it. */}
      <g
        className="dmf-raven"
        style={{
          transformBox: "fill-box",
          transformOrigin: "50% 100%",
          animationDelay: `${delay}s`,
        }}
      >
      {/* Tail and body. */}
      <path
        d="M4 34 C8 24 18 18 30 19 C39 20 46 25 50 31 L58 30 L53 35 L47 36 L44 42 L39 36 C31 39 20 38 13 34 L2 45 C4 41 4 38 4 34 Z"
        fill="#050809"
      />
      {/* Head and beak. */}
      <path
        d="M43 24 C42 16 47 11 54 11 C61 11 66 16 65 23 C64 29 58 32 52 31 C47 30 44 28 43 24 Z"
        fill="#050809"
      />
      <path d="M65 20 L77 24 L65 26 Z" fill="#050809" />
      {/* Wing edge and feather rows. */}
      <path d="M14 29 C24 24 34 25 42 29 C35 31 24 32 14 29 Z" fill="#1a2022" opacity="0.8" />
      <g fill="none" stroke="#2a3437" strokeWidth="1.1" strokeLinecap="round" opacity="0.8">
        <path d="M18 27 C26 26 33 27 39 30" />
        <path d="M12 33 C19 32 26 33 32 35" />
        <path d="M50 16 C53 15 57 16 59 19" />
      </g>
      {/* Legs. */}
      <path d="M34 41 L32 50 M42 41 L44 50" stroke="#050809" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M28 50 L34 50 M42 50 L48 50" stroke="#050809" strokeWidth="1.6" strokeLinecap="round" />
      {/* Red eye, with a faint halo and a catchlight. */}
      <circle cx="58" cy="19" r="4.6" fill="#ff2020" opacity="0.14" />
      <circle
        className="dmf-eye"
        cx="58"
        cy="19"
        r="1.9"
        fill="#ff3030"
        filter={`url(#${uid}-glow)`}
        style={{ animationDelay: `${delay * 0.6}s` }}
      />
      <circle cx="57.3" cy="18.3" r="0.55" fill="#ffd9d9" opacity="0.9" />
      </g>
    </g>
  );
}
