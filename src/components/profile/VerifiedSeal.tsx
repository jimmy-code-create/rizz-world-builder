import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The verified seal on its own — the same azure scalloped check the `verified`
 * badge sprite draws, for surfaces that need the mark without the badge row.
 *
 * Blue is deliberate: verification is an identity mark, not a collectible, so
 * it should not read as one more tier badge. The seal carries a soft blue halo,
 * an inner vignette and a checked drop, so it holds up on a banner and at 18px.
 */
const SEAL_PATH =
  "M14.04 4.37 Q18.38 0.94 17.59 6.41 Q23.06 5.62 19.63 9.96 Q24.77 12 19.63 14.04 Q23.06 18.38 17.59 17.59 Q18.38 23.06 14.04 19.63 Q12 24.77 9.96 19.63 Q5.62 23.06 6.41 17.59 Q0.94 18.38 4.37 14.04 Q-0.77 12 4.37 9.96 Q0.94 5.62 6.41 6.41 Q5.62 0.94 9.96 4.37 Q12 -0.77 14.04 4.37Z";

export function VerifiedSeal({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <span
      role="img"
      title="Verified"
      aria-label="Verified"
      className={cn("inline-flex shrink-0", className)}
      style={{
        width: size,
        height: size,
        // A whisper of azure light so the seal sits on dark banners instead of
        // floating as a flat sticker.
        filter: `drop-shadow(0 0 ${Math.max(3, Math.round(size * 0.28))}px rgba(56,182,255,0.42))`,
      }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${uid}-fill`} x1="5.2" y1="2.8" x2="18.8" y2="21.6" gradientUnits="userSpaceOnUse">
            <stop stopColor="#82E1FF" />
            <stop offset="0.45" stopColor="#25A8FF" />
            <stop offset="1" stopColor="#0A78DC" />
          </linearGradient>
          <radialGradient id={`${uid}-vignette`} cx="12" cy="8.8" r="11.2" gradientUnits="userSpaceOnUse">
            <stop offset="0.38" stopColor="#052A55" stopOpacity="0" />
            <stop offset="0.76" stopColor="#042447" stopOpacity="0.16" />
            <stop offset="1" stopColor="#021836" stopOpacity="0.46" />
          </radialGradient>
        </defs>
        <path d={SEAL_PATH} fill="none" stroke="#45C4FF" strokeOpacity="0.16" strokeWidth="2.6" strokeLinejoin="round" />
        <path d={SEAL_PATH} fill="none" stroke="#7AD8FF" strokeOpacity="0.28" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={SEAL_PATH} fill={`url(#${uid}-fill)`} stroke="#8FE6FF" strokeOpacity="0.5" strokeWidth="0.9" strokeLinejoin="round" />
        <path d={SEAL_PATH} fill={`url(#${uid}-vignette)`} />
        <path
          d={SEAL_PATH}
          transform="translate(12 12) scale(.9) translate(-12 -12)"
          fill="none"
          stroke="#EAF9FF"
          strokeOpacity="0.2"
          strokeWidth="0.7"
        />
        <path d="M5.8 10.9A8.1 8.1 0 0 1 10.9 5.8" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.95" strokeLinecap="round" />
        <path
          d="M6.9 12.55 10.5 16.15 18 8.65"
          fill="none"
          stroke="#043A6D"
          strokeOpacity="0.28"
          strokeWidth="2.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.55 12.2 10.5 16.15 18.25 8.4"
          fill="none"
          stroke="#fff"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
